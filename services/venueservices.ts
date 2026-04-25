import {
  Decimal,
  PrismaClientKnownRequestError,
} from "@prisma/client/runtime/client";
import prisma from "@/lib/prisma";
import { UUID_RE } from "@/lib/uuid";
import {
  type VenueResponse,
  type VenueInput,
  type VenueValidationErrors,
  type VenueWriteResult,
} from "@/types/venuetype";

type PrismaVenue = {
  id: string;
  name: string;
  address: string;
  latitude: Decimal;
  longitude: Decimal;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
};

type AdminVenueRow = PrismaVenue & { _count: { events: number } };

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function toVenueResponse(venue: PrismaVenue): VenueResponse {
  return {
    ...venue,
    latitude: Number(venue.latitude),
    longitude: Number(venue.longitude),
  };
}

function validateVenueInput(body: VenueInput): VenueValidationErrors {
  const errors: VenueValidationErrors = {};

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    errors.name = "Required";
  } else if (name.length < 2) {
    errors.name = "Must be at least 2 characters";
  } else if (name.length > 100) {
    errors.name = "Must be 100 characters or less";
  }

  const address = typeof body.address === "string" ? body.address.trim() : "";
  if (!address) {
    errors.address = "Required";
  } else if (address.length < 5) {
    errors.address = "Must be at least 5 characters";
  } else if (address.length > 200) {
    errors.address = "Must be 200 characters or less";
  }

  const lat = parseFloat(String(body.latitude ?? ""));
  if (body.latitude === undefined || body.latitude === null) {
    errors.latitude = "Required";
  } else if (isNaN(lat)) {
    errors.latitude = "Must be a number";
  } else if (lat < -90 || lat > 90) {
    errors.latitude = "Must be between -90 and 90";
  }

  const lng = parseFloat(String(body.longitude ?? ""));
  if (body.longitude === undefined || body.longitude === null) {
    errors.longitude = "Required";
  } else if (isNaN(lng)) {
    errors.longitude = "Must be a number";
  } else if (lng < -180 || lng > 180) {
    errors.longitude = "Must be between -180 and 180";
  }

  const timezone = typeof body.timezone === "string" ? body.timezone.trim() : "";
  if (!timezone) {
    errors.timezone = "Required";
  } else if (!isValidTimezone(timezone)) {
    errors.timezone = "Must be a valid IANA timezone (e.g. Europe/Tallinn)";
  }

  return errors;
}

function mapVenueWriteError(
  err: unknown,
): Extract<VenueWriteResult, { error: string }> {
  if (err instanceof PrismaClientKnownRequestError) {
    if (err.code === "P2025") {
      return { status: 404, error: "Venue not found" };
    }
    if (err.code === "P2003") {
      return {
        status: 409,
        error: "Cannot delete a venue that has events assigned to it",
      };
    }
  }
  return { status: 500, error: "Internal server error" };
}

export async function listVenues(): Promise<VenueResponse[]> {
  const venues = await prisma.venue.findMany({
    orderBy: { name: "asc" },
  });

  return venues.map(toVenueResponse);
}

export async function listAdminVenues(): Promise<
  (VenueResponse & { _count: { events: number } })[]
> {
  const venues = await prisma.venue.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { events: true } } },
  });

  return venues.map((venue: AdminVenueRow) => ({
    ...toVenueResponse(venue),
    _count: venue._count,
  }));
}

export async function createVenue(body: VenueInput): Promise<VenueWriteResult> {
  const validationErrors = validateVenueInput(body);
  if (Object.keys(validationErrors).length > 0) {
    return { status: 400, validationErrors };
  }

  const name = body.name!.trim();
  const duplicate = await prisma.venue.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicate) {
    return {
      status: 400,
      validationErrors: { name: "A venue with this name already exists" },
    };
  }

  try {
    const venue = await prisma.venue.create({
      data: {
        name,
        address: body.address!.trim(),
        latitude: parseFloat(String(body.latitude)),
        longitude: parseFloat(String(body.longitude)),
        timezone: body.timezone!.trim(),
      },
    });
    return { status: 201, venue: toVenueResponse(venue) };
  } catch (err) {
    return mapVenueWriteError(err);
  }
}

export async function updateVenue(
  id: string,
  body: VenueInput,
): Promise<VenueWriteResult> {
  if (!UUID_RE.test(id)) {
    return { status: 404, error: "Venue not found" };
  }

  const validationErrors = validateVenueInput(body);
  if (Object.keys(validationErrors).length > 0) {
    return { status: 400, validationErrors };
  }

  const name = body.name!.trim();
  const duplicate = await prisma.venue.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, NOT: { id } },
    select: { id: true },
  });
  if (duplicate) {
    return {
      status: 400,
      validationErrors: { name: "A venue with this name already exists" },
    };
  }

  try {
    const venue = await prisma.venue.update({
      where: { id },
      data: {
        name,
        address: body.address!.trim(),
        latitude: parseFloat(String(body.latitude)),
        longitude: parseFloat(String(body.longitude)),
        timezone: body.timezone!.trim(),
      },
    });
    return { status: 200, venue: toVenueResponse(venue) };
  } catch (err) {
    return mapVenueWriteError(err);
  }
}

export async function deleteVenue(id: string): Promise<VenueWriteResult> {
  if (!UUID_RE.test(id)) {
    return { status: 404, error: "Venue not found" };
  }

  try {
    const venue = await prisma.venue.delete({ where: { id } });
    return { status: 200, venue: toVenueResponse(venue) };
  } catch (err) {
    return mapVenueWriteError(err);
  }
}
