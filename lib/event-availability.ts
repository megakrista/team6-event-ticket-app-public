// Sale policy: PUBLISHED and endsAt > now. Change it here only; callers must
// not reimplement. Swap to startsAt if sales should close at doors.

import { EventStatus, Prisma } from "@prisma/client";

type EventAvailabilityInput = {
  status: string;
  endsAt: Date | string;
};

export type SaleBlockReason = "not_published" | "ended";

export type SaleAvailability =
  | { ok: true }
  | { ok: false; reason: SaleBlockReason; message: string };

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Per-event gate for API handlers and server components. */
export function getSaleAvailability(
  event: EventAvailabilityInput,
  now: Date = new Date(),
): SaleAvailability {
  if (event.status !== EventStatus.PUBLISHED) {
    return { ok: false, reason: "not_published", message: "Event not available" };
  }

  if (toDate(event.endsAt).getTime() <= now.getTime()) {
    return { ok: false, reason: "ended", message: "Sales for this event have closed" };
  }

  return { ok: true };
}

/** Prisma mirror of the policy for public list queries. Spread into `where`. */
export function publicEventSaleWhere(
  now: Date = new Date(),
): Prisma.EventWhereInput {
  return {
    status: EventStatus.PUBLISHED,
    endsAt: { gt: now },
  };
}
