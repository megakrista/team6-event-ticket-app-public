import { NextResponse } from "next/server";
import { listEvents } from "@/services/eventservices";

export async function getEventsRoute() {
  try {
    // Call service layer
    const result = await listEvents();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}