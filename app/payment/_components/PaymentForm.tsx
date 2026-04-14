"use client";

import { useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import CheckoutPage from "@/app/payment/_components/CheckoutPage";

if (process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY === undefined) {
  throw new Error("NEXT_PUBLIC_STRIPE_PUBLIC_KEY is not defined");
}
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY);

const toSubunits = (amount: number) => Math.round(amount * 100);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  event: { id: string; title: string; price: number };
  initialName?: string;
  initialEmail?: string;
};

export default function PaymentForm({ event, initialName = "", initialEmail = "" }: Props) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [emailTouched, setEmailTouched] = useState(false);

  const emailValid = EMAIL_RE.test(email);
  const readyToPay = name.trim() !== "" && emailValid;
  const amountInSubunits = toSubunits(event.price);

  return (
    <div className="bg-white text-slate-900 p-8 rounded-lg shadow-inner">
      <h2 className="text-xl font-bold mb-6">Registration</h2>

      <div className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium mb-1">Full name</label>
          <input
            type="text"
            placeholder="Mari Tamm"
            value={name}
            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">E-mail</label>
          <input
            type="email"
            placeholder="mari@tamm.ee"
            value={email}
            className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none ${
              emailTouched && !emailValid ? "border-red-400" : ""
            }`}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setEmailTouched(true)}
          />
          {emailTouched && !emailValid && (
            <p className="text-red-500 text-xs mt-1">Enter a valid email address.</p>
          )}
        </div>
      </div>

      <hr className="my-6 border-slate-200" />

      {readyToPay ? (
        <Elements
          stripe={stripePromise}
          options={{ mode: "payment", amount: amountInSubunits, currency: "eur" }}
        >
          <CheckoutPage
            amount={amountInSubunits}
            name={name}
            email={email}
            eventId={event.id}
            eventTitle={event.title}
          />
        </Elements>
      ) : (
        <div className="text-center text-slate-400 text-sm py-4">
          Fill in your details above to continue to payment.
        </div>
      )}
    </div>
  );
}
