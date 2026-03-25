import { type VenueResponse } from "@/types/venuetype";

export const VALID_CATEGORIES = [
  "concert",
  "conference",
  "workshop",
  "sports",
  "theatre",
  "cinema",
  "other",
] as const;

export type EventCategory = (typeof VALID_CATEGORIES)[number];

export type EventResponse = {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  price: number;
  imageUrl: string | null;
  category: string;
  status: string;
  version: number;
  venueId: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  venue: VenueResponse;
};

export type CreateEventBody = {
  title?: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  startsAt?: string;
  endsAt?: string;
  price?: number;
  capacity?: number;
  venueId?: string;
  createdById?: string; // TODO: replace with auth session user
};

export type EventValidationErrors = {
  [field: string]: string;
};
