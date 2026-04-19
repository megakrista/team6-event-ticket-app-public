import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { error, success, validationError } from "@/lib/api-response";
import { stripe } from "@/lib/stripe";
import { validateCheckoutBody } from "@/lib/checkout-constants";
import { getEventById } from "@/services/eventservices";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { getSessionByToken } from "@/services/sessionservices";
import { checkoutRateLimitExceeded, clientIpFromRequest } from "@/lib/checkout-rate-limit";
import { getAllocatedSeatCount } from "@/services/ticketservices";
import { createCheckoutOrderAndPaymentIntent } from "@/services/orderservices";

export async function POST(request: NextRequest) {
  try {
    const ip = clientIpFromRequest(request);
    if (checkoutRateLimitExceeded(`checkout:${ip}`)) {
      return error("Too many checkout attempts. Try again later.", 429);
    }

    const body = (await request.json()) as Parameters<typeof validateCheckoutBody>[0];
    const { fields, normalized } = validateCheckoutBody(body);
    if (!normalized) {
      return validationError(fields);
    }

    const { eventId, quantity, buyerName, buyerEmail } = normalized;

    const eventResult = await getEventById(eventId);
    if (eventResult.status !== 200) {
      return error("Event not found", 404);
    }

    const event = eventResult.event;
    if (event.status !== "PUBLISHED") {
      return error("Event not available", 400);
    }

    const perTicketCents = Math.round(event.price * 100);
    if (!Number.isInteger(perTicketCents) || perTicketCents <= 0) {
      return error("This event does not require payment", 400);
    }

    const allocated = await getAllocatedSeatCount(event.id);
    const remaining = event.capacity - allocated;
    if (remaining < quantity) {
      return error(
        remaining <= 0 ? "Event is sold out" : `Only ${remaining} ticket(s) remaining`,
        409,
      );
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const sessionResult = await getSessionByToken(token);
    const userId = sessionResult?.user?.id;

    const checkout = await createCheckoutOrderAndPaymentIntent(stripe, {
      eventId: event.id,
      quantity,
      pricePerTicketEur: event.price,
      userId,
      buyerName,
      buyerEmail,
    });

    if (!checkout.ok) {
      return error(checkout.error, 500);
    }

    return success({
      clientSecret: checkout.clientSecret,
      orderId: checkout.orderId,
      totalAmount: checkout.totalAmountCents,
      perTicketPrice: checkout.perTicketPriceCents,
      quantity: checkout.quantity,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Payment error";
    return error(message, 500);
  }
}
