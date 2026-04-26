import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventStatus, Prisma } from "@prisma/client";

import type { EventInput } from "@/types/eventtype";

const prismaEventMock = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: { event: prismaEventMock },
}));

import {
  EVENTS_PER_PAGE,
  createEvent,
  deleteEvent,
  getEventById,
  listAdminEvents,
  listEvents,
  updateEvent,
  updateEventStatus,
  validateCreateEventBody,
} from "@/services/eventservices";

const USER_ID = "33333333-3333-3333-3333-333333333333";
const EVENT_ID = "11111111-1111-1111-1111-111111111111";
const VENUE_ID = "22222222-2222-2222-2222-222222222222";

function makeValidInput(overrides: Partial<EventInput> = {}): EventInput {
  const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const endsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  return {
    title: "Spring Music Night",
    description: "Live show with local artists.",
    category: "concert",
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    price: 25,
    capacity: 120,
    venueId: VENUE_ID,
    ...overrides,
  };
}

function makeDbEvent(overrides: Record<string, unknown> = {}) {
  const base = {
    id: EVENT_ID,
    title: "Spring Music Night",
    description: "Live show with local artists.",
    category: "concert",
    imageUrl: null,
    startsAt: new Date("2030-06-01T18:00:00.000Z"),
    endsAt: new Date("2030-06-01T21:00:00.000Z"),
    price: new Prisma.Decimal("25.50"),
    capacity: 120,
    status: EventStatus.DRAFT,
    version: 1,
    venueId: VENUE_ID,
    createdById: USER_ID,
    createdAt: new Date("2030-01-01T10:00:00.000Z"),
    updatedAt: new Date("2030-01-01T10:00:00.000Z"),
    venue: {
      id: VENUE_ID,
      name: "Tallinn Hall",
      address: "Street 1",
      latitude: new Prisma.Decimal("59.4370"),
      longitude: new Prisma.Decimal("24.7536"),
      timezone: "Europe/Tallinn",
      createdAt: new Date("2030-01-01T10:00:00.000Z"),
      updatedAt: new Date("2030-01-01T10:00:00.000Z"),
    },
    createdBy: {
      id: USER_ID,
      firstName: "Ada",
      lastName: "Lovelace",
    },
  };

  const next = { ...base, ...overrides };
  const venueOverride = (overrides.venue as Record<string, unknown> | undefined) ?? {};
  const createdByOverride =
    (overrides.createdBy as Record<string, unknown> | undefined) ?? {};

  return {
    ...next,
    venue: { ...base.venue, ...venueOverride },
    createdBy: { ...base.createdBy, ...createdByOverride },
  };
}

function prismaKnownError(
  code: string,
  fieldName?: string,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("db error", {
    code,
    clientVersion: "test",
    ...(fieldName ? { meta: { field_name: fieldName } } : {}),
  });
}

beforeEach(() => {
  for (const fn of Object.values(prismaEventMock)) {
    fn.mockReset();
  }
});

