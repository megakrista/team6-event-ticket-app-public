import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { OrderStatus, PaymentStatus, Prisma, TicketStatus } from "@prisma/client";
import type Stripe from "stripe";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function generateTicketNumber() {
  return `TKT-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function eurToCents(eur: number): number {
  return Math.round(eur * 100);
}

function centsToEurDecimal(cents: number): Prisma.Decimal {
  return new Prisma.Decimal(cents).dividedBy(100);
}

function upsertSucceededPaymentForIntent(
  tx: TxClient,
  args: { orderId: string; externalPaymentId: string; receivedCents: number },
) {
  return tx.payment.upsert({
    where: { externalPaymentId: args.externalPaymentId },
    create: {
      orderId: args.orderId,
      externalPaymentId: args.externalPaymentId,
      amount: centsToEurDecimal(args.receivedCents),
      status: PaymentStatus.SUCCEEDED,
      method: "stripe",
    },
    update: {
      amount: centsToEurDecimal(args.receivedCents),
      status: PaymentStatus.SUCCEEDED,
    },
  });
}

export type CreateCheckoutOrderInput = {
  eventId: string;
  quantity: number;
  pricePerTicketEur: number;
  userId?: string;
  buyerName: string;
  buyerEmail: string;
};

export type CreateCheckoutOrderResult =
  | {
      ok: true;
      clientSecret: string;
      orderId: string;
      totalAmountCents: number;
      perTicketPriceCents: number;
      quantity: number;
    }
  | { ok: false; error: string };

/**
 * Persists a pending order, creates the Stripe PaymentIntent, then records the Payment row.
 * Stripe is called after the Order row exists so metadata always carries orderId.
 */
export async function createCheckoutOrderAndPaymentIntent(
  stripe: Stripe,
  input: CreateCheckoutOrderInput,
): Promise<CreateCheckoutOrderResult> {
  const quantity = input.quantity;
  const pricePerTicketEur = input.pricePerTicketEur;
  if (!Number.isFinite(pricePerTicketEur) || pricePerTicketEur <= 0) {
    return { ok: false, error: "Invalid price" };
  }

  const totalEur = pricePerTicketEur * quantity;
  const totalAmount = new Prisma.Decimal(totalEur.toFixed(2));
  const perTicketCents = eurToCents(pricePerTicketEur);
  if (!Number.isInteger(perTicketCents) || perTicketCents <= 0) {
    return { ok: false, error: "This event does not require payment" };
  }
  const totalAmountCents = perTicketCents * quantity;

  const idempotencyKey = crypto.randomUUID();
  const buyerEmail = input.buyerEmail.trim().toLowerCase();
  const buyerName = input.buyerName.trim();

  let orderId: string;

  try {
    const order = await prisma.order.create({
      data: {
        idempotencyKey,
        totalAmount,
        quantity,
        eventId: input.eventId,
        userId: input.userId,
        buyerName,
        buyerEmail,
        status: OrderStatus.PENDING,
      },
    });
    orderId = order.id;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create order";
    return { ok: false, error: msg };
  }

  let paymentIntent: Stripe.Response<Stripe.PaymentIntent>;
  try {
    paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalAmountCents,
        currency: "eur",
        automatic_payment_methods: { enabled: true },
        metadata: {
          orderId,
          eventId: input.eventId,
          quantity: String(quantity),
        },
      },
      { idempotencyKey },
    );
  } catch (e: unknown) {
    await prisma.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING },
      data: { status: OrderStatus.FAILED },
    });
    const msg = e instanceof Error ? e.message : "Stripe error";
    return { ok: false, error: msg };
  }

  try {
    await prisma.payment.create({
      data: {
        orderId,
        externalPaymentId: paymentIntent.id,
        amount: totalAmount,
        status: PaymentStatus.PENDING,
        method: "stripe",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to record payment";
    console.error(`[orders] Payment row failed for PI ${paymentIntent.id}: ${msg}`);
    try {
      await stripe.paymentIntents.cancel(paymentIntent.id);
    } catch (cancelErr: unknown) {
      console.error(`[orders] Failed to cancel PI ${paymentIntent.id}:`, cancelErr);
    }
    await prisma.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING },
      data: { status: OrderStatus.FAILED },
    });
    return { ok: false, error: "Failed to record payment" };
  }

  if (!paymentIntent.client_secret) {
    await prisma.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING },
      data: { status: OrderStatus.FAILED },
    });
    return { ok: false, error: "Missing client secret from Stripe" };
  }

  return {
    ok: true,
    clientSecret: paymentIntent.client_secret,
    orderId,
    totalAmountCents,
    perTicketPriceCents: perTicketCents,
    quantity,
  };
}

/**
 * Idempotent fulfillment: marks order paid and creates all tickets inside one serializable transaction.
 * Returns 5xx-worthy failures for Stripe retry when the paid amount does not match the order.
 */
export async function fulfillOrderFromSucceededPaymentIntent(
  intent: Stripe.PaymentIntent,
): Promise<{ ok: true } | { ok: false; retryable: boolean; message: string }> {
  const orderId = intent.metadata?.orderId?.trim();
  if (!orderId) {
    console.error(`[orders] payment_intent.succeeded missing orderId in metadata: ${intent.id}`);
    return { ok: false, retryable: false, message: "missing orderId" };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      event: { select: { id: true, capacity: true } },
      tickets: { select: { id: true } },
    },
  });

  if (!order) {
    console.error(`[orders] Order not found for webhook: ${orderId}`);
    return { ok: false, retryable: false, message: "order not found" };
  }

  const metaEventId = intent.metadata?.eventId?.trim();
  if (metaEventId && metaEventId !== order.eventId) {
    console.error(
      `[orders] eventId mismatch for order ${orderId}: metadata=${metaEventId} order=${order.eventId}`,
    );
    return { ok: false, retryable: false, message: "event mismatch" };
  }

  if (order.status === OrderStatus.PAID && order.tickets.length === order.quantity) {
    return { ok: true };
  }

  if (order.status === OrderStatus.PAID && order.tickets.length !== order.quantity) {
    console.error(
      `[orders] Inconsistent PAID order ${orderId}: tickets=${order.tickets.length} expected=${order.quantity}`,
    );
    return { ok: false, retryable: true, message: "inconsistent paid order" };
  }

  const parsedQty = parseInt(intent.metadata?.quantity || String(order.quantity), 10);
  const quantityMeta =
    Number.isInteger(parsedQty) && parsedQty >= 1 ? parsedQty : order.quantity;
  if (quantityMeta !== order.quantity) {
    console.error(
      `[orders] Quantity mismatch for order ${orderId}: metadata=${quantityMeta} order=${order.quantity}`,
    );
    return { ok: false, retryable: false, message: "quantity mismatch" };
  }

  const receivedCents = intent.amount_received > 0 ? intent.amount_received : intent.amount;
  const expectedCents = eurToCents(Number(order.totalAmount));
  if (receivedCents !== expectedCents) {
    console.error(
      `[orders] Amount mismatch for order ${orderId}: received=${receivedCents} expected=${expectedCents}`,
    );
    return { ok: false, retryable: false, message: "amount mismatch" };
  }

  const pricePerTicketEur = Number(order.totalAmount) / order.quantity;
  const pricePaidDecimal = new Prisma.Decimal(pricePerTicketEur.toFixed(2));

  for (let attempt = 0; attempt < 5; attempt++) {
    const ticketNumbers = Array.from({ length: order.quantity }, generateTicketNumber);

    try {
      await prisma.$transaction(
        async (tx: TxClient) => {
          const current = await tx.order.findUnique({
            where: { id: orderId },
            include: { tickets: { select: { id: true } } },
          });
          if (!current) {
            throw new Error("Order disappeared");
          }
          if (current.status === OrderStatus.PAID && current.tickets.length === order.quantity) {
            return;
          }

          if (current.tickets.length === order.quantity) {
            await upsertSucceededPaymentForIntent(tx, {
              orderId: current.id,
              externalPaymentId: intent.id,
              receivedCents,
            });
            await tx.order.update({
              where: { id: current.id },
              data: { status: OrderStatus.PAID },
            });
            return;
          }

          if (current.tickets.length > 0) {
            throw new Error(
              `Partial tickets for order ${orderId}: ${current.tickets.length} / ${order.quantity}`,
            );
          }

          const [soldPaid, pendingAgg, event] = await Promise.all([
            tx.ticket.count({
              where: { eventId: order.eventId, status: TicketStatus.PAID },
            }),
            tx.order.aggregate({
              where: { eventId: order.eventId, status: OrderStatus.PENDING },
              _sum: { quantity: true },
            }),
            tx.event.findUnique({
              where: { id: order.eventId },
              select: { capacity: true },
            }),
          ]);

          if (!event) {
            throw new Error(`Event not found: ${order.eventId}`);
          }

          const pendingSeats = pendingAgg._sum.quantity ?? 0;
          if (soldPaid + pendingSeats > event.capacity) {
            throw new Error(
              `Capacity exceeded: paid=${soldPaid}, pendingSeats=${pendingSeats}, capacity=${event.capacity}`,
            );
          }

          await tx.ticket.createMany({
            data: ticketNumbers.map((ticketNumber) => ({
              ticketNumber,
              orderId: current.id,
              eventId: order.eventId,
              attendeeName: order.buyerName,
              attendeeEmail: order.buyerEmail,
              pricePaid: pricePaidDecimal,
              status: TicketStatus.PAID,
              ...(order.userId ? { userId: order.userId } : {}),
            })),
          });

          await upsertSucceededPaymentForIntent(tx, {
            orderId: current.id,
            externalPaymentId: intent.id,
            receivedCents,
          });

          await tx.order.update({
            where: { id: current.id },
            data: { status: OrderStatus.PAID },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return { ok: true };
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002" && String(err.meta?.target).includes("ticketNumber")) {
          continue;
        }
        if (err.code === "P2034") {
          continue;
        }
      }
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[orders] fulfillOrder failed for ${orderId}: ${msg}`);
      const retryable =
        msg.includes("Capacity exceeded") ||
        msg.includes("P2034") ||
        msg.includes("serialization") ||
        msg.includes("Partial tickets");
      return { ok: false, retryable, message: msg };
    }
  }

  return { ok: false, retryable: true, message: "Failed after retries" };
}

