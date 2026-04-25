import Link from "next/link";
import { cookies } from "next/headers";
import { getEventById } from "@/services/eventservices";
import { getSessionByToken } from "@/services/sessionservices";
import { getAllocatedSeatCount } from "@/services/ticketservices";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { getSaleAvailability } from "@/lib/event-availability";
import prisma from "@/lib/prisma";
import PaymentForm from "@/app/payment/_components/PaymentForm";

export default async function PaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string }>;
}) {
  const { eventId } = await searchParams;

  if (!eventId) {
    return <main className="p-10 text-center text-red-600">No event specified.</main>;
  }

  const result = await getEventById(eventId);

  if (result.status !== 200) {
    return <main className="p-10 text-center text-red-600">Event not found.</main>;
  }

  const event = result.event!;

  const availability = getSaleAvailability(event);
  if (!availability.ok) {
    return (
      <main className="max-w-xl mx-auto p-10 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-2">
          {availability.reason === "ended"
            ? "This event has ended"
            : "Tickets are not available"}
        </h1>
        <p className="text-sm text-slate-600 mb-6">{availability.message}.</p>
        <Link
          href="/events"
          className="inline-block rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Browse events
        </Link>
      </main>
    );
  }

  const soldCount = await getAllocatedSeatCount(event.id);

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const sessionResult = await getSessionByToken(token);

  let initialName = "";
  let initialEmail = "";

  if (sessionResult) {
    const user = await prisma.user.findUnique({
      where: { id: sessionResult.user.id },
      select: { firstName: true, lastName: true, email: true },
    });
    if (user) {
      initialName = `${user.firstName} ${user.lastName}`.trim();
      initialEmail = user.email;
    }
  }

  return (
    <main className="max-w-6xl mx-auto p-6 md:p-10 text-white border m-4 md:m-10 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 shadow-2xl">
      <Link
        href={`/events/${event.id}`}
        className="inline-flex items-center gap-1 text-sm text-blue-200 hover:text-white mb-6"
      >
        ← Back to event
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="text-left space-y-6">
          <div>
            <h1 className="text-4xl font-extrabold mb-2">{event.title}</h1>
            <p className="text-blue-100 leading-relaxed">{event.description}</p>
          </div>
          <div className="bg-white/10 p-4 rounded-lg">
            <h3 className="font-bold mb-1">Time and place:</h3>
            <p className="text-sm">
              {new Date(event.startsAt).toLocaleString()} @ {event.venue.name}
            </p>
          </div>
          <div className="text-3xl font-bold">
            Ticket: <span className="text-yellow-400">€{event.price}</span>
          </div>
          <div className="text-sm text-blue-200">
            {soldCount} / {event.capacity} tickets sold
          </div>
        </div>

        {soldCount >= event.capacity ? (
          <div className="bg-white text-slate-900 p-8 rounded-lg shadow-inner flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-500 mb-2">Sold out</p>
              <p className="text-sm text-slate-500">No tickets remaining for this event.</p>
            </div>
          </div>
        ) : (
          <PaymentForm
            event={{ id: event.id, price: event.price }}
            remainingCapacity={event.capacity - soldCount}
            initialName={initialName}
            initialEmail={initialEmail}
          />
        )}
      </div>
    </main>
  );
}
