import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { Prisma, TicketStatus } from "@prisma/client";

type PaidTicketInput = {
  amount: number;
  eventId: string;
  attendeeEmail: string;
  attendeeName: string;
  paymentIntentId: string;
  userId?: string;
};

function generateTicketNumber() {
  return `TKT-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function createOrGetPaidTicket(input: PaidTicketInput) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const ticket = await prisma.ticket.upsert({
        where: { paymentIntentId: input.paymentIntentId },
        update: {},
        create: {
          ticketNumber: generateTicketNumber(),
          eventId: input.eventId,
          attendeeEmail: input.attendeeEmail,
          attendeeName: input.attendeeName,
          amount: input.amount,
          paymentIntentId: input.paymentIntentId,
          status: TicketStatus.PAID,
          ...(input.userId ? { userId: input.userId } : {}),
        },
      });

      return ticket;
    } catch (ticketError) {
      if (
        ticketError instanceof Prisma.PrismaClientKnownRequestError &&
        ticketError.code === "P2002" &&
        String(ticketError.meta?.target).includes("ticketNumber")
      ) {
        continue;
      }

      throw ticketError;
    }
  }

  throw new Error("Failed to generate unique ticket number");
}

export async function getTicketByPaymentIntentId(paymentIntentId: string) {
  return prisma.ticket.findUnique({
    where: { paymentIntentId },
  });
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
