import { NextResponse } from "next/server";
import { prisma } from "../prisma";
import { getSession } from "../services/session";
import { TicketInput } from "../types/tickettype";


export async function createTicket({ ticketInput }: { ticketInput: TicketInput }) {
  await prisma.eventTicket.create({
    data: {
      ticketInput
    }
  });
}

export async function updateTicket({ ticketInput }: { ticketInput: TicketInput }) {
  await prisma.event.update({
    where: { id: ticketInput.eventId },
    data: {
      ticketsSold: {
        increment: ticketInput.quantity
      }
    }
  });
}

export async function findTicketByEventIdService(id: string) {
    // create new event service
    return await prisma.eventTicket.findMany({
        where: {
            eventId: Number(id)
        }

    })
}

export async function getEventTickets(eventId: string) {
    try {
        const tickets = await prisma.eventTicket.findMany({
            where: { eventId },
            include: {
                order: {
                    select: {
                        status: true
                    }
                }
            },
            orderBy: {
                purchasedAt: 'desc'
            }
        });
        return tickets;
    } catch (error) {
        console.error("Error fetching event tickets:", error);
        return [];
    }
}

export async function deleteTicket(eventId: string) {
    return prisma.eventTicket.deleteMany({
      where: { eventId },
    });
  }

  export async function getUserTickets({ userId }: { userId: string }) {
    return prisma.eventTicket.findMany({
        where: { userId },
        orderBy: { event: { dateFrom: "desc" } },
    });
}

 export async function getOneTicket(id: string) {
    return prisma.eventTicket.findUnique({
        where: { id },
      });
      return {
        message: 'Success',
      };
} 
  


