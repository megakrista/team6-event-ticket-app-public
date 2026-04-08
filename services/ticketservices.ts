import prisma from "@/lib/prisma";
import { TicketStatus } from "@/app/generated/prisma";

export async function saveTicketToDatabase(data: {
  amount: number;
  ticketNumber: string;
  eventId: string;
  email: string;
  attendeeName: string;
  paymentIntentId: string;
  userId?: string;
}) {
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: data.ticketNumber,
      eventId: data.eventId,
      attendeeEmail: data.email,
      attendeeName: data.attendeeName,
      amount: data.amount,
      paymentIntentId: data.paymentIntentId,
      status: TicketStatus.PAID,
      ...(data.userId && { userId: data.userId }),
    },
  });
  return ticket;
}
