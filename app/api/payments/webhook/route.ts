import Stripe from "stripe";
import { error, success } from "@/lib/api-response";
import { stripe } from "@/lib/stripe";
import {
  fulfillOrderFromSucceededPaymentIntent,
  markOrderAndPaymentFailedFromIntent,
} from "@/services/orderservices";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
  if (!webhookSecret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET is not set");
    return error("Missing STRIPE_WEBHOOK_SECRET", 500);
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return error("Missing signature", 400);
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return error("Invalid signature", 400);
  }

  if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
    const intent = event.data.object as Stripe.PaymentIntent;
    await markOrderAndPaymentFailedFromIntent(intent);
    return success({ received: true });
  }

  if (event.type !== "payment_intent.succeeded") {
    return success({ received: true });
  }

  const intent = event.data.object as Stripe.PaymentIntent;

  const result = await fulfillOrderFromSucceededPaymentIntent(intent);
  if (!result.ok) {
    console.error(`[webhook] fulfillOrder: ${result.message} (retryable=${result.retryable})`);
    if (result.retryable) {
      return error(result.message, 500);
    }
    return success({ received: true, skipped: true });
  }

  return success({ received: true });
}
