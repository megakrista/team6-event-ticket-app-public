import { beforeEach, describe, expect, it, vi } from "vitest";

const constructEventMock = vi.hoisted(() => vi.fn());
const fulfillOrderFromSucceededPaymentIntentMock = vi.hoisted(() => vi.fn());
const markOrderAndPaymentFailedFromIntentMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: constructEventMock,
    },
  },
}));

vi.mock("@/services/orderservices", () => ({
  fulfillOrderFromSucceededPaymentIntent: fulfillOrderFromSucceededPaymentIntentMock,
  markOrderAndPaymentFailedFromIntent: markOrderAndPaymentFailedFromIntentMock,
}));

function makeWebhookRequest(body = "{}", signature?: string) {
  const headers = new Headers();
  if (signature) {
    headers.set("stripe-signature", signature);
  }

  return new Request("http://localhost/api/payments/webhook", {
    method: "POST",
    headers,
    body,
  });
}

async function loadPostWithSecret(secret?: string) {
  vi.resetModules();
  if (secret === undefined) {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  } else {
    process.env.STRIPE_WEBHOOK_SECRET = secret;
  }
  const mod = await import("@/app/api/payments/webhook/route");
  return mod.POST;
}

beforeEach(() => {
  constructEventMock.mockReset();
  fulfillOrderFromSucceededPaymentIntentMock.mockReset();
  markOrderAndPaymentFailedFromIntentMock.mockReset();
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/payments/webhook", () => {
  it("returns 500 when webhook secret is missing", async () => {
    const POST = await loadPostWithSecret(undefined);
    const response = await POST(makeWebhookRequest("{}", "sig"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Missing STRIPE_WEBHOOK_SECRET",
    });
  });

  it("returns 400 when signature header is missing", async () => {
    const POST = await loadPostWithSecret("whsec_123");
    const response = await POST(makeWebhookRequest("{}", undefined));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing signature",
    });
  });

  it("returns 400 for invalid signature", async () => {
    const POST = await loadPostWithSecret("whsec_123");
    constructEventMock.mockImplementation(() => {
      throw new Error("bad signature");
    });

    const response = await POST(makeWebhookRequest("{}", "sig"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid signature",
    });
  });

  it("marks order/payment failed for payment_failed events", async () => {
    const POST = await loadPostWithSecret("whsec_123");
    const intent = { id: "pi_1" };
    constructEventMock.mockReturnValue({
      type: "payment_intent.payment_failed",
      data: { object: intent },
    });

    const response = await POST(makeWebhookRequest('{"a":1}', "sig"));

    expect(markOrderAndPaymentFailedFromIntentMock).toHaveBeenCalledWith(intent);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
  });

  it("returns 500 for retryable fulfill failure on succeeded events", async () => {
    const POST = await loadPostWithSecret("whsec_123");
    const intent = { id: "pi_1" };
    constructEventMock.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: intent },
    });
    fulfillOrderFromSucceededPaymentIntentMock.mockResolvedValue({
      ok: false,
      retryable: true,
      message: "serialize conflict",
    });

    const response = await POST(makeWebhookRequest("{}", "sig"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "serialize conflict",
    });
  });

  it("returns skipped= true for non-retryable fulfill failure", async () => {
    const POST = await loadPostWithSecret("whsec_123");
    const intent = { id: "pi_1" };
    constructEventMock.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: intent },
    });
    fulfillOrderFromSucceededPaymentIntentMock.mockResolvedValue({
      ok: false,
      retryable: false,
      message: "amount mismatch",
    });

    const response = await POST(makeWebhookRequest("{}", "sig"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: true,
      skipped: true,
    });
  });

  it("returns success for succeeded and unrelated events", async () => {
    const POST = await loadPostWithSecret("whsec_123");
    const succeededIntent = { id: "pi_success" };
    constructEventMock
      .mockReturnValueOnce({
        type: "payment_intent.succeeded",
        data: { object: succeededIntent },
      })
      .mockReturnValueOnce({
        type: "charge.refunded",
        data: { object: {} },
      });
    fulfillOrderFromSucceededPaymentIntentMock.mockResolvedValue({ ok: true });

    const succeededResponse = await POST(makeWebhookRequest("{}", "sig"));
    const unrelatedResponse = await POST(makeWebhookRequest("{}", "sig"));

    expect(fulfillOrderFromSucceededPaymentIntentMock).toHaveBeenCalledWith(succeededIntent);
    expect(succeededResponse.status).toBe(200);
    await expect(succeededResponse.json()).resolves.toEqual({ received: true });

    expect(unrelatedResponse.status).toBe(200);
    await expect(unrelatedResponse.json()).resolves.toEqual({ received: true });
  });
});
