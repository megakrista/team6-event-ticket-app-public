import { describe, expect, it } from "vitest";

import { toVenueWriteResponse } from "@/app/api/venues/venue-write-response";

describe("toVenueWriteResponse", () => {
  it("maps validation failure to 400 validation payload", async () => {
    const response = toVenueWriteResponse({
      status: 400,
      validationErrors: {
        name: "Required",
      },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Validation failed",
      fields: { name: "Required" },
    });
  });

  it("maps write error to error payload with service status", async () => {
    const response = toVenueWriteResponse({
      status: 409,
      error: "Cannot delete a venue that has events assigned to it",
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Cannot delete a venue that has events assigned to it",
    });
  });

  it("maps success result to venue envelope and status", async () => {
    const createdAt = new Date("2030-01-01T00:00:00.000Z");
    const updatedAt = new Date("2030-01-01T00:00:00.000Z");
    const response = toVenueWriteResponse({
      status: 201,
      venue: {
        id: "v1",
        name: "Tallinn Hall",
        address: "Main street 1",
        latitude: 59.437,
        longitude: 24.7536,
        timezone: "Europe/Tallinn",
        createdAt,
        updatedAt,
      },
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      venue: {
        id: "v1",
        name: "Tallinn Hall",
        address: "Main street 1",
        latitude: 59.437,
        longitude: 24.7536,
        timezone: "Europe/Tallinn",
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
    });
  });
});