export async function markOrderAndPaymentFailedFromIntent(intent: Stripe.PaymentIntent) {
  const orderId = intent.metadata?.orderId?.trim();
  if (!orderId) return;

  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (existing?.status === OrderStatus.PAID) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.updateMany({
      where: { externalPaymentId: intent.id },
      data: { status: PaymentStatus.FAILED },
    });
    await tx.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING },
      data: { status: OrderStatus.CANCELLED },
    });
  });
}

export async function getOrderByStripePaymentIntentId(paymentIntentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { externalPaymentId: paymentIntentId },
    include: {
      order: {
        include: {
          event: { select: { title: true } },
          tickets: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  return payment?.order ?? null;
}

const DEFAULT_STALE_PENDING_MINUTES = 180;

/**
 * Cancels PENDING orders (not PAID) that are past STALE_PENDING_ORDER_MINUTES (default 180) or past event end.
 * Frees capacity; run from POST /api/cron/expire-pending-orders.
 */
export async function expireStalePendingOrders(): Promise<number> {
  const raw = process.env.STALE_PENDING_ORDER_MINUTES;
  const parsed = raw ? Number(raw) : DEFAULT_STALE_PENDING_MINUTES;
  const minutes =
    Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_STALE_PENDING_MINUTES;
  const now = new Date();
  const cutoff = new Date(now.getTime() - minutes * 60_000);

  return prisma.$transaction(async (tx) => {
    const stale = await tx.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        OR: [
          { createdAt: { lt: cutoff } },
          { event: { endsAt: { lte: now } } },
        ],
      },
      select: { id: true },
    });
    if (stale.length === 0) return 0;

    const ids = stale.map((o) => o.id);

    await tx.payment.updateMany({
      where: { orderId: { in: ids }, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.FAILED },
    });

    const updated = await tx.order.updateMany({
      where: { id: { in: ids }, status: OrderStatus.PENDING },
      data: { status: OrderStatus.CANCELLED },
    });

    return updated.count;
  });
}
