
import { NextRequest, NextResponse } from "next/server";
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
import Stripe from 'stripe';
import prisma from "@/lib/prisma";

export async function convertToSubcurrency(amount: number, factor = 100) {
  return Math.round(amount * factor);
}



export async function POST(request: NextRequest) {
  try {

    const body = await request.json();
    const { id, amount, attendeeEmail, attendeeName } = body;

    if (!id || !attendeeName || !attendeeEmail || !amount) {
      return NextResponse.json({ success: false, message: "Missing fields" }, { status: 400 });
    }



const paymentIntent = await stripe.paymentIntents.create({
  amount: "3232",
  currency: "eur",
  automatic_payment_methods: { enabled: true },
  metadata: { 
    ticket_number: "232", 
    event_id: id, 
    attendeeEmail 
  },
});


console.log("Sessioon loodud piletiga:", paymentIntent.metadata.ticket_number || "puudub");

    // const ticket = await prisma.ticket.create({
    //   data: {
    //     ticketNumber: ticketNumber,
    //     attendeeName: attendeeName,
    //     attendeeEmail: attendeeEmail,
    //     ticketPrice: amount / 100,
    //     stripeSessionId: paymentIntent.id,
    //     status: "PENDING",
    //     eventId: id,
    //   },
    // });

    return NextResponse.json({ 
      clientSecret: paymentIntent.client_secret
    });

  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json({ error: error.message || "Error" }, { status: 500 });
  }
}