describe("validateCreateEventBody", () => {
  it("returns no errors for a valid payload", () => {
    const errors = validateCreateEventBody(makeValidInput());
    expect(errors).toEqual({});
  });

  it("returns required errors for missing mandatory fields", () => {
    const errors = validateCreateEventBody({});

    expect(errors).toMatchObject({
      title: "Required",
      description: "Required",
      category: "Required",
      startsAt: "Required",
      endsAt: "Required",
      price: "Required",
      capacity: "Required",
      venueId: "Required",
    });
  });

  it("returns validation errors for invalid business values", () => {
    const errors = validateCreateEventBody(
      makeValidInput({
        category: "invalid-category",
        startsAt: new Date(Date.now() - 60 * 1000).toISOString(),
        endsAt: new Date(Date.now() - 90 * 1000).toISOString(),
        price: -1,
        capacity: 0,
        imageUrl: 123 as unknown as string,
      }),
    );

    expect(errors.category).toContain("Invalid category");
    expect(errors.startsAt).toBe("Must be in the future");
    expect(errors.endsAt).toBe("Must be after start time");
    expect(errors.price).toBe("Must be 0 or greater");
    expect(errors.capacity).toBe("Must be at least 1");
    expect(errors.imageUrl).toBe("Must be a string");
  });

  it("validates max lengths, invalid dates, number type and whole-number capacity", () => {
    const errors = validateCreateEventBody(
      makeValidInput({
        title: "x".repeat(201),
        description: "y".repeat(5001),
        startsAt: "not-a-date",
        endsAt: "also-not-a-date",
        price: Number.NaN,
        capacity: 1.5,
      }),
    );

    expect(errors.title).toBe("Must be 200 characters or less");
    expect(errors.description).toBe("Must be 5000 characters or less");
    expect(errors.startsAt).toBe("Must be a valid date");
    expect(errors.endsAt).toBe("Must be a valid date");
    expect(errors.price).toBe("Must be a number");
    expect(errors.capacity).toBe("Must be a whole number");
  });

  it("allows optional imageUrl when it is a string", () => {
    const errors = validateCreateEventBody(
      makeValidInput({
        imageUrl: "https://cdn.example.com/event.png",
      }),
    );

    expect(errors.imageUrl).toBeUndefined();
  });
});

describe("createEvent", () => {
  it("returns validation errors and skips DB call when body is invalid", async () => {
    const result = await createEvent({}, USER_ID);

    expect(result.status).toBe(400);
    expect("validationErrors" in result).toBe(true);
    expect(prismaEventMock.create).not.toHaveBeenCalled();
  });

  it("creates event and normalizes DB decimals to numbers", async () => {
    prismaEventMock.create.mockResolvedValue(makeDbEvent());

    const result = await createEvent(
      makeValidInput({
        title: "  Spring Music Night  ",
        description: "  Live show with local artists.  ",
        category: "  concert  ",
      }),
      USER_ID,
    );

    expect(prismaEventMock.create).toHaveBeenCalledTimes(1);
    const callArgs = prismaEventMock.create.mock.calls[0]?.[0];
    expect(callArgs.data).toMatchObject({
      title: "Spring Music Night",
      description: "Live show with local artists.",
      category: "concert",
      status: EventStatus.DRAFT,
      createdById: USER_ID,
    });

    expect(result.status).toBe(201);
    if (result.status !== 201) {
      throw new Error("Expected create success result");
    }
    expect(result.event.price).toBeCloseTo(25.5);
    expect(result.event.venue.latitude).toBeCloseTo(59.437);
    expect(result.event.venue.longitude).toBeCloseTo(24.7536);
  });

  it("maps P2025 to not found", async () => {
    prismaEventMock.create.mockRejectedValue(prismaKnownError("P2025"));

    await expect(createEvent(makeValidInput(), USER_ID)).resolves.toEqual({
      status: 404,
      error: "Event not found",
    });
  });

  it("maps P2003 venue FK to venue not found", async () => {
    prismaEventMock.create.mockRejectedValue(prismaKnownError("P2003", "event_venueId_fkey"));

    await expect(createEvent(makeValidInput(), USER_ID)).resolves.toEqual({
      status: 400,
      error: "Venue not found",
    });
  });

  it("maps P2003 creator FK to user not found", async () => {
    prismaEventMock.create.mockRejectedValue(
      prismaKnownError("P2003", "event_createdById_fkey"),
    );

    await expect(createEvent(makeValidInput(), USER_ID)).resolves.toEqual({
      status: 400,
      error: "User not found",
    });
  });

  it("maps P2003 unknown FK to invalid reference", async () => {
    prismaEventMock.create.mockRejectedValue(prismaKnownError("P2003", "some_other_fk"));

    await expect(createEvent(makeValidInput(), USER_ID)).resolves.toEqual({
      status: 400,
      error: "Invalid reference",
    });
  });

  it("maps P2003 without field metadata to invalid reference", async () => {
    prismaEventMock.create.mockRejectedValue(prismaKnownError("P2003"));

    await expect(createEvent(makeValidInput(), USER_ID)).resolves.toEqual({
      status: 400,
      error: "Invalid reference",
    });
  });

  it("maps unexpected errors to internal server error", async () => {
    prismaEventMock.create.mockRejectedValue(new Error("boom"));

    await expect(createEvent(makeValidInput(), USER_ID)).resolves.toEqual({
      status: 500,
      error: "Internal server error",
    });
  });

  it("maps unknown Prisma known error code to internal server error", async () => {
    prismaEventMock.create.mockRejectedValue(prismaKnownError("P9999"));

    await expect(createEvent(makeValidInput(), USER_ID)).resolves.toEqual({
      status: 500,
      error: "Internal server error",
    });
  });
});

