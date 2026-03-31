"use client";

import React, { useEffect, useState } from "react";
import {
  useStripe,
  useElements,
  PaymentElement,
} from "@stripe/react-stripe-js";


const convertToSubcurrency = (amount: number, factor = 100) => {
  return Math.round(amount * factor);
};

const TEMP_EVENT_ID = "550e8400-e29b-41d4-a716-44665544000"; 
const TEMP_EMAIL = "test@kasutaja.ee"; 

const CheckoutPage = ({ amount }: { amount: number }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
 
    fetch("/api/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: convertToSubcurrency(amount), // Kasutab nüüd siinset funktsiooni
        id: TEMP_EVENT_ID,
        attendeeEmail: TEMP_EMAIL,
        attendeeName: "Test Kasutaja",
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        }
      })
      .catch((err) => setErrorMessage("Makse algatamine ebaõnnestus"));
  }, [amount]);

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
     
        return_url: `${window.location.origin}/payment-success?amount=${amount}&eventId=${TEMP_EVENT_ID}&email=${encodeURIComponent(TEMP_EMAIL)}`,
      },
    });

    if (error) {
      setErrorMessage(error.message);
    }

    setLoading(false);
  };

  if (!clientSecret || !stripe || !elements) {
    return (
      <div className="flex items-center justify-center p-5">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-e-transparent align-[-0.125em] text-surface motion-reduce:animate-[spin_1.5s_linear_infinite] dark:text-white" role="status">
          <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
            Loading...
          </span>
        </div>
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
        {!loading ? `Pay €${amount}` : "Processing..."}
      </button>
    </form>
  );
};

export default CheckoutPage;
