import { VenueResponse } from '@/types/venuetype'
import { Decimal } from '@prisma/client/runtime/client';

export type EventResponse = {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  price: Decimal;
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

