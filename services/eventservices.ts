import { EventStatus, Prisma } from "@/app/generated/prisma";
import prisma from "@/lib/prisma";
import {
  VALID_CATEGORIES,
  type EventInput,
  type EventCategory,
  type EventResponse,
  type EventValidationErrors,
} from "@/types/eventtype";

export const EVENTS_PER_PAGE = 9;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ListEventsParams = {
  search?: string;
  category?: string;
  dateFrom?: string;
  page?: number;
};

const EVENT_INCLUDE = {
  venue: true,
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
} as const;

type EventWithVenue = Prisma.EventGetPayload<{
  include: typeof EVENT_INCLUDE;
}>;

type EventValidationFailure = {
  status: 400;
  validationErrors: EventValidationErrors;
};

type EventWriteError =
  | { status: 400; error: "Venue not found" | "User not found" | "Invalid reference" }
  | { status: 404; error: "Event not found" }
  | { status: 500; error: "Internal server error" };

type EventWriteSuccess = {
  status: 200 | 201;
  event: EventResponse;
};

export type EventWriteResult = EventValidationFailure | EventWriteError | EventWriteSuccess;

function validateEventInput(event: EventWithVenue): EventResponse {
  return {
    ...event,
    price: Number(event.price),
    venue: {
      ...event.venue,
      latitude: Number(event.venue.latitude),
      longitude: Number(event.venue.longitude),
    },
  };
}

export function validateCreateEventBody(
  body: EventInput,
): EventValidationErrors {
  const errors: EventValidationErrors = {};

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    errors.title = "Required";
  } else if (title.length > 200) {
    errors.title = "Must be 200 characters or less";
  }

  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  if (!description) {
    errors.description = "Required";
  } else if (description.length > 5000) {
    errors.description = "Must be 5000 characters or less";
  }

  const category = typeof body.category === "string" ? body.category.trim() : "";
  if (!category) {
    errors.category = "Required";
  } else if (
    !VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])
  ) {
    errors.category = `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`;
  }

  if (body.imageUrl !== undefined && body.imageUrl !== null && body.imageUrl !== "") {
    if (typeof body.imageUrl !== "string") {
      errors.imageUrl = "Must be a string";
    }
  }

  const startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (!body.startsAt) {
    errors.startsAt = "Required";
  } else if (!startsAt || isNaN(startsAt.getTime())) {
    errors.startsAt = "Must be a valid date";
  } else if (startsAt <= new Date()) {
    errors.startsAt = "Must be in the future";
  }

  const endsAt = body.endsAt ? new Date(body.endsAt) : null;
  if (!body.endsAt) {
    errors.endsAt = "Required";
  } else if (!endsAt || isNaN(endsAt.getTime())) {
    errors.endsAt = "Must be a valid date";
  } else if (startsAt && endsAt && endsAt <= startsAt) {
    errors.endsAt = "Must be after start time";
  }

  if (body.price === undefined || body.price === null) {
    errors.price = "Required";
  } else if (typeof body.price !== "number" || isNaN(body.price)) {
    errors.price = "Must be a number";
  } else if (body.price < 0) {
    errors.price = "Must be 0 or greater";
  }

  if (body.capacity === undefined || body.capacity === null) {
    errors.capacity = "Required";
  } else if (
    typeof body.capacity !== "number" ||
    !Number.isInteger(body.capacity)
  ) {
    errors.capacity = "Must be a whole number";
  } else if (body.capacity < 1) {
    errors.capacity = "Must be at least 1";
  }

  if (!body.venueId || typeof body.venueId !== "string") {
    errors.venueId = "Required";
  }

  return errors;
}

function mapEventWriteError(err: unknown): EventWriteError {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") {
      return { status: 404, error: "Event not found" };
    }

    if (err.code === "P2003") {
      const field = String(err.meta?.field_name ?? "");
      if (field.includes("venueId")) {
        return { status: 400, error: "Venue not found" };
      }
      if (field.includes("createdById")) {
        return { status: 400, error: "User not found" };
      }

      return { status: 400, error: "Invalid reference" };
    }
  }

  return { status: 500, error: "Internal server error" };
}

async function runEventWrite(
  body: EventInput,
  successStatus: 200 | 201,
  op: () => Promise<EventWithVenue>,
): Promise<EventWriteResult> {
  const validationErrors = validateCreateEventBody(body);
  if (Object.keys(validationErrors).length > 0) {
    return { status: 400, validationErrors };
  }

  try {
    const event = await op();
    return { status: successStatus, event: validateEventInput(event) };
  } catch (err) {
    return mapEventWriteError(err);
  }
}

export async function createEvent(
  body: EventInput,
  createdById: string,
): Promise<EventWriteResult> {
  return runEventWrite(body, 201, () =>
    prisma.event.create({
      data: {
        title: body.title!.trim(),
        description: body.description!.trim(),
        category: body.category!.trim(),
        imageUrl: body.imageUrl || null,
        startsAt: new Date(body.startsAt!),
        endsAt: new Date(body.endsAt!),
        price: body.price!,
        capacity: body.capacity!,
        status: EventStatus.DRAFT,
        venueId: body.venueId!,
        createdById,
      },
      include: EVENT_INCLUDE,
    }),
  );
}

export async function updateEvent(
  id: string,
  body: EventInput,
): Promise<EventWriteResult> {
  return runEventWrite(body, 200, () =>
    prisma.event.update({
      where: { id },
      data: {
        title: body.title!.trim(),
        description: body.description!.trim(),
        category: body.category!.trim(),
        imageUrl: body.imageUrl || null,
        startsAt: new Date(body.startsAt!),
        endsAt: new Date(body.endsAt!),
        price: body.price!,
        capacity: body.capacity!,
        venueId: body.venueId!,
      },
      include: EVENT_INCLUDE,
    }),
  );
}


export async function getEventById(id: string) {
  if (!UUID_RE.test(id)) {
    return { status: 404, error: "Event not found" };
  }

  const event = await prisma.event.findUnique({
    where: { id },
    include: EVENT_INCLUDE,
  });

  if (!event) {
    return { status: 404, error: "Event not found" };
  }

  return { status: 200, event: validateEventInput(event) };
}

export async function listEvents(
  params: ListEventsParams = {},
): Promise<{ events: EventResponse[]; total: number }> {
  const page = Math.max(1, Number.isFinite(params.page) ? params.page! : 1);
  const skip = (page - 1) * EVENTS_PER_PAGE;
  const dateFrom = params.dateFrom ? new Date(params.dateFrom + "T00:00:00.000Z") : null;

  const where: Prisma.EventWhereInput = {
    status: EventStatus.PUBLISHED,
    ...(params.search && {
      OR: [
        { title: { contains: params.search, mode: "insensitive" } },
        { description: { contains: params.search, mode: "insensitive" } },
        { venue: { name: { contains: params.search, mode: "insensitive" } } },
        { venue: { address: { contains: params.search, mode: "insensitive" } } },
      ],
    }),
    ...(params.category && VALID_CATEGORIES.includes(params.category as EventCategory) && {
      category: params.category,
    }),
    ...(dateFrom && !isNaN(dateFrom.getTime()) && {
      startsAt: { gte: dateFrom },
    }),
  };

  const [rawEvents, total] = await Promise.all([
    prisma.event.findMany({
      where,
      include: EVENT_INCLUDE,
      orderBy: { startsAt: "asc" },
      skip,
      take: EVENTS_PER_PAGE,
    }),
    prisma.event.count({ where }),
  ]);

  return { events: rawEvents.map((event) => validateEventInput(event)), total };
}
