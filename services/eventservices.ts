import { Prisma } from "@/app/generated/prisma";
import prisma from "@/lib/prisma";
import {
  VALID_CATEGORIES,
  type CreateEventBody,
  type EventResponse,
  type EventValidationErrors,
} from "@/types/eventtype";

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

function serializeEvent(event: EventWithVenue): EventResponse {
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
  body: CreateEventBody,
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

export async function createEvent(body: CreateEventBody, createdById: string) {
  const errors = validateCreateEventBody(body);

  if (Object.keys(errors).length > 0) {
    return { status: 400, validationErrors: errors };
  }

  try {
    const event = await prisma.event.create({
      data: {
        title: body.title!.trim(),
        description: body.description!.trim(),
        category: body.category!.trim(),
        imageUrl: body.imageUrl || null,
        startsAt: new Date(body.startsAt!),
        endsAt: new Date(body.endsAt!),
        price: body.price!,
        capacity: body.capacity!,
        status: "DRAFT",
        venueId: body.venueId!,
        createdById,
      },
      include: EVENT_INCLUDE,
    });

    return { status: 201, event: serializeEvent(event) };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2003"
    ) {
      const field = (err.meta?.field_name as string) || "";
      if (field.includes("venueId")) {
        return { status: 400, error: "Venue not found" };
      }
      if (field.includes("createdById")) {
        return { status: 400, error: "User not found" };
      }
      return { status: 400, error: "Invalid reference" };
    }

    return { status: 500, error: "Internal server error" };
  }
}

export async function getEventById(id: string) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: EVENT_INCLUDE,
  });

  if (!event) {
    return { status: 404, error: "Event not found" };
  }

  return { status: 200, event: serializeEvent(event) };
}

export async function listEvents(): Promise<EventResponse[]> {
  const rawEvents = await prisma.event.findMany({
    include: EVENT_INCLUDE,
    orderBy: { startsAt: "asc" },
  });

  return rawEvents.map((event) => serializeEvent(event));
}
