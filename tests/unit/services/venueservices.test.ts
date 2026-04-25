import { beforeEach, describe, expect, it, vi } from "vitest";
import { Decimal, PrismaClientKnownRequestError } from "@prisma/client/runtime/client";

const prismaMock = vi.hoisted(() => ({
  venue: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
}));

import {
  createVenue,
  deleteVenue,
  listAdminVenues,
  listVenues,
  updateVenue,
} from "@/services/venueservices";

const VENUE_ID = "22222222-2222-2222-2222-222222222222";

function venueRow(overrides: Record<string, unknown> = {}) {
  return {
    id: VENUE_ID,
    name: "Tallinn Hall",
    address: "Main street 1",
    latitude: new Decimal("59.437"),
    longitude: new Decimal("24.7536"),
    timezone: "Europe/Tallinn",
    createdAt: new Date("2030-01-01T00:00:00.000Z"),
    updatedAt: new Date("2030-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function knownError(code: string) {
  return new PrismaClientKnownRequestError("db error", {
    code,
    clientVersion: "test",
  });
}

beforeEach(() => {
  prismaMock.venue.findMany.mockReset();
  prismaMock.venue.findFirst.mockReset();
  prismaMock.venue.create.mockReset();
  prismaMock.venue.update.mockReset();
  prismaMock.venue.delete.mockReset();
});

describe("listVenues", () => {
  it("returns normalized venue responses", async () => {
    prismaMock.venue.findMany.mockResolvedValue([venueRow()]);

    const result = await listVenues();

    expect(prismaMock.venue.findMany).toHaveBeenCalledWith({
      orderBy: { name: "asc" },
    });
    expect(result[0]?.latitude).toBeCloseTo(59.437);
    expect(result[0]?.longitude).toBeCloseTo(24.7536);
  });
});

describe("listAdminVenues", () => {
  it("returns normalized venue rows with event counts", async () => {
    prismaMock.venue.findMany.mockResolvedValue([venueRow({ _count: { events: 3 } })]);

    const result = await listAdminVenues();

    expect(prismaMock.venue.findMany).toHaveBeenCalledWith({
      orderBy: { name: "asc" },
      include: { _count: { select: { events: true } } },
    });
    expect(result[0]?._count.events).toBe(3);
    expect(result[0]?.latitude).toBeCloseTo(59.437);
  });
});

describe("createVenue", () => {
  it("returns validation errors for invalid payload", async () => {
    const result = await createVenue({
      name: "A",
      address: "x",
      latitude: 100,
      longitude: 200,
      timezone: "bad/timezone",
    });

    expect(result.status).toBe(400);
    expect("validationErrors" in result).toBe(true);
    expect(prismaMock.venue.create).not.toHaveBeenCalled();
  });

  it("returns duplicate-name validation error", async () => {
    prismaMock.venue.findFirst.mockResolvedValue({ id: VENUE_ID });

    await expect(
      createVenue({
        name: "Tallinn Hall",
        address: "Main street 1",
        latitude: 59.4,
        longitude: 24.7,
        timezone: "Europe/Tallinn",
      }),
    ).resolves.toEqual({
      status: 400,
      validationErrors: { name: "A venue with this name already exists" },
    });
  });

  it("creates venue with trimmed fields", async () => {
    prismaMock.venue.findFirst.mockResolvedValue(null);
    prismaMock.venue.create.mockResolvedValue(venueRow());

    const result = await createVenue({
      name: "  Tallinn Hall  ",
      address: " Main street 1 ",
      latitude: 59.437,
      longitude: 24.7536,
      timezone: " Europe/Tallinn ",
    });

    expect(prismaMock.venue.create).toHaveBeenCalledWith({
      data: {
        name: "Tallinn Hall",
        address: "Main street 1",
        latitude: 59.437,
        longitude: 24.7536,
        timezone: "Europe/Tallinn",
      },
    });
    expect(result.status).toBe(201);
  });

  it("maps create P2025 and P2003 errors", async () => {
    prismaMock.venue.findFirst.mockResolvedValue(null);
    prismaMock.venue.create.mockRejectedValueOnce(knownError("P2025"));

    await expect(
      createVenue({
        name: "Tallinn Hall",
        address: "Main street 1",
        latitude: 59.4,
        longitude: 24.7,
        timezone: "Europe/Tallinn",
      }),
    ).resolves.toEqual({
      status: 404,
      error: "Venue not found",
    });

    prismaMock.venue.create.mockRejectedValueOnce(knownError("P2003"));

    await expect(
      createVenue({
        name: "Tallinn Hall",
        address: "Main street 1",
        latitude: 59.4,
        longitude: 24.7,
        timezone: "Europe/Tallinn",
      }),
    ).resolves.toEqual({
      status: 409,
      error: "Cannot delete a venue that has events assigned to it",
    });
  });
});

describe("updateVenue", () => {
  it("returns 404 for invalid UUID", async () => {
    await expect(updateVenue("bad-id", {})).resolves.toEqual({
      status: 404,
      error: "Venue not found",
    });
  });

  it("returns duplicate-name validation error", async () => {
    prismaMock.venue.findFirst.mockResolvedValue({ id: "another" });

    await expect(
      updateVenue(VENUE_ID, {
        name: "Tallinn Hall",
        address: "Main street 1",
        latitude: 59.4,
        longitude: 24.7,
        timezone: "Europe/Tallinn",
      }),
    ).resolves.toEqual({
      status: 400,
      validationErrors: { name: "A venue with this name already exists" },
    });
  });

  it("updates venue and returns normalized response", async () => {
    prismaMock.venue.findFirst.mockResolvedValue(null);
    prismaMock.venue.update.mockResolvedValue(venueRow());

    const result = await updateVenue(VENUE_ID, {
      name: "Tallinn Hall",
      address: "Main street 1",
      latitude: 59.4,
      longitude: 24.7,
      timezone: "Europe/Tallinn",
    });

    expect(prismaMock.venue.update).toHaveBeenCalledWith({
      where: { id: VENUE_ID },
      data: {
        name: "Tallinn Hall",
        address: "Main street 1",
        latitude: 59.4,
        longitude: 24.7,
        timezone: "Europe/Tallinn",
      },
    });
    expect(result.status).toBe(200);
  });
});

describe("deleteVenue", () => {
  it("returns 404 for invalid UUID", async () => {
    await expect(deleteVenue("bad-id")).resolves.toEqual({
      status: 404,
      error: "Venue not found",
    });
  });

  it("deletes venue", async () => {
    prismaMock.venue.delete.mockResolvedValue(venueRow());

    const result = await deleteVenue(VENUE_ID);

    expect(prismaMock.venue.delete).toHaveBeenCalledWith({ where: { id: VENUE_ID } });
    expect(result.status).toBe(200);
  });

  it("maps unknown delete error to internal server error", async () => {
    prismaMock.venue.delete.mockRejectedValue(new Error("boom"));

    await expect(deleteVenue(VENUE_ID)).resolves.toEqual({
      status: 500,
      error: "Internal server error",
    });
  });
});
