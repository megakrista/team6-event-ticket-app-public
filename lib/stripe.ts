import Stripe from "stripe";

/** Shared server-side Stripe client for API routes and server components. */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
