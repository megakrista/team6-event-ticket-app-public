import Link from "next/link";
import Stripe from "stripe";
import { getTicketByPaymentIntentId } from "@/services/ticketservices";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export default async function PaymentSuccess({
  searchParams,
}: {
  searchParams: Promise<{
    payment_intent?: string;
  }>;
}) {
  const params = await searchParams;

  if (!params.payment_intent) {
    return (
      <main className="max-w-xl mx-auto p-10 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          Invalid payment link.
        </h1>
        <Link href="/events" className="text-blue-600 hover:underline text-sm">
          Browse events
        </Link>
      </main>
    );
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(
    params.payment_intent,
  );

  if (paymentIntent.status !== "succeeded") {
    return (
      <main className="max-w-xl mx-auto p-10 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          Payment was not completed.
        </h1>
        <Link href="/events" className="text-blue-600 hover:underline text-sm">
          Browse events
        </Link>
      </main>
    );
  }

  const ticket = await getTicketByPaymentIntentId(paymentIntent.id);
  const eventTitle = paymentIntent.metadata.eventTitle || "Event";
  const attendeeName = ticket?.attendeeName || "Guest";
  const ticketNumber = ticket?.ticketNumber || "Processing";
  const amountPaid = (paymentIntent.amount_received / 100).toFixed(2);
  const isPendingTicket = !ticket;

  return (
    <main className="max-w-6xl mx-auto p-10 text-white text-center border m-10 rounded-md bg-gradient-to-tr from-blue-500 to-purple-500 shadow-2xl">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold mb-2">
          Thank you, {attendeeName}!
        </h1>
        <h2 className="text-2xl opacity-90">
          You are registered for {eventTitle}.
        </h2>
        {isPendingTicket ? (
          <p className="mt-3 text-sm text-blue-100">
            Payment succeeded. Your ticket is being finalized by webhook
            processing.
          </p>
        ) : null}

        <div className="mt-10 bg-white text-gray-800 p-6 rounded-lg shadow-xl max-w-sm mx-auto border-dashed border-2 border-purple-300">
          <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold">
            Ticket ID
          </p>
          <p className="text-3xl font-mono font-black text-purple-600 my-2">
            {ticketNumber}
          </p>
          <div className="border-t pt-4 mt-4 flex justify-between items-center">
            <div className="text-left">
              <p className="text-[10px] uppercase text-gray-400">Event</p>
              <p className="font-bold text-sm">{eventTitle}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase text-gray-400">Amount paid</p>
              <p className="font-bold text-green-600">EUR {amountPaid}</p>
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
