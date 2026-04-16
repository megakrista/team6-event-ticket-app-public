import { listVenues, createVenue } from "@/services/venueservices";
import { success, error } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth-helpers";
import { type VenueInput } from "@/types/venuetype";
import { toVenueWriteResponse } from "./venue-write-response";

export async function GET() {
  try {
    const venues = await listVenues();
    return success({ venues });
  } catch {
    return error("Failed to fetch venues", 500);
  }
}

export async function POST(request: Request) {
  const adminResult = await requireAdmin();
  if (!adminResult.ok) {
    return adminResult.response;
  }

  let body: VenueInput;
  try {
    body = (await request.json()) as VenueInput;
  } catch {
    return error("Invalid JSON body", 400);
  }

  const result = await createVenue(body);
  return toVenueWriteResponse(result);
}
