"use client";

import { useState } from "react";
import { convertToSubcurrency } from "@/services/ticketservices";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

if (process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY === undefined) {
  throw new Error("NEXT_PUBLIC_STRIPE_PUBLIC_KEY is not defined");
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY);

// Sündmuste andmed
const events = [
  { id: 1, title: "Konverents 2024", description: "Aastane tehnoloogiakonverents Tallinnas.", price: 49.99 },
  { id: 2, title: "Workshop: React & Next.js", description: "Praktiline koolitus edasijõudnutele.", price: 29.99 },
  { id: 3, title: "Networking Õhtu", description: "Vaba õhkkond ja uued kontaktid.", price: 15.00 },
];

export default function Home() {
  const [selectedEvent, setSelectedEvent] = useState(events[0]);
    const amount = 49.99;

  return (
    <main className="max-w-6xl mx-auto p-10 text-white text-center border m-10 rounded-md bg-gradient-to-tr from-blue-500 to-purple-500">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold mb-2">Sündmuse pilet</h1>
        
        {/* Sündmuste valikunupud */}
        <div className="flex flex-wrap justify-center gap-4 my-8">
          {events.map((event) => (
            <button
              key={event.id}
              onClick={() => setSelectedEvent(event)}
              className={`p-4 border rounded-lg transition-all ${
                selectedEvent.id === event.id ? "bg-white text-blue-600 scale-105 shadow-lg" : "bg-white/10 hover:bg-white/20"
              }`}
            >
              <h3 className="font-bold">{event.title}</h3>
              <p className="text-sm opacity-80">{event.description}</p>
              <p className="mt-2 font-mono">${event.price}</p>
            </button>
          ))}
        </div>

        <h2 className="text-2xl italic">
          Valitud: <span className="font-bold">{selectedEvent.title}</span> — 
          <span className="font-bold"> ${amount}</span>
        </h2>
      </div>

  
      <Elements
        stripe={stripePromise}
        options={{
          mode: "payment",
          amount: convertToSubcurrency(amount),
          currency: "usd",
        }}
      >
        <CheckoutPage amount={amount} />
      </Elements>
    </main>
  );
}
