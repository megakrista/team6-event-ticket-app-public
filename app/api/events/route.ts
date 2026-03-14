import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { EventStatus, Prisma } from "@/app/generated/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const status = searchParams.get("status") as EventStatus | null;
    const category = searchParams.get("category");
    const venueId = searchParams.get("venueId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build filter object
    const where: Prisma.EventWhereInput = {};
    
    if (status && Object.values(EventStatus).includes(status)) {
      where.status = status;
    }
    
    if (category) {
      where.category = category;
    }
    
    if (venueId) {
      where.venueId = venueId;
    }

    // Fetch events with venue information
    const events = await prisma.event.findMany({
      where,
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
            timezone: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        startsAt: "asc",
      },
      take: Math.min(limit, 100), // Max 100 items per request
      skip: offset,
    });

    // Get total count for pagination
    const total = await prisma.event.count({ where });

    return NextResponse.json({
      events,
      pagination: {
        total,
        limit: Math.min(limit, 100),
        offset,
        hasMore: offset + events.length < total,
      },
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
