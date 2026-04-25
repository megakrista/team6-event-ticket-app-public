import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  order: {
    create: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    aggregate: vi.fn(),
  },
  payment: {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
}));

import {
  createCheckoutOrderAndPaymentIntent,
  expireStalePendingOrders,
  fulfillOrderFromSucceededPaymentIntent,
  getOrderByStripePaymentIntentId,
  markOrderAndPaymentFailedFromIntent,
} from "@/services/orderservices";

const ORDER_STATUS = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;

const PAYMENT_STATUS = {
  PENDING: "PENDING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
} as const;

const TICKET_STATUS = {
  PAID: "PAID",
} as const;

function stripeMock() {
  return {
    paymentIntents: {
      create: vi.fn(),
      cancel: vi.fn(),
    },
  } as any;
}

function knownError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError("db error", {
    code,
    clientVersion: "test",
    ...(meta ? { meta } : {}),
  });
}

function intent(overrides: Record<string, unknown> = {}) {
  return {
    id: "pi_1",
    metadata: { orderId: "o1", eventId: "e1", quantity: "2" },
    amount: 5000,
    amount_received: 5000,
    ...overrides,
  } as any;
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "o1",
    eventId: "e1",
    quantity: 2,
    status: ORDER_STATUS.PENDING,
    totalAmount: new Prisma.Decimal("50.00"),
    buyerName: "Ada",
    buyerEmail: "ada@example.com",
    userId: "u1",
    tickets: [],
    event: { id: "e1", capacity: 100 },
    ...overrides,
  };
}

beforeEach(() => {
  for (const group of [prismaMock.order, prismaMock.payment]) {
    for (const fn of Object.values(group)) {
      fn.mockReset();
    }
  }
  prismaMock.$transaction.mockReset();
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(crypto, "randomUUID").mockReturnValue(
    "11111111-1111-1111-1111-111111111111",
  );
});

describe("createCheckoutOrderAndPaymentIntent", () => {
  it("returns invalid price for non-positive values", async () => {
    const stripe = stripeMock();

    await expect(
      createCheckoutOrderAndPaymentIntent(stripe, {
        eventId: "e1",
        quantity: 2,
        pricePerTicketEur: 0,
        buyerName: "Ada",
        buyerEmail: "ada@example.com",
      }),
    ).resolves.toEqual({ ok: false, error: "Invalid price" });
  });

  it("returns no-payment error when cents round to zero", async () => {
    const stripe = stripeMock();

    await expect(
      createCheckoutOrderAndPaymentIntent(stripe, {
        eventId: "e1",
        quantity: 2,
        pricePerTicketEur: 0.001,
        buyerName: "Ada",
        buyerEmail: "ada@example.com",
      }),
    ).resolves.toEqual({ ok: false, error: "This event does not require payment" });
  });

  it("returns order creation error message", async () => {
    const stripe = stripeMock();
    prismaMock.order.create.mockRejectedValue(new Error("failed order"));

    await expect(
      createCheckoutOrderAndPaymentIntent(stripe, {
        eventId: "e1",
        quantity: 2,
        pricePerTicketEur: 25,
        buyerName: "Ada",
        buyerEmail: "ada@example.com",
      }),
    ).resolves.toEqual({ ok: false, error: "failed order" });
  });

  it("marks order failed when stripe create fails", async () => {
    const stripe = stripeMock();
    prismaMock.order.create.mockResolvedValue({ id: "o1" });
    stripe.paymentIntents.create.mockRejectedValue(new Error("stripe error"));

    await expect(
      createCheckoutOrderAndPaymentIntent(stripe, {
        eventId: "e1",
        quantity: 2,
        pricePerTicketEur: 25,
        buyerName: "Ada",
        buyerEmail: "ada@example.com",
      }),
    ).resolves.toEqual({ ok: false, error: "stripe error" });

    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
      where: { id: "o1", status: ORDER_STATUS.PENDING },
      data: { status: ORDER_STATUS.FAILED },
    });
  });

  it("cancels payment intent and fails order when payment row create fails", async () => {
    const stripe = stripeMock();
    prismaMock.order.create.mockResolvedValue({ id: "o1" });
    stripe.paymentIntents.create.mockResolvedValue({
      id: "pi_1",
      client_secret: "secret",
    });
    prismaMock.payment.create.mockRejectedValue(new Error("db payment error"));

    await expect(
      createCheckoutOrderAndPaymentIntent(stripe, {
        eventId: "e1",
        quantity: 2,
        pricePerTicketEur: 25,
        buyerName: "Ada",
        buyerEmail: "ada@example.com",
      }),
    ).resolves.toEqual({ ok: false, error: "Failed to record payment" });

    expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith("pi_1");
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
      where: { id: "o1", status: ORDER_STATUS.PENDING },
      data: { status: ORDER_STATUS.FAILED },
    });
  });

  it("fails order when payment intent lacks client secret", async () => {
    const stripe = stripeMock();
    prismaMock.order.create.mockResolvedValue({ id: "o1" });
    stripe.paymentIntents.create.mockResolvedValue({ id: "pi_1", client_secret: null });
    prismaMock.payment.create.mockResolvedValue({ id: "p1" });

    await expect(
      createCheckoutOrderAndPaymentIntent(stripe, {
        eventId: "e1",
        quantity: 2,
        pricePerTicketEur: 25,
        buyerName: "Ada",
        buyerEmail: "ada@example.com",
      }),
    ).resolves.toEqual({ ok: false, error: "Missing client secret from Stripe" });
  });

  it("creates order, stripe intent, and payment row", async () => {
    const stripe = stripeMock();
    prismaMock.order.create.mockResolvedValue({ id: "o1" });
    stripe.paymentIntents.create.mockResolvedValue({
      id: "pi_1",
      client_secret: "secret_1",
    });
    prismaMock.payment.create.mockResolvedValue({ id: "p1" });

    const result = await createCheckoutOrderAndPaymentIntent(stripe, {
      eventId: "e1",
      quantity: 2,
      pricePerTicketEur: 25,
      userId: "u1",
      buyerName: "  Ada  ",
      buyerEmail: "  ADA@Example.com ",
    });

    expect(prismaMock.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        idempotencyKey: "11111111-1111-1111-1111-111111111111",
        quantity: 2,
        eventId: "e1",
        userId: "u1",
        buyerName: "Ada",
        buyerEmail: "ada@example.com",
        status: ORDER_STATUS.PENDING,
      }),
    });
    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5000,
        metadata: { orderId: "o1", eventId: "e1", quantity: "2" },
      }),
      { idempotencyKey: "11111111-1111-1111-1111-111111111111" },
    );
    expect(prismaMock.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "o1",
        externalPaymentId: "pi_1",
        status: PAYMENT_STATUS.PENDING,
      }),
    });
    expect(result).toEqual({
      ok: true,
      clientSecret: "secret_1",
      orderId: "o1",
      totalAmountCents: 5000,
      perTicketPriceCents: 2500,
      quantity: 2,
    });
  });
});

