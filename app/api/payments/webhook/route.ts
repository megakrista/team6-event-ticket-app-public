import Stripe from "stripe";
import { createOrGetPaidTicket } from "@/services/ticketservices";
import { error, success, validationError } from "@/lib/api-response";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
  if (!webhookSecret) {
    return error("Missing STRIPE_WEBHOOK_SECRET", 500);
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return validationError({ signature: "Required" }, "Missing signature");
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return error("Invalid signature", 400);
  }

  if (event.type !== "payment_intent.succeeded") {
    return success({ received: true });
  }

  const intent = event.data.object as Stripe.PaymentIntent;
  const metadata = intent.metadata ?? {};

  const eventId = metadata.eventId?.trim();
  if (!eventId) {
    return success({ received: true, skipped: true });
  }

  let attendeeName = "";
  let attendeeEmail = "";

  if (typeof intent.latest_charge === "string") {
    try {
      const charge = await stripe.charges.retrieve(intent.latest_charge);
      attendeeName = charge.billing_details?.name?.trim() ?? "";
      attendeeEmail = charge.billing_details?.email?.trim().toLowerCase() ?? "";
    } catch {
      // Fallback to metadata if charge lookup fails.
    }
  }

  attendeeName = attendeeName || "Guest attendee";
  attendeeEmail =
    attendeeEmail ||
    intent.receipt_email?.trim().toLowerCase() ||
    "unknown@example.com";

  const userId = metadata.userId?.trim() || undefined;
  const amount = intent.amount_received > 0 ? intent.amount_received : intent.amount;

  await createOrGetPaidTicket({
    amount: amount / 100,
    eventId,
    attendeeEmail,
    attendeeName,
    paymentIntentId: intent.id,
    userId,
  });

  return success({ received: true });
}
