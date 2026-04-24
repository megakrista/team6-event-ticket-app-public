import Link from "next/link";
import type Stripe from "stripe";
import { PaymentSuccessAutoRefresh } from "@/app/payment-success/_components/PaymentSuccessAutoRefresh";
import { getOrderByStripePaymentIntentId } from "@/services/orderservices";
import { stripe } from "@/lib/stripe";

type OrderLoaded = NonNullable<Awaited<ReturnType<typeof getOrderByStripePaymentIntentId>>>;
type TicketRow = OrderLoaded["tickets"][number];

export const dynamic = "force-dynamic";

function PaymentStatusNotice({ title }: { title: string }) {
  return (
    <main className="max-w-xl mx-auto p-10 text-center">
      <h1 className="text-2xl font-bold text-red-600 mb-4">{title}</h1>
      <Link href="/events" className="text-blue-600 hover:underline text-sm">
        Browse events
      </Link>
    </main>
  );
}

export default async function PaymentSuccess({
  searchParams,
}: {
  searchParams: Promise<{ payment_intent?: string }>;
}) {
  const params = await searchParams;

  if (!params.payment_intent) {
    return <PaymentStatusNotice title="Invalid payment link." />;
  }

  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.retrieve(params.payment_intent);
  } catch {
    return <PaymentStatusNotice title="Invalid payment link." />;
  }

  if (paymentIntent.status !== "succeeded") {
    return <PaymentStatusNotice title="Payment was not completed." />;
  }

  let order: Awaited<ReturnType<typeof getOrderByStripePaymentIntentId>> = null;
  try {
    order = await getOrderByStripePaymentIntentId(paymentIntent.id);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[payment-success] getOrderByStripePaymentIntentId: ${msg}`);
  }

  const eventTitle = order?.event.title ?? "Event";
  const quantity = order?.quantity ?? parseInt(paymentIntent.metadata.quantity || "1", 10);
  const amountPaid = order
    ? Number(order.totalAmount).toFixed(2)
    : (paymentIntent.amount_received / 100).toFixed(2);
  const attendeeName = order?.buyerName || "Guest";
  const tickets = order?.tickets ?? [];
  const isPendingTicket = tickets.length === 0;

  return (
    <main className="max-w-6xl mx-auto p-10 text-white text-center border m-10 rounded-md bg-gradient-to-tr from-blue-500 to-purple-500 shadow-2xl">
      <PaymentSuccessAutoRefresh active={isPendingTicket} />
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold mb-2">Thank you, {attendeeName}!</h1>
        <h2 className="text-2xl opacity-90">You are registered for {eventTitle}.</h2>

        {isPendingTicket ? (
          <p className="mt-3 text-sm text-blue-100">
            Payment succeeded. Your ticket{quantity > 1 ? "s are" : " is"} being finalized — this
            page will update automatically when ready (up to about a minute).
          </p>
        ) : (
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {tickets.map((ticket: TicketRow, i: number) => (
              <div
                key={ticket.id}
                className="bg-white text-gray-800 p-6 rounded-lg shadow-xl w-64 border-dashed border-2 border-purple-300"
              >
                {quantity > 1 && (
                  <p className="text-xs text-gray-400 font-medium mb-1">
                    Ticket {i + 1} of {tickets.length}
                  </p>
                )}
                <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold">
                  Ticket ID
                </p>
                <p className="text-2xl font-mono font-black text-purple-600 my-2">
                  {ticket.ticketNumber}
                </p>
                <div className="border-t pt-3 mt-3 flex justify-between items-center">
                  <div className="text-left">
                    <p className="text-[10px] uppercase text-gray-400">Event</p>
                    <p className="font-bold text-xs">{eventTitle}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-gray-400">Per ticket</p>
                    <p className="font-bold text-green-600 text-sm">
                      EUR {Number(ticket.pricePaid).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isPendingTicket && quantity > 1 && (
          <p className="mt-6 text-sm text-blue-100">
            Total paid: EUR {amountPaid} for {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
          </p>
        )}

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
