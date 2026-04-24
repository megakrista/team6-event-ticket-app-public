import { beforeEach, describe, expect, it, vi } from "vitest";
import { TicketStatus } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  ticket: {
    count: vi.fn(),
  },
  order: {
    aggregate: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
}));

import { getAllocatedSeatCount, getPaidTicketCount } from "@/services/ticketservices";

beforeEach(() => {
  prismaMock.ticket.count.mockReset();
  prismaMock.order.aggregate.mockReset();
});

describe("ticketservices", () => {
  it("getPaidTicketCount counts only paid tickets", async () => {
    prismaMock.ticket.count.mockResolvedValue(7);

    const result = await getPaidTicketCount("event-1");

    expect(prismaMock.ticket.count).toHaveBeenCalledWith({
      where: { eventId: "event-1", status: TicketStatus.PAID },
    });
    expect(result).toBe(7);
  });

  it("getAllocatedSeatCount adds paid + pending quantities", async () => {
    prismaMock.ticket.count.mockResolvedValue(5);
    prismaMock.order.aggregate.mockResolvedValue({ _sum: { quantity: 3 } });

    const result = await getAllocatedSeatCount("event-1");

    expect(prismaMock.ticket.count).toHaveBeenCalledWith({
      where: { eventId: "event-1", status: TicketStatus.PAID },
    });
    expect(prismaMock.order.aggregate).toHaveBeenCalledWith({
      where: { eventId: "event-1", status: "PENDING" },
      _sum: { quantity: true },
    });
    expect(result).toBe(8);
  });

  it("getAllocatedSeatCount treats null pending sum as zero", async () => {
    prismaMock.ticket.count.mockResolvedValue(2);
    prismaMock.order.aggregate.mockResolvedValue({ _sum: { quantity: null } });

    await expect(getAllocatedSeatCount("event-1")).resolves.toBe(2);
  });
});
