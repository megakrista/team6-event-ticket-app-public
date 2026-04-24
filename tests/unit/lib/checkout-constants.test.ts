import { describe, expect, it } from "vitest";

import {
  CHECKOUT_EMAIL_RE,
  CHECKOUT_MAX_QUANTITY,
  validateCheckoutBody,
} from "@/lib/checkout-constants";

describe("checkout constants", () => {
  it("defines expected limits", () => {
    expect(CHECKOUT_MAX_QUANTITY).toBe(10);
    expect(CHECKOUT_EMAIL_RE.test("person@example.com")).toBe(true);
    expect(CHECKOUT_EMAIL_RE.test("invalid-email")).toBe(false);
  });
});

describe("validateCheckoutBody", () => {
  it("returns field errors for invalid payload", () => {
    const result = validateCheckoutBody({
      eventId: 123,
      quantity: 0,
      buyerName: " ",
      buyerEmail: "bad-email",
    });

    expect(result).toEqual({
      fields: {
        eventId: "Invalid event id",
        quantity: "Quantity must be between 1 and 10",
        buyerName: "Name is required",
        buyerEmail: "Valid email is required",
      },
    });
  });

  it("returns normalized fields for valid payload", () => {
    const result = validateCheckoutBody({
      eventId: "event-1",
      quantity: "3",
      buyerName: "  Ada Lovelace  ",
      buyerEmail: "ada@example.com",
    });

    expect(result).toEqual({
      fields: {},
      normalized: {
        eventId: "event-1",
        quantity: 3,
        buyerName: "Ada Lovelace",
        buyerEmail: "ada@example.com",
      },
    });
  });

  it("rejects quantities above max", () => {
    const result = validateCheckoutBody({
      eventId: "event-1",
      quantity: 11,
      buyerName: "Ada",
      buyerEmail: "ada@example.com",
    });

    expect(result.fields.quantity).toBe("Quantity must be between 1 and 10");
    expect(result.normalized).toBeUndefined();
  });
});