describe("updateEvent", () => {
  it("updates event and returns status 200 on success", async () => {
    prismaEventMock.update.mockResolvedValue(makeDbEvent({ title: "Updated title" }));

    const result = await updateEvent(EVENT_ID, makeValidInput({ title: " Updated title " }));

    expect(prismaEventMock.update).toHaveBeenCalledTimes(1);
    expect(prismaEventMock.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: EVENT_ID },
      data: { title: "Updated title" },
    });
    expect(result.status).toBe(200);
  });

  it("returns validation errors when update body is invalid", async () => {
    const result = await updateEvent(EVENT_ID, {});

    expect(result.status).toBe(400);
    expect("validationErrors" in result).toBe(true);
    expect(prismaEventMock.update).not.toHaveBeenCalled();
  });
});

describe("deleteEvent", () => {
  it("deletes event and normalizes numeric fields", async () => {
    prismaEventMock.delete.mockResolvedValue(makeDbEvent());

    const result = await deleteEvent(EVENT_ID);

    expect(prismaEventMock.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: EVENT_ID } }),
    );
    expect(result.status).toBe(200);
    if (result.status !== 200) {
      throw new Error("Expected delete success result");
    }
    expect(result.event.price).toBeCloseTo(25.5);
  });

  it("maps delete P2025 to not found", async () => {
    prismaEventMock.delete.mockRejectedValue(prismaKnownError("P2025"));

    await expect(deleteEvent(EVENT_ID)).resolves.toEqual({
      status: 404,
      error: "Event not found",
    });
  });
});

describe("updateEventStatus", () => {
  it("returns 404 for invalid UUID without touching DB", async () => {
    const result = await updateEventStatus("not-a-uuid", { status: "published" });

    expect(result).toEqual({ status: 404, error: "Event not found" });
    expect(prismaEventMock.update).not.toHaveBeenCalled();
  });

  it("returns validation error when status is missing", async () => {
    const result = await updateEventStatus(EVENT_ID, {});

    expect(result).toEqual({
      status: 400,
      validationErrors: { status: "Required" },
    });
  });

  it("returns validation error when status value is invalid", async () => {
    const result = await updateEventStatus(EVENT_ID, { status: "cancelled" });

    expect(result).toEqual({
      status: 400,
      validationErrors: {
        status: "Invalid status. Must be one of: draft, published",
      },
    });
  });

  it("normalizes status and persists update", async () => {
    prismaEventMock.update.mockResolvedValue(
      makeDbEvent({
        status: EventStatus.PUBLISHED,
      }),
    );

    const result = await updateEventStatus(EVENT_ID, { status: "  published " });

    expect(prismaEventMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: EVENT_ID },
        data: { status: EventStatus.PUBLISHED },
      }),
    );
    expect(result.status).toBe(200);
  });

  it("maps DB known error from status update", async () => {
    prismaEventMock.update.mockRejectedValue(prismaKnownError("P2025"));

    await expect(updateEventStatus(EVENT_ID, { status: "draft" })).resolves.toEqual({
      status: 404,
      error: "Event not found",
    });
  });
});

