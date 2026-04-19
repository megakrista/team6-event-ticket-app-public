/** Shared between POST /api/payments and PaymentForm — keep in sync automatically. */

export const CHECKOUT_MAX_QUANTITY = 10;

export const CHECKOUT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export type CheckoutPostBody = {
  eventId?: unknown;
  quantity?: unknown;
  buyerName?: unknown;
  buyerEmail?: unknown;
};

export type ValidatedCheckoutFields = {
  eventId: string;
  quantity: number;
  buyerName: string;
  buyerEmail: string;
};

/**
 * Validates checkout POST body. Returns field errors (admin-style) or normalized values.
 */
export function validateCheckoutBody(body: CheckoutPostBody): {
  fields: Record<string, string>;
  normalized?: ValidatedCheckoutFields;
} {
  const fields: Record<string, string> = {};

  if (!body.eventId || typeof body.eventId !== "string") {
    fields.eventId = "Invalid event id";
  }

  const quantity = Number(body.quantity);
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > CHECKOUT_MAX_QUANTITY
  ) {
    fields.quantity = `Quantity must be between 1 and ${CHECKOUT_MAX_QUANTITY}`;
  }

  const buyerName = typeof body.buyerName === "string" ? body.buyerName.trim() : "";
  if (!buyerName) {
    fields.buyerName = "Name is required";
  }

  const buyerEmail = typeof body.buyerEmail === "string" ? body.buyerEmail.trim() : "";
  if (!buyerEmail || !CHECKOUT_EMAIL_RE.test(buyerEmail)) {
    fields.buyerEmail = "Valid email is required";
  }

  if (Object.keys(fields).length > 0) {
    return { fields };
  }

  return {
    fields: {},
    normalized: {
      eventId: body.eventId as string,
      quantity,
      buyerName,
      buyerEmail,
    },
  };
}
