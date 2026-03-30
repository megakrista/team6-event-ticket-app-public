

import { NextRequest, NextResponse } from "next/server";
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
import Stripe from 'stripe';
import prisma  from '@/lib/prisma';

export async function convertToSubcurrency(amount: number, factor = 100) {
  return Math.round(amount * factor);
}


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

    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: "eur",
      automatic_payment_methods: { enabled: true },
    });

  
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
    console.error("payment error:", error);
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
