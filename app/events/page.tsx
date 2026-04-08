import { cookies } from "next/headers";
import { Suspense } from "react";
import Link from "next/link";
import { listEvents, EVENTS_PER_PAGE } from "@/services/eventservices";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { getSessionByToken } from "@/services/sessionservices";
import { type EventResponse } from "@/types/eventtype";
import EventFilterBar from "@/ui/components/EventFilterBar";
import Pagination from "@/ui/components/Pagination";
import { capitalize, formatDateTime, formatPrice } from "@/lib/format-helpers";
import EventImage from "@/ui/components/EventImage";

export const dynamic = "force-dynamic";

type EventCard = {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  category: string;
  price: number;
  venueName: string;
  imageUrl: string | null;
};

const DEMO_EVENTS: EventCard[] = [
  {
    id: "demo-1",
    title: "Tallinn Summer Music Night",
    description:
      "An open-air evening with local bands, food stalls, and a coastal sunset stage setup.",
    startsAt: new Date("2026-06-14T19:00:00+03:00"),
    category: "concert",
    price: 29.9,
    venueName: "Noblessner Port Stage",
    imageUrl: null,
  },
  {
    id: "demo-2",
    title: "Frontend Builders Meetup",
    description:
      "Practical talks on React, design systems, and testing workflows for modern product teams.",
    startsAt: new Date("2026-05-22T18:30:00+03:00"),
    category: "conference",
    price: 0,
    venueName: "Tallinn Creative Hub",
    imageUrl: null,
  },
  {
    id: "demo-3",
    title: "City Derby: North vs South",
    description:
      "Weekend football clash with pre-game fan zone and family section access included.",
    startsAt: new Date("2026-07-05T16:00:00+03:00"),
    category: "sports",
    price: 18.5,
    venueName: "Kadriorg Arena",
    imageUrl: null,
  },
];

function getShortDescription(text: string) {
  if (text.length <= 140) {
    return text;
  }

  return `${text.slice(0, 137)}...`;
}

function toEventCards(events: EventResponse[]): EventCard[] {
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    startsAt: new Date(event.startsAt),
    category: event.category,
    price: event.price,
    venueName: event.venue.name,
    imageUrl: event.imageUrl,
  }));
}

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

type EventsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const raw = await searchParams;
  const filters = {
    search: firstParam(raw.search),
    category: firstParam(raw.category),
    dateFrom: firstParam(raw.dateFrom),
  };
  const page = Math.max(1, parseInt(firstParam(raw.page) ?? "1", 10) || 1);

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const sessionResult = await getSessionByToken(token);
  const isAdmin = sessionResult?.user.role === "ADMIN";

  let events: EventResponse[] = [];
  let total = 0;
  let hasLoadError = false;

  try {
    const result = await listEvents({ ...filters, page });
    events = result.events;
    total = result.total;
  } catch {
    hasLoadError = true;
  }

  const hasActiveFilters = !!(
    filters.search ||
    filters.category ||
    filters.dateFrom
  );
  const hasDemoData = !hasLoadError && total === 0 && !hasActiveFilters;
  const eventCards = hasDemoData ? DEMO_EVENTS : toEventCards(events);
  const totalPages = Math.ceil(total / EVENTS_PER_PAGE);

  function buildPaginationHref(p: number) {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.category) params.set("category", filters.category);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/events?${qs}` : "/events";
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-sm font-medium uppercase tracking-wide text-blue-700">
                Event Ticket App
              </p>
              <h1 className="text-3xl font-bold text-zinc-900">Events</h1>
              <p className="mt-2 text-zinc-600">
                Browse upcoming events and pick your next ticket.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
                {eventCards.length} event{eventCards.length === 1 ? "" : "s"}
              </div>
              {isAdmin ? (
                <>
                  <Link
                    href="/admin/events"
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    Manage events
                  </Link>
                  <Link
                    href="/admin/events/create"
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Create event
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {hasLoadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Could not load events right now. Please try again.
          </div>
        ) : null}

        {hasDemoData ? (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Showing demo events for UI preview. Real events will appear here
            once they are created in the database.
          </div>
        ) : null}

        {!hasDemoData && (
          <Suspense
            fallback={
              <div className="mb-6 h-20 animate-pulse rounded-xl bg-zinc-100" />
            }
          >
            <EventFilterBar />
          </Suspense>
        )}

        {!hasLoadError && events.length === 0 && hasActiveFilters ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center text-zinc-500">
            No events match your filters.
          </div>
        ) : null}

        {!hasLoadError && eventCards.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {eventCards.map((event) =>
              hasDemoData ? (
                <article
                  key={event.id}
                  className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                      {capitalize(event.category)}
                    </span>
                    <span className="text-sm font-semibold text-blue-700">
                      {formatPrice(event.price)}
                    </span>
                  </div>
                  <h2 className="mb-2 line-clamp-2 text-lg font-semibold text-zinc-900">
                    {event.title}
                  </h2>
                  <p className="mb-4 text-sm text-zinc-600">
                    {getShortDescription(event.description)}
                  </p>
                  <div className="space-y-1 text-sm text-zinc-700">
                    <p>
                      <span className="font-medium">Starts:</span>{" "}
                      {formatDateTime(event.startsAt)}
                    </p>
                    <p>
                      <span className="font-medium">Venue:</span>{" "}
                      {event.venueName}
                    </p>
                  </div>
                </article>
              ) : (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="block rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <article>
                    <div className="overflow-hidden rounded-t-xl">
                      <EventImage
                        src={event.imageUrl}
                        alt={event.title}
                        className="h-40 w-full object-cover"
                      />
                    </div>
                    <div className="p-5">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                          {capitalize(event.category)}
                        </span>
                        <span className="text-sm font-semibold text-blue-700">
                          {formatPrice(event.price)}
                        </span>
                      </div>
                      <h2 className="mb-2 line-clamp-2 text-lg font-semibold text-zinc-900">
                        {event.title}
                      </h2>
                      <p className="mb-4 text-sm text-zinc-600">
                        {getShortDescription(event.description)}
                      </p>
                      <div className="space-y-1 text-sm text-zinc-700">
                        <p>
                          <span className="font-medium">Starts:</span>{" "}
                          {formatDateTime(event.startsAt)}
                        </p>
                        <p>
                          <span className="font-medium">Venue:</span>{" "}
                          {event.venueName}
                        </p>
                      </div>
                    </div>
                  </article>
                </Link>
              ),
            )}
          </div>
        ) : null}

        {!hasDemoData && totalPages > 1 && (
          <div className="mt-8">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              buildHref={buildPaginationHref}
            />
          </div>
        )}
      </section>
    </main>
  );
}
