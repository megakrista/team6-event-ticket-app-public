import crypto from "node:crypto";
import Link from "next/link";
import Stripe from "stripe";
import { cookies } from "next/headers";
import { saveTicketToDatabase } from "@/services/ticketservices";
import { getSessionByToken } from "@/services/sessionservices";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PaymentSuccess({
  searchParams,
}: {
  searchParams: Promise<{
    amount?: string;
    eventId?: string;
    eventTitle?: string;
    email?: string;
    name?: string;
    payment_intent?: string;
  }>;
}) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const params = await searchParams;

  if (!params.payment_intent) {
    return (
      <main className="max-w-xl mx-auto p-10 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Invalid payment link.</h1>
        <Link href="/events" className="text-blue-600 hover:underline text-sm">
          Browse events
        </Link>
      </main>
    );
  }

  const pi = await stripe.paymentIntents.retrieve(params.payment_intent);

  if (pi.status !== "succeeded") {
    return (
      <main className="max-w-xl mx-auto p-10 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Payment was not completed.</h1>
        <Link href="/events" className="text-blue-600 hover:underline text-sm">
          Browse events
        </Link>
      </main>
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const sessionResult = await getSessionByToken(token);
  const userId = sessionResult?.user.id;

  const amount = params.amount || "0";
  const email = params.email || "";
  const name = params.name || "";
  const eventId = params.eventId || "";
  const eventTitle = params.eventTitle || "Event";
  let ticketNumber = `TKT-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

  try {
    await saveTicketToDatabase({
      amount: parseInt(amount, 10) / 100,
      ticketNumber,
      eventId,
      email,
      attendeeName: name,
      paymentIntentId: params.payment_intent,
      userId,
    });
  } catch (error: unknown) {
    const isUniqueConstraint =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002";

    if (isUniqueConstraint) {
      const existing = await prisma.ticket.findUnique({
        where: { paymentIntentId: params.payment_intent },
      });
      if (existing) ticketNumber = existing.ticketNumber;
    } else {
      console.error("Failed to save ticket:", error);
    }
  }

  return (
    <main className="max-w-6xl mx-auto p-10 text-white text-center border m-10 rounded-md bg-gradient-to-tr from-blue-500 to-purple-500 shadow-2xl">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold mb-2">Thank you, {name}!</h1>
        <h2 className="text-2xl opacity-90">You are registered for {eventTitle}.</h2>

        <div className="mt-10 bg-white text-gray-800 p-6 rounded-lg shadow-xl max-w-sm mx-auto border-dashed border-2 border-purple-300">
          <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold">Ticket ID</p>
          <p className="text-3xl font-mono font-black text-purple-600 my-2">{ticketNumber}</p>
          <div className="border-t pt-4 mt-4 flex justify-between items-center">
            <div className="text-left">
              <p className="text-[10px] uppercase text-gray-400">Event</p>
              <p className="font-bold text-sm">{eventTitle}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase text-gray-400">Amount paid</p>
              <p className="font-bold text-green-600">€{(parseInt(amount, 10) / 100).toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            href="/events"
            className="rounded-lg bg-white text-purple-700 hover:bg-white/90 transition-colors px-5 py-2 text-sm font-medium"
          >
            Browse more events
          </Link>
        </div>
      </div>
    </main>
  );
}
