import { listEvents } from "@/services/eventservices";
import { getSessionByToken } from "@/services/sessionservices";
import { type EventResponse } from "@/types/eventtype";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type EventCard = {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  category: string;
  price: number;
  venueName: string;
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
  },
];

function formatStartsAt(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPrice(value: number) {
  if (value <= 0) {
    return "Free";
  }

  return new Intl.NumberFormat("en-EE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

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
  }));
}

export default async function EventsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  const activeSession = await getSessionByToken(token);

  if (!activeSession) {
    redirect("/login");
  }

  let events: EventResponse[] = [];
  let hasLoadError = false;

  try {
    events = await listEvents();
  } catch {
    hasLoadError = true;
  }

  const hasDemoData = !hasLoadError && events.length === 0;
  const eventCards = hasDemoData ? DEMO_EVENTS : toEventCards(events);

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900">Events</h1>
              <p className="mt-2 text-zinc-600">
                Browse upcoming events and pick your next ticket.
              </p>
            </div>

            <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
              {eventCards.length} event{eventCards.length === 1 ? "" : "s"}
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
            Showing demo events for UI preview. Real events will appear here once
            they are created in the database.
          </div>
        ) : null}

        {!hasLoadError && eventCards.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {eventCards.map((event) => (
              <article
                key={event.id}
                className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                    {event.category}
                  </span>
                  <span className="text-sm font-semibold text-blue-700">
                    {formatPrice(event.price)}
                  </span>
                </div>

                <h2 className="mb-2 text-lg font-semibold text-zinc-900">
                  {event.title}
                </h2>
                <p className="mb-4 text-sm text-zinc-600">
                  {getShortDescription(event.description)}
                </p>

                <div className="space-y-1 text-sm text-zinc-700">
                  <p>
                    <span className="font-medium">Starts:</span>{" "}
                    {formatStartsAt(event.startsAt)}
                  </p>
                  <p>
                    <span className="font-medium">Venue:</span> {event.venueName}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
