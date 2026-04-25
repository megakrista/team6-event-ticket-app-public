import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { EventStatus, OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import type Stripe from "stripe";
import prisma from "@/lib/prisma";
import {
  createCheckoutOrderAndPaymentIntent,
  expireStalePendingOrders,
  fulfillOrderFromSucceededPaymentIntent,
  markOrderAndPaymentFailedFromIntent,
} from "@/services/orderservices";

const MARKER = `it-orders-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

function assertIntegrationDbConfig() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set for integration tests. Configure it in .env or shell env.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("DATABASE_URL is invalid. Expected a valid PostgreSQL connection string.");
  }

  const hasAuth = parsed.username.length > 0 && parsed.password.length > 0;
  if (!hasAuth) {
    throw new Error(
      "DATABASE_URL must include both username and password for Postgres auth (e.g. postgresql://user:pass@host:5432/db).",
    );
  }
}

function uniqueEmail(label: string): string {
  return `${MARKER}-${label}-${crypto.randomUUID()}@example.com`;
}

function uniquePaymentIntentId(): string {
  return `${MARKER}-pi-${crypto.randomUUID()}`;
}

function makeStripeStub(paymentIntentId: string, clientSecret = "cs_test_secret") {
  const create = vi.fn().mockResolvedValue({
    id: paymentIntentId,
    client_secret: clientSecret,
  });
  const cancel = vi.fn().mockResolvedValue({});

  return {
    stripe: {
      paymentIntents: {
        create,
        cancel,
      },
    } as unknown as Stripe,
    create,
  };
}

async function createFixtureEvent() {
  const user = await prisma.user.create({
    data: {
      email: uniqueEmail("creator"),
      firstName: "Integration",
      lastName: "Tester",
    },
  });

  const venue = await prisma.venue.create({
    data: {
      name: `${MARKER}-venue-${crypto.randomUUID()}`,
      address: "Test Street 1",
      latitude: new Prisma.Decimal("59.437"),
      longitude: new Prisma.Decimal("24.7536"),
      timezone: "Europe/Tallinn",
    },
  });

  const event = await prisma.event.create({
    data: {
      title: `${MARKER}-event-${crypto.randomUUID()}`,
      description: "Integration test event",
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      capacity: 200,
      price: new Prisma.Decimal("25.00"),
      category: "Music",
      status: EventStatus.PUBLISHED,
      venueId: venue.id,
      createdById: user.id,
    },
  });

  return { user, venue, event };
}

async function cleanupIntegrationRecords() {
  await prisma.ticket.deleteMany({
    where: {
      OR: [
        { attendeeEmail: { startsWith: `${MARKER}-` } },
        { order: { buyerEmail: { startsWith: `${MARKER}-` } } },
      ],
    },
  });

  await prisma.payment.deleteMany({
    where: {
      OR: [
        { order: { buyerEmail: { startsWith: `${MARKER}-` } } },
        { externalPaymentId: { startsWith: `${MARKER}-pi-` } },
      ],
    },
  });

  await prisma.order.deleteMany({
    where: { buyerEmail: { startsWith: `${MARKER}-` } },
  });

  await prisma.session.deleteMany({
    where: { user: { email: { startsWith: `${MARKER}-` } } },
  });

  await prisma.event.deleteMany({
    where: { title: { startsWith: `${MARKER}-event-` } },
  });

  await prisma.venue.deleteMany({
    where: { name: { startsWith: `${MARKER}-venue-` } },
  });

  await prisma.user.deleteMany({
    where: { email: { startsWith: `${MARKER}-` } },
  });
}

describe.sequential("orderservices integration", () => {
  beforeAll(async () => {
    assertIntegrationDbConfig();
    await cleanupIntegrationRecords();
  });

  afterAll(async () => {
    await cleanupIntegrationRecords();
  });

  it("creates pending order and payment rows for checkout", async () => {
    const { event } = await createFixtureEvent();
    const buyerEmail = uniqueEmail("checkout");
    const paymentIntentId = uniquePaymentIntentId();
    const { stripe, create } = makeStripeStub(paymentIntentId);

    const result = await createCheckoutOrderAndPaymentIntent(stripe, {
      eventId: event.id,
      quantity: 2,
      pricePerTicketEur: Number(event.price),
      buyerName: "  Ada Lovelace  ",
      buyerEmail: `  ${buyerEmail.toUpperCase()}  `,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id: result.orderId },
      include: { payments: true },
    });

    expect(order).not.toBeNull();
    expect(order?.status).toBe(OrderStatus.PENDING);
    expect(order?.quantity).toBe(2);
    expect(order?.buyerName).toBe("Ada Lovelace");
    expect(order?.buyerEmail).toBe(buyerEmail.toLowerCase());
    expect(order?.payments).toHaveLength(1);
    expect(order?.payments[0]?.status).toBe(PaymentStatus.PENDING);
    expect(order?.payments[0]?.externalPaymentId).toBe(paymentIntentId);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: result.totalAmountCents,
        metadata: {
          orderId: result.orderId,
          eventId: event.id,
          quantity: "2",
        },
      }),
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
  });

  it("fulfills order from successful intent and stays idempotent on duplicate delivery", async () => {
    const { event } = await createFixtureEvent();
    const buyerEmail = uniqueEmail("fulfill-ok");
    const paymentIntentId = uniquePaymentIntentId();
    const { stripe } = makeStripeStub(paymentIntentId);

    const checkout = await createCheckoutOrderAndPaymentIntent(stripe, {
      eventId: event.id,
      quantity: 3,
      pricePerTicketEur: Number(event.price),
      buyerName: "Integration Buyer",
      buyerEmail,
    });

    expect(checkout.ok).toBe(true);
    if (!checkout.ok) {
      return;
    }

    const intent = {
      id: paymentIntentId,
      metadata: {
        orderId: checkout.orderId,
        eventId: event.id,
        quantity: String(checkout.quantity),
      },
      amount: checkout.totalAmountCents,
      amount_received: checkout.totalAmountCents,
    } as unknown as Stripe.PaymentIntent;

    await expect(fulfillOrderFromSucceededPaymentIntent(intent)).resolves.toEqual({ ok: true });
    await expect(fulfillOrderFromSucceededPaymentIntent(intent)).resolves.toEqual({ ok: true });

    const order = await prisma.order.findUnique({
      where: { id: checkout.orderId },
      include: {
        tickets: true,
        payments: true,
      },
    });

    expect(order?.status).toBe(OrderStatus.PAID);
    expect(order?.tickets).toHaveLength(3);
    expect(new Set(order?.tickets.map((t) => t.ticketNumber)).size).toBe(3);
    expect(order?.payments.find((p) => p.externalPaymentId === paymentIntentId)?.status).toBe(
      PaymentStatus.SUCCEEDED,
    );
  });

  it("rejects amount mismatch without mutating order state", async () => {
    const { event } = await createFixtureEvent();
    const buyerEmail = uniqueEmail("amount-mismatch");
    const paymentIntentId = uniquePaymentIntentId();
    const { stripe } = makeStripeStub(paymentIntentId);

    const checkout = await createCheckoutOrderAndPaymentIntent(stripe, {
      eventId: event.id,
      quantity: 2,
      pricePerTicketEur: Number(event.price),
      buyerName: "Mismatch Buyer",
      buyerEmail,
    });

    expect(checkout.ok).toBe(true);
    if (!checkout.ok) {
      return;
    }

    const mismatchIntent = {
      id: paymentIntentId,
      metadata: {
        orderId: checkout.orderId,
        eventId: event.id,
        quantity: String(checkout.quantity),
      },
      amount: checkout.totalAmountCents - 100,
      amount_received: checkout.totalAmountCents - 100,
    } as unknown as Stripe.PaymentIntent;

    await expect(fulfillOrderFromSucceededPaymentIntent(mismatchIntent)).resolves.toEqual({
      ok: false,
      retryable: false,
      message: "amount mismatch",
    });

    const order = await prisma.order.findUnique({
      where: { id: checkout.orderId },
      include: { tickets: true, payments: true },
    });

    expect(order?.status).toBe(OrderStatus.PENDING);
    expect(order?.tickets).toHaveLength(0);
    expect(order?.payments.find((p) => p.externalPaymentId === paymentIntentId)?.status).toBe(
      PaymentStatus.PENDING,
    );
  });

  it("marks pending order and payment as failed on failed intent", async () => {
    const { event } = await createFixtureEvent();
    const buyerEmail = uniqueEmail("failed-intent");
    const paymentIntentId = uniquePaymentIntentId();
    const { stripe } = makeStripeStub(paymentIntentId);

    const checkout = await createCheckoutOrderAndPaymentIntent(stripe, {
      eventId: event.id,
      quantity: 1,
      pricePerTicketEur: Number(event.price),
      buyerName: "Failed Buyer",
      buyerEmail,
    });

    expect(checkout.ok).toBe(true);
    if (!checkout.ok) {
      return;
    }

    await markOrderAndPaymentFailedFromIntent({
      id: paymentIntentId,
      metadata: { orderId: checkout.orderId },
    } as unknown as Stripe.PaymentIntent);

    const order = await prisma.order.findUnique({
      where: { id: checkout.orderId },
      include: { payments: true },
    });

    expect(order?.status).toBe(OrderStatus.CANCELLED);
    expect(order?.payments.find((p) => p.externalPaymentId === paymentIntentId)?.status).toBe(
      PaymentStatus.FAILED,
    );
  });

  it("expires only stale pending orders", async () => {
    const previousMinutes = process.env.STALE_PENDING_ORDER_MINUTES;
    process.env.STALE_PENDING_ORDER_MINUTES = "30";

    try {
      const { event } = await createFixtureEvent();
      const staleBuyerEmail = uniqueEmail("stale-order");
      const freshBuyerEmail = uniqueEmail("fresh-order");
      const staleCreatedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const staleOrder = await prisma.order.create({
        data: {
          idempotencyKey: crypto.randomUUID(),
          totalAmount: new Prisma.Decimal("50.00"),
          quantity: 2,
          status: OrderStatus.PENDING,
          eventId: event.id,
          buyerName: "Stale Buyer",
          buyerEmail: staleBuyerEmail,
          createdAt: staleCreatedAt,
          updatedAt: staleCreatedAt,
        },
      });

      const freshOrder = await prisma.order.create({
        data: {
          idempotencyKey: crypto.randomUUID(),
          totalAmount: new Prisma.Decimal("25.00"),
          quantity: 1,
          status: OrderStatus.PENDING,
          eventId: event.id,
          buyerName: "Fresh Buyer",
          buyerEmail: freshBuyerEmail,
        },
      });

      const stalePaymentIntentId = uniquePaymentIntentId();
      const freshPaymentIntentId = uniquePaymentIntentId();

      await prisma.payment.create({
        data: {
          orderId: staleOrder.id,
          externalPaymentId: stalePaymentIntentId,
          amount: new Prisma.Decimal("50.00"),
          status: PaymentStatus.PENDING,
          method: "stripe",
          createdAt: staleCreatedAt,
          updatedAt: staleCreatedAt,
        },
      });

      await prisma.payment.create({
        data: {
          orderId: freshOrder.id,
          externalPaymentId: freshPaymentIntentId,
          amount: new Prisma.Decimal("25.00"),
          status: PaymentStatus.PENDING,
          method: "stripe",
        },
      });

      const expiredCount = await expireStalePendingOrders();
      expect(expiredCount).toBe(1);

      const [staleAfter, freshAfter] = await Promise.all([
        prisma.order.findUnique({
          where: { id: staleOrder.id },
          include: { payments: true },
        }),
        prisma.order.findUnique({
          where: { id: freshOrder.id },
          include: { payments: true },
        }),
      ]);

      expect(staleAfter?.status).toBe(OrderStatus.CANCELLED);
      expect(
        staleAfter?.payments.find((p) => p.externalPaymentId === stalePaymentIntentId)?.status,
      ).toBe(PaymentStatus.FAILED);
      expect(freshAfter?.status).toBe(OrderStatus.PENDING);
      expect(
        freshAfter?.payments.find((p) => p.externalPaymentId === freshPaymentIntentId)?.status,
      ).toBe(PaymentStatus.PENDING);
    } finally {
      if (previousMinutes === undefined) {
        delete process.env.STALE_PENDING_ORDER_MINUTES;
      } else {
        process.env.STALE_PENDING_ORDER_MINUTES = previousMinutes;
      }
    }
  });
});
