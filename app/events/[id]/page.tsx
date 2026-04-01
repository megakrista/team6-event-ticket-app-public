import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { capitalize, formatDateTime, formatPrice } from "@/lib/format-helpers";
import { getEventById } from "@/services/eventservices";
import EventImage from "@/ui/components/EventImage";

const getEvent = cache((id: string) => getEventById(id));

type EventDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: EventDetailPageProps) {
  const { id } = await params;
  const result = await getEvent(id);
  return { title: result.event?.title ?? "Event Not Found" };
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;
  const result = await getEvent(id);

  if (!result.event || result.event.status !== "PUBLISHED") {
    notFound();
  }

  const event = result.event;

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
          </div>
        </div>
      </section>
    </main>
  );
}
