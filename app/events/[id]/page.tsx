import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { capitalize, formatDateTime, formatPrice } from "@/lib/format-helpers";
import { getEventById } from "@/services/eventservices";
import { getAllocatedSeatCount } from "@/services/ticketservices";
import EventImage from "@/app/events/_components/EventImage";

const getEvent = cache((id: string) => getEventById(id));

type EventDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: EventDetailPageProps) {
  const { id } = await params;
  const result = await getEvent(id);

  if (result.status !== 200) {
    return { title: "Event Not Found" };
  }

  return { title: result.event.title };
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;
  const result = await getEvent(id);

  if (result.status !== 200 || result.event.status !== "PUBLISHED") {
    notFound();
  }

  const event = result.event;
  const soldCount = await getAllocatedSeatCount(event.id);
  const remaining = event.capacity - soldCount;
  const soldOut = remaining <= 0;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <section className="mx-auto max-w-3xl">
        <Link
          href="/events"
          className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← Back to events
        </Link>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <EventImage
            src={event.imageUrl}
            alt={event.title}
            className="h-64 w-full object-cover"
          />

          <div className="p-6 md:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                {capitalize(event.category)}
              </span>
            </div>

            <h1 className="mb-2 text-3xl font-bold text-zinc-900">
              {event.title}
            </h1>
            <p className="mb-6 text-2xl font-semibold text-blue-700">
              {formatPrice(event.price)}
            </p>

            <div className="mb-6 grid gap-4 rounded-lg bg-zinc-50 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Starts
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-900">
                  {formatDateTime(event.startsAt)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Ends
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-900">
                  {formatDateTime(event.endsAt)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Venue
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-900">
                  {event.venue.name}
                </p>
                <p className="text-xs text-zinc-500">{event.venue.address}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Capacity
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-900">
                  {event.capacity} seats
                </p>
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                About
              </h2>
              <p className="whitespace-pre-line text-zinc-700">
                {event.description}
              </p>
            </div>

            <div className="mt-8 flex items-center gap-4">
              {soldOut ? (
                <span className="inline-block rounded-lg bg-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-500 cursor-not-allowed">
                  Sold out
                </span>
              ) : (
                <Link
                  href={`/payment?eventId=${event.id}`}
                  className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  Buy Tickets — {formatPrice(event.price)}
                </Link>
              )}
              <span className="text-sm text-zinc-500">
                {soldOut ? "No tickets remaining" : `${remaining} ticket${remaining !== 1 ? "s" : ""} left`}
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
