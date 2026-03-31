

import { NextRequest, NextResponse } from "next/server";
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
import Stripe from 'stripe';
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { amount, attendeeEmail, attendeeName, id } = await request.json();

const paymentIntent = await stripe.paymentIntents.create({
  amount: amount,
  currency: "usd",
  automatic_payment_methods: {
    enabled: true,
  },

  metadata: {
 //   attendee: attendeeName,
    event_id: id 
  },
});


  
    return NextResponse.json({ 
      clientSecret: paymentIntent.client_secret
    });

  } catch (error: any) {
    console.error("Viga makse loomisel:", error);
    return NextResponse.json({ error: error.message || "viga" }, { status: 500 });
  }
}
