import prisma from "@/lib/prisma";
import { type VenueResponse } from "@/types/venuetype";

export async function listVenues(): Promise<VenueResponse[]> {
  const venues = await prisma.venue.findMany({
    orderBy: { name: "asc" },
  });

  return venues.map((venue) => ({
    ...venue,
    latitude: Number(venue.latitude),
    longitude: Number(venue.longitude),
  }));
}
