import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EventStatus, OrderStatus, Prisma, TicketStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { createEvent, deleteEvent, listEvents, updateEventStatus } from "@/services/eventservices";
import { getAllocatedSeatCount, getPaidTicketCount } from "@/services/ticketservices";
import { createVenue, deleteVenue } from "@/services/venueservices";
import type { EventInput } from "@/types/eventtype";

const MARKER = `it-events-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

function assertIntegrationDbConfig() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set for integration tests. Configure it in .env or shell env.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("DATABASE_URL is invalid. Expected a valid PostgreSQL connection string.");
  }

  const hasAuth = parsed.username.length > 0 && parsed.password.length > 0;
  if (!hasAuth) {
    throw new Error(
      "DATABASE_URL must include both username and password for Postgres auth (e.g. postgresql://user:pass@host:5432/db).",
    );
  }
}

function uniqueEmail(label: string): string {
  return `${MARKER}-${label}-${crypto.randomUUID()}@example.com`;
}

function uniqueTicketNumber(): string {
  return `ITK-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function makeEventInput(venueId: string, title: string, overrides: Partial<EventInput> = {}): EventInput {
  const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const endsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  return {
    title,
    description: "Integration event",
    category: "concert",
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    price: 25,
    capacity: 120,
    venueId,
    ...overrides,
  };
}

async function createFixtureUser() {
  return prisma.user.create({
    data: {
      email: uniqueEmail("creator"),
      firstName: "Event",
      lastName: "Creator",
    },
  });
}

async function cleanupIntegrationRecords() {
  await prisma.ticket.deleteMany({
    where: {
      OR: [
        { attendeeEmail: { startsWith: `${MARKER}-` } },
        { order: { buyerEmail: { startsWith: `${MARKER}-` } } },
      ],
    },
  });

  await prisma.payment.deleteMany({
    where: { order: { buyerEmail: { startsWith: `${MARKER}-` } } },
  });

  await prisma.order.deleteMany({
    where: { buyerEmail: { startsWith: `${MARKER}-` } },
  });

  await prisma.event.deleteMany({
    where: { title: { startsWith: `${MARKER}-` } },
  });

  await prisma.venue.deleteMany({
    where: { name: { startsWith: `${MARKER}-` } },
  });

  await prisma.user.deleteMany({
    where: { email: { startsWith: `${MARKER}-` } },
  });
}

