import { NextRequest, NextResponse } from "next/server";
import Stripe from 'stripe';
import prisma from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);


export async function POST(request: NextRequest) {
  try {
    
    const body = await request.json();
    const { id, amount, attendeeEmail, attendeeName } = body;

   
    if (!id || !attendeeName || !attendeeEmail || !amount) {
      return NextResponse.json({ success: false, message: "Missing fields" }, { status: 400 });
    }

   
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

    return NextResponse.json({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });

  } catch (error: any) {
    console.error("payment error:", error);
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
} 
