import { listVenues } from "@/services/venueservices";
import { success, error } from "@/lib/api-response";

export async function GET() {
  try {
    const venues = await listVenues();
    return success({ venues });
  } catch {
    return error("Failed to fetch venues", 500);
  }
}