describe.sequential("events/venues/ticket integration", () => {
  beforeAll(async () => {
    assertIntegrationDbConfig();
    await cleanupIntegrationRecords();
  });

  afterAll(async () => {
    await cleanupIntegrationRecords();
  });

  it("creates venues and blocks case-insensitive duplicate names", async () => {
    const createResult = await createVenue({
      name: ` ${MARKER}-venue-main `,
      address: " Main street 1 ",
      latitude: 59.437,
      longitude: 24.7536,
      timezone: " Europe/Tallinn ",
    });

    expect(createResult.status).toBe(201);
    if (createResult.status !== 201) {
      return;
    }
    expect(createResult.venue.name).toBe(`${MARKER}-venue-main`);

    const duplicate = await createVenue({
      name: `${MARKER}-VENUE-MAIN`,
      address: "Some other street 2",
      latitude: 59.438,
      longitude: 24.7537,
      timezone: "Europe/Tallinn",
    });

    expect(duplicate).toEqual({
      status: 400,
      validationErrors: {
        name: "A venue with this name already exists",
      },
    });
  });

  it("prevents deleting venues that still have assigned events", async () => {
    const creator = await createFixtureUser();
    const venueResult = await createVenue({
      name: `${MARKER}-venue-protected`,
      address: "Protected street 3",
      latitude: 59.43,
      longitude: 24.75,
      timezone: "Europe/Tallinn",
    });
    expect(venueResult.status).toBe(201);
    if (venueResult.status !== 201) {
      return;
    }

    const eventResult = await createEvent(
      makeEventInput(venueResult.venue.id, `${MARKER}-protected-event`),
      creator.id,
    );
    expect(eventResult.status).toBe(201);

    const deleted = await deleteVenue(venueResult.venue.id);
    expect(deleted).toEqual({
      status: 409,
      error: "Cannot delete a venue that has events assigned to it",
    });
  });

  it("lists only published events with future end dates", async () => {
    const creator = await createFixtureUser();
    const venueResult = await createVenue({
      name: `${MARKER}-venue-list`,
      address: "List street 4",
      latitude: 59.45,
      longitude: 24.77,
      timezone: "Europe/Tallinn",
    });
    expect(venueResult.status).toBe(201);
    if (venueResult.status !== 201) {
      return;
    }

    const visible = await createEvent(
      makeEventInput(venueResult.venue.id, `${MARKER}-event-visible`),
      creator.id,
    );
    expect(visible.status).toBe(201);
    if (visible.status !== 201) {
      return;
    }

    const publish = await updateEventStatus(visible.event.id, { status: "published" });
    expect(publish.status).toBe(200);

    const draft = await createEvent(
      makeEventInput(venueResult.venue.id, `${MARKER}-event-draft`),
      creator.id,
    );
    expect(draft.status).toBe(201);

    await prisma.event.create({
      data: {
        title: `${MARKER}-event-ended`,
        description: "Ended event should not be listed",
        startsAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        capacity: 100,
        price: new Prisma.Decimal("15.00"),
        category: "concert",
        status: EventStatus.PUBLISHED,
        venueId: venueResult.venue.id,
        createdById: creator.id,
      },
    });

    const listed = await listEvents({
      search: MARKER,
      category: "concert",
    });

    expect(listed.total).toBe(1);
    expect(listed.events).toHaveLength(1);
    expect(listed.events[0]?.id).toBe(visible.event.id);

    if (draft.status === 201) {
      const deletedDraft = await deleteEvent(draft.event.id);
      expect(deletedDraft.status).toBe(200);
    }
  });

  it("counts paid tickets and pending allocations correctly", async () => {
    const creator = await createFixtureUser();
    const venueResult = await createVenue({
      name: `${MARKER}-venue-ticket`,
      address: "Ticket street 5",
      latitude: 59.48,
      longitude: 24.79,
      timezone: "Europe/Tallinn",
    });
    expect(venueResult.status).toBe(201);
    if (venueResult.status !== 201) {
      return;
    }

    const event = await prisma.event.create({
      data: {
        title: `${MARKER}-event-ticket`,
        description: "Ticket counting event",
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        capacity: 50,
        price: new Prisma.Decimal("25.00"),
        category: "concert",
        status: EventStatus.PUBLISHED,
        venueId: venueResult.venue.id,
        createdById: creator.id,
      },
    });

    const pendingOrder = await prisma.order.create({
      data: {
        idempotencyKey: crypto.randomUUID(),
        totalAmount: new Prisma.Decimal("75.00"),
        quantity: 3,
        status: OrderStatus.PENDING,
        eventId: event.id,
        buyerName: "Pending Buyer",
        buyerEmail: uniqueEmail("pending-order"),
      },
    });

    const paidOrder = await prisma.order.create({
      data: {
        idempotencyKey: crypto.randomUUID(),
        totalAmount: new Prisma.Decimal("50.00"),
        quantity: 2,
        status: OrderStatus.PAID,
        eventId: event.id,
        buyerName: "Paid Buyer",
        buyerEmail: uniqueEmail("paid-order"),
      },
    });

    await prisma.order.create({
      data: {
        idempotencyKey: crypto.randomUUID(),
        totalAmount: new Prisma.Decimal("250.00"),
        quantity: 10,
        status: OrderStatus.CANCELLED,
        eventId: event.id,
        buyerName: "Cancelled Buyer",
        buyerEmail: uniqueEmail("cancelled-order"),
      },
    });

    await prisma.ticket.createMany({
      data: [
        {
          ticketNumber: uniqueTicketNumber(),
          attendeeName: "Ticket Holder One",
          attendeeEmail: uniqueEmail("ticket-one"),
          pricePaid: new Prisma.Decimal("25.00"),
          status: TicketStatus.PAID,
          orderId: paidOrder.id,
          eventId: event.id,
        },
        {
          ticketNumber: uniqueTicketNumber(),
          attendeeName: "Ticket Holder Two",
          attendeeEmail: uniqueEmail("ticket-two"),
          pricePaid: new Prisma.Decimal("25.00"),
          status: TicketStatus.PAID,
          orderId: paidOrder.id,
          eventId: event.id,
        },
      ],
    });

    const paidCount = await getPaidTicketCount(event.id);
    const allocatedCount = await getAllocatedSeatCount(event.id);

    expect(paidCount).toBe(2);
    expect(allocatedCount).toBe(5);
    expect(pendingOrder.quantity).toBe(3);
  });
});
