
import { TicketInput } from "../types/tickettype";
import { NextRequest, NextResponse } from "next/server";
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
import Stripe from 'stripe';
import { prisma } from '@/prisma';

export async function convertToSubcurrency(amount: number, factor = 100) {
  return Math.round(amount * factor);
}

const generateTicketNumber = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `TKT-${timestamp}-${random}`.toUpperCase();
};



export async function createTicket(req: Request) {
  try {

    const body = await req.json();
    const { id, title, description, attendeeEmail, attendeeName } = body;
    const userId = "kasutaja_id"; 

    if (!id || !attendeeName || !attendeeEmail) {
      return NextResponse.json({ success: false, message: "Missing fields" }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { id: id },
      select: { id: true, title: true, price: true, date: true },
    });

    if (!event) {
      return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 });
    }



   const ticket = await prisma.ticket.create({
    include: { event: true },
    data: 
        id,
        userId,
        ticketNumber: generateTicketNumber(),
        attendeeName,
        attendeeEmail,
        ticketPrice: event.price,
  });

  const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: {
            name: `Pilet: ${event.title}`,
            description: `Üritus: ${event.date.toDateString()}`,
          },
          unit_amount: Math.round(event.ticketPrice * 100),
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'}/thank-you?session_id={CHECKOUT_SESSION_ID}&ticket_id=${ticket.id}`,
      cancel_url: `${process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'}/events/${id}`,
      customer_email: attendeeEmail,
    });




    const updatedTicket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { stripeSessionId: session.id },
      include: { event: true } // Kui sul on vaja event andmeid vastusesse
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      sessionUrl: session.url,
      ticket: {
        id: updatedTicket.id,
        ticketNumber: updatedTicket.ticketNumber,
        attendeeName: updatedTicket.attendeeName,
        attendeeEmail: updatedTicket.attendeeEmail,
        ticketPrice: updatedTicket.price,
        eventTitle: updatedTicket.event.title,
        eventDate: updatedTicket.event.date,
      },
    });
  } catch (error) {
    console.error("Create checkout session error:", error);
    return NextResponse.json(
      { success: false, message: "Sessiooni loomine ebaõnnestus" },
      { status: 500 }
    );
  }
}





export async function deleteTicket(eventId: string) {
  return {
    message: "Ticket feature is temporarily stubbed.",
    eventId,
    count: 0,
  };
}



