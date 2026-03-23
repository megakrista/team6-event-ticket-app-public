import prisma from "@/lib/prisma";
import { type EventResponse } from "@/types/eventtype";

export async function listEvents(): Promise<EventResponse[]> {
  // Fetch events with venue information
  const rawEvents = await prisma.event.findMany({
    include: {
      venue: {
        select: {
          id: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          timezone: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: {
      startsAt: "asc",
    },
  });

  // Transform Decimal types to match EventResponse
  const events = rawEvents.map((event) => ({
    ...event,
    venue: {
      ...event.venue,
      latitude: event.venue.latitude.toNumber(),
      longitude: event.venue.longitude.toNumber(),
    },
  }));

  return events;
}
