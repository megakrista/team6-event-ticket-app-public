import prisma from "@/lib/prisma";
import { OrderStatus, TicketStatus } from "@prisma/client";

export async function getPaidTicketCount(eventId: string): Promise<number> {
  return prisma.ticket.count({
    where: { eventId, status: TicketStatus.PAID },
  });
}

/**
 * Paid tickets plus seats held by pending checkout orders (same rule as fulfillment).
 */
export async function getAllocatedSeatCount(eventId: string): Promise<number> {
  const [paid, pendingAgg] = await Promise.all([
    prisma.ticket.count({
      where: { eventId, status: TicketStatus.PAID },
    }),
    prisma.order.aggregate({
      where: { eventId, status: OrderStatus.PENDING },
      _sum: { quantity: true },
    }),
  ]);
  return paid + (pendingAgg._sum.quantity ?? 0);
}


export async function getUserTickets(userId: string) {
  return prisma.ticket.findMany({
    where: {
      userId,
      status: TicketStatus.PAID,
    },
    include: {
      event: {
        include: {
          venue: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}