import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { getEventById } from "@/services/eventservices";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { getSessionByToken } from "@/services/sessionservices";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    const { eventId } = (await request.json()) as { eventId?: string };

    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
    }

    const eventResult = await getEventById(eventId);
    if (eventResult.status !== 200) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const event = eventResult.event;
    if (event.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Event not available" }, { status: 400 });
    }

    const amount = Math.round(event.price * 100);

    if (!Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "This event does not require payment" },
        { status: 400 },
      );
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

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Payment error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
