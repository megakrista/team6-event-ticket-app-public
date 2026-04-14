import { updateVenue, deleteVenue } from "@/services/venueservices";
import { error } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth-helpers";
import { type VenueInput } from "@/types/venuetype";
import { toVenueWriteResponse } from "../venue-write-response";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;
  const result = await updateVenue(id, body);
  return toVenueWriteResponse(result);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminResult = await requireAdmin();
  if (!adminResult.ok) {
    return adminResult.response;
  }

  const { id } = await params;
  const result = await deleteVenue(id);
  return toVenueWriteResponse(result);
}