describe("fulfillOrderFromSucceededPaymentIntent", () => {
  it("returns missing orderId when metadata is absent", async () => {
    await expect(fulfillOrderFromSucceededPaymentIntent(intent({ metadata: {} }))).resolves.toEqual(
      {
        ok: false,
        retryable: false,
        message: "missing orderId",
      },
    );
  });

  it("returns order not found when order lookup fails", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);

    await expect(fulfillOrderFromSucceededPaymentIntent(intent())).resolves.toEqual({
      ok: false,
      retryable: false,
      message: "order not found",
    });
  });

  it("returns event mismatch when metadata event differs from order event", async () => {
    prismaMock.order.findUnique.mockResolvedValue(order({ eventId: "e1" }));

    await expect(
      fulfillOrderFromSucceededPaymentIntent(intent({ metadata: { orderId: "o1", eventId: "e2" } })),
    ).resolves.toEqual({
      ok: false,
      retryable: false,
      message: "event mismatch",
    });
  });

  it("returns ok for already-paid consistent order", async () => {
    prismaMock.order.findUnique.mockResolvedValue(
      order({
        status: ORDER_STATUS.PAID,
        quantity: 2,
        tickets: [{ id: "t1" }, { id: "t2" }],
      }),
    );

    await expect(fulfillOrderFromSucceededPaymentIntent(intent())).resolves.toEqual({ ok: true });
  });

  it("returns retryable for already-paid inconsistent order", async () => {
    prismaMock.order.findUnique.mockResolvedValue(
      order({
        status: ORDER_STATUS.PAID,
        quantity: 2,
        tickets: [{ id: "t1" }],
      }),
    );

    await expect(fulfillOrderFromSucceededPaymentIntent(intent())).resolves.toEqual({
      ok: false,
      retryable: true,
      message: "inconsistent paid order",
    });
  });

  it("returns quantity mismatch when metadata qty differs", async () => {
    prismaMock.order.findUnique.mockResolvedValue(order({ quantity: 2 }));

    await expect(
      fulfillOrderFromSucceededPaymentIntent(
        intent({ metadata: { orderId: "o1", eventId: "e1", quantity: "3" } }),
      ),
    ).resolves.toEqual({
      ok: false,
      retryable: false,
      message: "quantity mismatch",
    });
  });

  it("returns amount mismatch when received differs from expected", async () => {
    prismaMock.order.findUnique.mockResolvedValue(order({ totalAmount: new Prisma.Decimal("50.00") }));

    await expect(
      fulfillOrderFromSucceededPaymentIntent(
        intent({ amount: 4000, amount_received: 4000 }),
      ),
    ).resolves.toEqual({
      ok: false,
      retryable: false,
      message: "amount mismatch",
    });
  });

  it("fulfills order successfully through serializable transaction", async () => {
    prismaMock.order.findUnique.mockResolvedValue(order());

    const tx = {
      order: {
        findUnique: vi.fn().mockResolvedValue(order({ tickets: [] })),
        update: vi.fn().mockResolvedValue({}),
        aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: 2 } }),
      },
      payment: {
        upsert: vi.fn().mockResolvedValue({}),
      },
      ticket: {
        count: vi.fn().mockResolvedValue(10),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      event: {
        findUnique: vi.fn().mockResolvedValue({ capacity: 200 }),
      },
    };
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(tx));

    await expect(fulfillOrderFromSucceededPaymentIntent(intent())).resolves.toEqual({ ok: true });
    expect(tx.ticket.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          orderId: "o1",
          eventId: "e1",
          status: TICKET_STATUS.PAID,
          userId: "u1",
        }),
      ]),
    });
    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  });

  it("retries once on ticket-number unique conflict and then succeeds", async () => {
    prismaMock.order.findUnique.mockResolvedValue(order());
    const tx = {
      order: {
        findUnique: vi.fn().mockResolvedValue(order({ tickets: [] })),
        update: vi.fn().mockResolvedValue({}),
        aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
      },
      payment: { upsert: vi.fn().mockResolvedValue({}) },
      ticket: {
        count: vi.fn().mockResolvedValue(1),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      event: { findUnique: vi.fn().mockResolvedValue({ capacity: 10 }) },
    };
    prismaMock.$transaction
      .mockRejectedValueOnce(knownError("P2002", { target: "ticketNumber" }))
      .mockImplementationOnce(async (cb: any) => cb(tx));

    await expect(fulfillOrderFromSucceededPaymentIntent(intent())).resolves.toEqual({ ok: true });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
  });

  it("returns retryable on capacity exceeded transaction error", async () => {
    prismaMock.order.findUnique.mockResolvedValue(order());
    prismaMock.$transaction.mockRejectedValue(new Error("Capacity exceeded: paid=5"));

    await expect(fulfillOrderFromSucceededPaymentIntent(intent())).resolves.toEqual({
      ok: false,
      retryable: true,
      message: "Capacity exceeded: paid=5",
    });
  });

  it("returns non-retryable for generic failure", async () => {
    prismaMock.order.findUnique.mockResolvedValue(order());
    prismaMock.$transaction.mockRejectedValue(new Error("boom"));

    await expect(fulfillOrderFromSucceededPaymentIntent(intent())).resolves.toEqual({
      ok: false,
      retryable: false,
      message: "boom",
    });
  });
});

