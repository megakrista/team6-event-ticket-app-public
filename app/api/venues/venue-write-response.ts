import { success, error, validationError } from "@/lib/api-response";
import { type VenueWriteResult } from "@/types/venuetype";

export function toVenueWriteResponse(result: VenueWriteResult) {
  if ("validationErrors" in result) {
    return validationError(result.validationErrors);
  }

  if ("error" in result) {
    return error(result.error, result.status);
  }

  return success({ venue: result.venue }, result.status);
}
