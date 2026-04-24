import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const cookiesMock = vi.hoisted(() => vi.fn());
const validateCheckoutBodyMock = vi.hoisted(() => vi.fn());
const getEventByIdMock = vi.hoisted(() => vi.fn());
const getSessionByTokenMock = vi.hoisted(() => vi.fn());
const checkoutRateLimitExceededMock = vi.hoisted(() => vi.fn());
const clientIpFromRequestMock = vi.hoisted(() => vi.fn());
const getAllocatedSeatCountMock = vi.hoisted(() => vi.fn());
const createCheckoutOrderAndPaymentIntentMock = vi.hoisted(() => vi.fn());
const stripeMock = vi.hoisted(() => ({ mock: "stripe-client" }));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/checkout-constants", () => ({
  validateCheckoutBody: validateCheckoutBodyMock,
}));

vi.mock("@/services/eventservices", () => ({
  getEventById: getEventByIdMock,
}));

vi.mock("@/services/sessionservices", () => ({
  getSessionByToken: getSessionByTokenMock,
}));

vi.mock("@/lib/checkout-rate-limit", () => ({
  checkoutRateLimitExceeded: checkoutRateLimitExceededMock,
  clientIpFromRequest: clientIpFromRequestMock,
}));

vi.mock("@/services/ticketservices", () => ({
  getAllocatedSeatCount: getAllocatedSeatCountMock,
}));

vi.mock("@/services/orderservices", () => ({
  createCheckoutOrderAndPaymentIntent: createCheckoutOrderAndPaymentIntentMock,
}));

vi.mock("@/lib/stripe", () => ({
  stripe: stripeMock,
}));

import { POST } from "@/app/api/payments/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/payments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as NextRequest;
}

beforeEach(() => {
  cookiesMock.mockReset();
  validateCheckoutBodyMock.mockReset();
  getEventByIdMock.mockReset();
  getSessionByTokenMock.mockReset();
  checkoutRateLimitExceededMock.mockReset();
  clientIpFromRequestMock.mockReset();
  getAllocatedSeatCountMock.mockReset();
  createCheckoutOrderAndPaymentIntentMock.mockReset();

  clientIpFromRequestMock.mockReturnValue("127.0.0.1");
  checkoutRateLimitExceededMock.mockReturnValue(false);
  validateCheckoutBodyMock.mockReturnValue({
    fields: {},
    normalized: {
      eventId: "e1",
      quantity: 2,
      buyerName: "Ada",
      buyerEmail: "ada@example.com",
    },
  });
  getEventByIdMock.mockResolvedValue({
    status: 200,
    event: {
      id: "e1",
      status: "PUBLISHED",
      price: 25,
      capacity: 10,
    },
  });
  getAllocatedSeatCountMock.mockResolvedValue(4);
  cookiesMock.mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
  });
  getSessionByTokenMock.mockResolvedValue(null);
  createCheckoutOrderAndPaymentIntentMock.mockResolvedValue({
    ok: true,
    clientSecret: "cs_1",
    orderId: "o1",
    totalAmountCents: 5000,
    perTicketPriceCents: 2500,
    quantity: 2,
  });
});

describe("POST /api/payments", () => {
  it("returns 429 when checkout rate limit is exceeded", async () => {
    checkoutRateLimitExceededMock.mockReturnValue(true);

    const response = await POST(makeRequest({}));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "Too many checkout attempts. Try again later.",
    });
    expect(validateCheckoutBodyMock).not.toHaveBeenCalled();
  });

  it("returns validation payload when body validation fails", async () => {
    validateCheckoutBodyMock.mockReturnValue({
      fields: { buyerEmail: "Valid email is required" },
      normalized: undefined,
    });

    const response = await POST(makeRequest({ buyerEmail: "bad" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Validation failed",
      fields: { buyerEmail: "Valid email is required" },
    });
  });

  it("returns 404 when event is not found", async () => {
    getEventByIdMock.mockResolvedValue({ status: 404, error: "Event not found" });

    const response = await POST(makeRequest({}));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Event not found" });
  });

  it("returns 400 when event is not published", async () => {
    getEventByIdMock.mockResolvedValue({
      status: 200,
      event: { id: "e1", status: "DRAFT", price: 25, capacity: 10 },
    });

    const response = await POST(makeRequest({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Event not available" });
  });

  it("returns 409 when requested quantity exceeds remaining seats", async () => {
    getAllocatedSeatCountMock.mockResolvedValue(9);

    const response = await POST(makeRequest({}));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Only 1 ticket(s) remaining",
    });
  });

  it("returns 500 when checkout creation fails", async () => {
    createCheckoutOrderAndPaymentIntentMock.mockResolvedValue({
      ok: false,
      error: "Stripe down",
    });

    const response = await POST(makeRequest({}));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Stripe down" });
  });

  it("returns client secret payload on success and passes user id from session", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "session-token" }),
    });
    getSessionByTokenMock.mockResolvedValue({
      user: { id: "u1" },
    });

    const response = await POST(makeRequest({}));

    expect(createCheckoutOrderAndPaymentIntentMock).toHaveBeenCalledWith(stripeMock, {
      eventId: "e1",
      quantity: 2,
      pricePerTicketEur: 25,
      userId: "u1",
      buyerName: "Ada",
      buyerEmail: "ada@example.com",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      clientSecret: "cs_1",
      orderId: "o1",
      totalAmount: 5000,
      perTicketPrice: 2500,
      quantity: 2,
    });
  });
});