describe("listAdminEvents", () => {
  it("returns all events sorted and normalized", async () => {
    prismaEventMock.findMany.mockResolvedValue([makeDbEvent()]);

    const result = await listAdminEvents();

    expect(prismaEventMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.price).toBeCloseTo(25.5);
  });
});

describe("getEventById", () => {
  it("returns 404 when id is not UUID", async () => {
    const result = await getEventById("bad-id");

    expect(result).toEqual({ status: 404, error: "Event not found" });
    expect(prismaEventMock.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when event does not exist", async () => {
    prismaEventMock.findUnique.mockResolvedValue(null);

    const result = await getEventById(EVENT_ID);

    expect(result).toEqual({ status: 404, error: "Event not found" });
  });

  it("returns event when found", async () => {
    prismaEventMock.findUnique.mockResolvedValue(makeDbEvent());

    const result = await getEventById(EVENT_ID);

    expect(result.status).toBe(200);
    if (result.status !== 200) {
      throw new Error("Expected get-by-id success result");
    }
    expect(result.event.id).toBe(EVENT_ID);
    expect(result.event.price).toBeCloseTo(25.5);
  });
});

describe("listEvents", () => {
  it("uses default paging/filter settings", async () => {
    prismaEventMock.findMany.mockResolvedValue([makeDbEvent({ status: EventStatus.PUBLISHED })]);
    prismaEventMock.count.mockResolvedValue(1);

    const result = await listEvents();

    expect(result.total).toBe(1);
    expect(result.events).toHaveLength(1);

    expect(prismaEventMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: EventStatus.PUBLISHED,
          endsAt: {
            gt: expect.any(Date),
          },
        }),
        skip: 0,
        take: EVENTS_PER_PAGE,
      }),
    );
    expect(prismaEventMock.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: EventStatus.PUBLISHED,
        endsAt: {
          gt: expect.any(Date),
        },
      }),
    });
  });

  it("applies search, category, date and page filters", async () => {
    prismaEventMock.findMany.mockResolvedValue([makeDbEvent({ status: EventStatus.PUBLISHED })]);
    prismaEventMock.count.mockResolvedValue(1);

    await listEvents({
      search: "music",
      category: "concert",
      dateFrom: "2030-06-01",
      page: 2,
    });

    const findManyArgs = prismaEventMock.findMany.mock.calls[0]?.[0];
    expect(findManyArgs.skip).toBe(EVENTS_PER_PAGE);
    expect(findManyArgs.take).toBe(EVENTS_PER_PAGE);
    expect(findManyArgs.where.status).toBe(EventStatus.PUBLISHED);
    expect(findManyArgs.where.category).toBe("concert");
    expect(findManyArgs.where.OR).toHaveLength(4);
    expect(findManyArgs.where.startsAt.gte).toBeInstanceOf(Date);
  });

  it("ignores invalid category and invalid date filter", async () => {
    prismaEventMock.findMany.mockResolvedValue([]);
    prismaEventMock.count.mockResolvedValue(0);

    await listEvents({
      category: "invalid",
      dateFrom: "not-a-date",
      page: 0,
    });

    const findManyArgs = prismaEventMock.findMany.mock.calls[0]?.[0];
    expect(findManyArgs.where).toEqual(
      expect.objectContaining({
        status: EventStatus.PUBLISHED,
        endsAt: {
          gt: expect.any(Date),
        },
      }),
    );
    expect(findManyArgs.where.category).toBeUndefined();
    expect(findManyArgs.where.startsAt).toBeUndefined();
    expect(findManyArgs.skip).toBe(0);
    expect(findManyArgs.take).toBe(EVENTS_PER_PAGE);
  });
});