describe("markOrderAndPaymentFailedFromIntent", () => {
  it("does nothing when orderId is missing", async () => {
    await markOrderAndPaymentFailedFromIntent(intent({ metadata: {} }));

    expect(prismaMock.order.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("does nothing when order is already paid", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ status: ORDER_STATUS.PAID });

    await markOrderAndPaymentFailedFromIntent(intent());

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("marks payment failed and order cancelled", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ status: ORDER_STATUS.PENDING });
    const tx = {
      payment: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      order: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(tx));

    await markOrderAndPaymentFailedFromIntent(intent());

    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { externalPaymentId: "pi_1" },
      data: { status: PAYMENT_STATUS.FAILED },
    });
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: "o1", status: ORDER_STATUS.PENDING },
      data: { status: ORDER_STATUS.CANCELLED },
    });
  });
});

describe("getOrderByStripePaymentIntentId", () => {
  it("returns null when payment is missing", async () => {
    prismaMock.payment.findUnique.mockResolvedValue(null);

    await expect(getOrderByStripePaymentIntentId("pi_1")).resolves.toBeNull();
  });

  it("returns nested order when payment exists", async () => {
    prismaMock.payment.findUnique.mockResolvedValue({
      order: { id: "o1", event: { title: "Event" }, tickets: [] },
    });

    await expect(getOrderByStripePaymentIntentId("pi_1")).resolves.toEqual({
      id: "o1",
      event: { title: "Event" },
      tickets: [],
    });
  });
});

describe("expireStalePendingOrders", () => {
  it("returns 0 when no stale orders exist", async () => {
    const tx = {
      order: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
      },
      payment: {
        updateMany: vi.fn(),
      },
    };
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(tx));

    await expect(expireStalePendingOrders()).resolves.toBe(0);
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it("expires stale orders and related pending payments", async () => {
    const tx = {
      order: {
        findMany: vi.fn().mockResolvedValue([{ id: "o1" }, { id: "o2" }]),
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      payment: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(tx));

    await expect(expireStalePendingOrders()).resolves.toBe(2);
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { orderId: { in: ["o1", "o2"] }, status: PAYMENT_STATUS.PENDING },
      data: { status: PAYMENT_STATUS.FAILED },
    });
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["o1", "o2"] }, status: ORDER_STATUS.PENDING },
      data: { status: ORDER_STATUS.CANCELLED },
    });
  });
});
