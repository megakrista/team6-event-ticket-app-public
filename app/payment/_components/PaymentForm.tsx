"use client";

import { useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import CheckoutPage from "@/app/payment/_components/CheckoutPage";
import {
  CHECKOUT_EMAIL_RE,
  CHECKOUT_MAX_QUANTITY,
} from "@/lib/checkout-constants";

if (process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY === undefined) {
  throw new Error("NEXT_PUBLIC_STRIPE_PUBLIC_KEY is not defined");
}
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY);

type CheckoutSession = {
  clientSecret: string;
  totalAmount: number;
  quantity: number;
};

type Props = {
  event: { id: string; price: number };
  remainingCapacity: number;
  initialName?: string;
  initialEmail?: string;
};

export default function PaymentForm({
  event,
  remainingCapacity,
  initialName = "",
  initialEmail = "",
}: Props) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [emailTouched, setEmailTouched] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [paymentIntent, setPaymentIntent] = useState<CheckoutSession | null>(null);
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [intentError, setIntentError] = useState<string | null>(null);

  const emailValid = CHECKOUT_EMAIL_RE.test(email);
  const readyToProceed = name.trim() !== "" && emailValid;
  const maxQty = Math.min(CHECKOUT_MAX_QUANTITY, remainingCapacity);

  const handleProceed = async () => {
    setIntentError(null);
    setLoadingIntent(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          quantity,
          buyerName: name.trim(),
          buyerEmail: email.trim(),
        }),
      });
      const data = (await res.json()) as Partial<CheckoutSession> & {
        error?: string;
        fields?: Record<string, string>;
      };
      if (!res.ok || !data.clientSecret) {
        if (data.fields && Object.keys(data.fields).length > 0) {
          setIntentError(Object.values(data.fields).join(" "));
        } else {
          setIntentError(data.error ?? "Failed to initialise payment");
        }
        return;
      }
      const { totalAmount, quantity: qty } = data;
      if (
        typeof totalAmount !== "number" ||
        typeof qty !== "number" ||
        !Number.isFinite(totalAmount) ||
        !Number.isInteger(qty)
      ) {
        setIntentError("Invalid payment response");
        return;
      }
      setPaymentIntent({
        clientSecret: data.clientSecret,
        totalAmount,
        quantity: qty,
      });
    } catch {
      setIntentError("Failed to initialise payment");
    } finally {
      setLoadingIntent(false);
    }
  };

  const handleBack = () => {
    setPaymentIntent(null);
    setIntentError(null);
  };

  if (paymentIntent) {
    return (
      <div className="bg-white text-slate-900 p-8 rounded-lg shadow-inner">
        <button
          type="button"
          onClick={handleBack}
          className="text-sm text-blue-600 hover:underline mb-4 inline-flex items-center gap-1"
        >
          ← Change details
        </button>
        <div className="mb-4 text-sm text-slate-600 space-y-1">
          <p><span className="font-medium">Name:</span> {name}</p>
          <p><span className="font-medium">Email:</span> {email}</p>
          <p><span className="font-medium">Tickets:</span> {paymentIntent.quantity}</p>
        </div>
        <hr className="my-4 border-slate-200" />
        <Elements
          stripe={stripePromise}
          options={{ clientSecret: paymentIntent.clientSecret }}
        >
          <CheckoutPage
            totalAmount={paymentIntent.totalAmount}
            quantity={paymentIntent.quantity}
            name={name}
            email={email}
          />
        </Elements>
      </div>
    );
  }

  return (
    <div className="bg-white text-slate-900 p-8 rounded-lg shadow-inner">
      <h2 className="text-xl font-bold mb-6">Registration</h2>

      <div className="space-y-4 mb-6">
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
        <div>
          <label className="block text-sm font-medium mb-1">Number of tickets</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="w-9 h-9 rounded-full border flex items-center justify-center text-lg font-bold disabled:opacity-30 hover:bg-slate-100 transition-colors"
            >
              −
            </button>
            <span className="text-xl font-semibold w-6 text-center">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              disabled={quantity >= maxQty}
              className="w-9 h-9 rounded-full border flex items-center justify-center text-lg font-bold disabled:opacity-30 hover:bg-slate-100 transition-colors"
            >
              +
            </button>
            <span className="text-sm text-slate-500 ml-2">
              {remainingCapacity} remaining
            </span>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-4 mb-6 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>€{event.price.toFixed(2)} × {quantity}</span>
          <span className="font-semibold text-slate-900">
            €{(event.price * quantity).toFixed(2)}
          </span>
        </div>
      </div>

      {intentError && (
        <p className="text-red-500 text-sm mb-4 bg-red-50 p-2 rounded">{intentError}</p>
      )}

      <button
        type="button"
        onClick={handleProceed}
        disabled={!readyToProceed || loadingIntent}
        className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loadingIntent ? "Preparing payment…" : `Proceed to payment — €${(event.price * quantity).toFixed(2)}`}
      </button>
      {!readyToProceed && (
        <p className="text-center text-slate-400 text-xs mt-2">
          Fill in your details above to continue.
        </p>
      )}
    </div>
  );
}
