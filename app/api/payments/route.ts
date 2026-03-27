

import { NextRequest, NextResponse } from "next/server";
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
import Stripe from 'stripe';
import prisma from "@/lib/prisma";

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
    const { amount, attendeeEmail, attendeeName, id } = await request.json();
    const ticketNumber = `TICKET-${Math.random().toString(36).toUpperCase().substring(2, 10)}`;

const paymentIntent = await stripe.paymentIntents.create({
  amount: amount,
  currency: "usd",
  automatic_payment_methods: {
    enabled: true,
  },

  metadata: {
    attendee: attendeeName,
    ticket_number: ticketNumber,
    event_id: id 
  },
});


    // const ticket = await prisma.ticket.create({
    //   data: {
    //     ticketNumber: ticketNumber,
    //     attendeeEmail: attendeeEmail,
    //     attendeeName: attendeeName,
    //     eventId: id,
    //     paymentIntentId: paymentIntent.id,
    //     amount: amount,
    //     status: 'PENDING', 
    //   },
    // });
  
    return NextResponse.json({ 
      clientSecret: paymentIntent.client_secret
    });

  } catch (error: any) {
    console.error("Viga makse loomisel:", error);
    return NextResponse.json({ error: error.message || "viga" }, { status: 500 });
  }
}
