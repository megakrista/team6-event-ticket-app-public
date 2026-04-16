import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { getEventById } from "@/services/eventservices";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { getSessionByToken } from "@/services/sessionservices";
import { error, success, validationError } from "@/lib/api-response";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    const { eventId } = (await request.json()) as { eventId?: string };
    const normalizedEventId = typeof eventId === "string" ? eventId.trim() : "";

    if (!normalizedEventId) {
      return validationError({ eventId: "Required" }, "Invalid event id");
    }

    const eventResult = await getEventById(normalizedEventId);
    if (eventResult.status !== 200) {
      return error(eventResult.error, eventResult.status);
    }

    const event = eventResult.event;
    if (event.status !== "PUBLISHED") {
      return error("Event not available", 400);
    }

    const amount = Math.round(event.price * 100);

    if (!Number.isInteger(amount) || amount <= 0) {
      return error("This event does not require payment", 400);
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const sessionResult = await getSessionByToken(token);
    const userId = sessionResult?.user.id;

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "eur",
      automatic_payment_methods: { enabled: true },
      metadata: {
        eventId: event.id,
        eventTitle: event.title,
        ...(userId ? { userId } : {}),
      },
    });

    return success({ clientSecret: paymentIntent.client_secret });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Payment error";
    return error(message, 500);
  }
}
