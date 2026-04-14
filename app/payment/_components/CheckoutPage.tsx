"use client";

import React, { useEffect, useState } from "react";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";

type Props = {
  amount: number;
  name: string;
  email: string;
  eventId: string;
};

const CheckoutPage = ({ amount, name, email, eventId }: Props) => {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.clientSecret) setClientSecret(data.clientSecret);
      })
      .catch(() => setErrorMessage("Failed to initialise payment"));
  }, [eventId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    if (!stripe || !elements) return;

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setErrorMessage(submitError.message);
      setLoading(false);
      return;
    }

    const { error } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/payment-success`,
        payment_method_data: {
          billing_details: {
            name,
            email,
          },
        },
      },
    });

    if (error) setErrorMessage(error.message);
    setLoading(false);
  };

  if (!clientSecret || !stripe || !elements) {
    return (
      <div className="flex items-center justify-center p-5">
        <div
          className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-e-transparent"
          role="status"
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-2 rounded-md border shadow-sm">
      <PaymentElement />
      {errorMessage && (
        <div className="text-red-500 mt-2 text-sm bg-red-50 p-2 rounded">{errorMessage}</div>
      )}
      <button
        disabled={!stripe || loading}
        className="text-white w-full p-5 bg-black mt-4 rounded-md font-bold disabled:opacity-50 disabled:animate-pulse hover:bg-zinc-800 transition-all"
      >
        {!loading ? `Pay €${(amount / 100).toFixed(2)}` : "Processing..."}
      </button>
    </form>
  );
};

export default CheckoutPage;
