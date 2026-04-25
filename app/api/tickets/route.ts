import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getUserTickets } from "@/services/ticketservices";

export async function GET() {
  const authResult = await requireAuth();

  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const tickets = await getUserTickets(authResult.session.user.id);
    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("Error fetching user tickets:", error);
    return NextResponse.json(
      { error: "Failed to fetch tickets" },
      { status: 500 },
    );
  }
}
