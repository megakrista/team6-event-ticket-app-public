
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

    const body = await request.json();
    const { id, title, description, attendeeEmail, attendeeName, amount } = await request.json();
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


  
export async function POST(request: NextRequest) {
  try {
    const { amount, attendeeEmail, attendeeName, id } = await request.json();
    const ticketNumber = `TICKET-${Math.random().toString(36).toUpperCase().substring(2, 10)}`;

    // 1. Loo Stripe PaymentIntent
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

    // 2. Salvesta pilet Prismaga andmebaasi ootel olekusse
    // Eeldame, et sul on Ticket mudel, mis on seotud Event mudeliga (id kaudu)
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: ticketNumber,
        attendeeName: attendeeName,
        attendeeEmail: attendeeEmail,
        ticketPrice: amount / 100, // Teisenda eurodeks
        stripeSessionId: paymentIntent.id, // Kasutame Intent ID-d sessiooni ID asemel
        status: "PENDING", // Lisa staatus, et teaksid, mis on maksmata
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
    return NextResponse.json({ error: error.message || "viga" }, { status: 500 });
  }
}
