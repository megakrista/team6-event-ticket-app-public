
import { NextRequest, NextResponse } from "next/server";
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
import Stripe from 'stripe';
import prisma from "@/lib/prisma";


export function convertToSubcurrency(amount: number, factor = 100) {
  return Math.round(amount * factor);
}


export async function saveTicketToDatabase(data: {
  amount: number;
  ticketNumber: string;
  eventId: string;
  email: string;        
  attendeeName: string;
  paymentIntentId: string;
}) {
  try {
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: data.ticketNumber,
        eventId: data.eventId,
        attendeeEmail: data.email,
        attendeeName: data.attendeeName,
        amount: data.amount,
        paymentIntentId: data.paymentIntentId,
        status: "PAID",
      },
    });
    return ticket;
  } catch (error) {
    console.error("Viga salvestamisel:", error);
    throw error;
  }
}




