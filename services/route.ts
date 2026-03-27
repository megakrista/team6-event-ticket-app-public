
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


export async function POST(request: NextRequest) {
  try {
    // 1. Võtame andmed (ainult üks kord .json() kutsumine!)
    const body = await request.json();
    const { id, amount, attendeeEmail, attendeeName } = body;

    // 2. Kontrollime kohustuslikke välju
    if (!id || !attendeeName || !attendeeEmail || !amount) {
      return NextResponse.json({ success: false, message: "Missing fields" }, { status: 400 });
    }

    // 3. Kontrollime, kas üritus on olemas
    const event = await prisma.event.findUnique({
      where: { id: id },
      select: { id: true, title: true },
    });

    if (!event) {
      return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 });
    }

    // 4. Loome Stripe PaymentIntent ja pileti numbri
    const ticketNumber = `TICKET-${Math.random().toString(36).toUpperCase().substring(2, 10)}`;
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: "eur",
      automatic_payment_methods: { enabled: true },
      metadata: { 
        ticket_number: ticketNumber, 
        event_id: id, 
        attendeeEmail 
      },
    });

    // 5. Salvestame pileti andmebaasi PENDING staatusega
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: ticketNumber,
        attendeeName: attendeeName,
        attendeeEmail: attendeeEmail,
        ticketPrice: amount / 100,
        stripeSessionId: paymentIntent.id,
        status: "PENDING",
        eventId: id, 
      },
    });

    return NextResponse.json({ 
      clientSecret: paymentIntent.client_secret, 
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber 
    });

  } catch (error: any) {
    console.error("Viga makse loomisel:", error);
    return NextResponse.json({ error: error.message || "Serveri viga" }, { status: 500 });
  }
} // <--- See sulg lõpetab funktsiooni
