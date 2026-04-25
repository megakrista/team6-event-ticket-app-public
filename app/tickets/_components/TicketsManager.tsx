"use client";

import { useState } from "react";
import { capitalize, formatDateTime, formatPrice } from "@/lib/format-helpers";

export type TicketItem = {
  id: string;
  ticketNumber: string;
  attendeeName: string;
  attendeeEmail: string;
  amount: number;
  status: string;
  createdAt: string;
  event: {
    id: string;
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    category: string;
    imageUrl: string | null;
    venue: {
      name: string;
      address: string;
    };
  };
};

type TicketsManagerProps = {
  initialTickets: TicketItem[];
};

function ticketStatusClasses(status: string): string {
  if (status === "PAID") {
    return "bg-green-100 text-green-800";
  }

  if (status === "PENDING") {
    return "bg-amber-100 text-amber-800";
  }

  if (status === "CANCELLED") {
    return "bg-red-100 text-red-800";
  }

  return "bg-zinc-100 text-zinc-700";
}

export default function TicketsManager({ initialTickets }: TicketsManagerProps) {
  const [viewingId, setViewingId] = useState<string | null>(null);

  function toggleDetails(ticketId: string) {
    setViewingId((prev) => (prev === ticketId ? null : ticketId));
  }

  function closeDetails() {
    setViewingId(null);
  }

  return (
    <div className="space-y-6">
      {initialTickets.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-zinc-600">No tickets found.</p>
          <p className="mt-2 text-sm text-zinc-500">
            Purchase tickets for events to see them here.
          </p>
        </div>
      ) : null}

      {initialTickets.map((ticket) => {
        const isViewing = viewingId === ticket.id;

        return (
          <article
            key={ticket.id}
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-zinc-900">
                    {ticket.event.title}
                  </h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${ticketStatusClasses(ticket.status)}`}
                  >
                    {capitalize(ticket.status.toLowerCase())}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-600">
                  {formatDateTime(new Date(ticket.event.startsAt))} | {ticket.event.venue.name}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Ticket #{ticket.ticketNumber}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2 lg:grid-cols-4">
              <p>
                <span className="font-medium">Attendee:</span>{" "}
                {ticket.attendeeName}
              </p>
              <p>
                <span className="font-medium">Email:</span>{" "}
                {ticket.attendeeEmail}
              </p>
              <p>
                <span className="font-medium">Amount:</span>{" "}
                {formatPrice(ticket.amount)}
              </p>
              <p>
                <span className="font-medium">Purchased:</span>{" "}
                {formatDateTime(new Date(ticket.createdAt))}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => toggleDetails(ticket.id)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                {isViewing ? "Hide details" : "View details"}
              </button>
            </div>

            {isViewing ? (
              <div className="mt-5 space-y-4 rounded-lg border border-zinc-200 bg-zinc-50 p-5">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900">Event Details</h3>
                </div>

                {ticket.event.imageUrl ? (
                  <div className="overflow-hidden rounded-lg">
                    <img
                      src={ticket.event.imageUrl}
                      alt={ticket.event.title}
                      className="h-48 w-full object-cover"
                    />
                  </div>
                ) : null}

                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-zinc-900">Description</h4>
                    <p className="mt-1 text-sm text-zinc-700 whitespace-pre-wrap">
                      {ticket.event.description}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <h4 className="font-medium text-zinc-900">Category</h4>
                      <p className="mt-1 text-sm text-zinc-700">
                        {capitalize(ticket.event.category)}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium text-zinc-900">Venue</h4>
                      <p className="mt-1 text-sm text-zinc-700">
                        {ticket.event.venue.name}
                      </p>
                      <p className="text-sm text-zinc-600">
                        {ticket.event.venue.address}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium text-zinc-900">Start Time</h4>
                      <p className="mt-1 text-sm text-zinc-700">
                        {formatDateTime(new Date(ticket.event.startsAt))}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium text-zinc-900">End Time</h4>
                      <p className="mt-1 text-sm text-zinc-700">
                        {formatDateTime(new Date(ticket.event.endsAt))}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="button"
                    onClick={closeDetails}
                    className="rounded-md bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
                  >
                    Close details
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
