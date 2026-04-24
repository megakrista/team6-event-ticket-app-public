"use client";

import { useState, type FormEvent } from "react";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";

type Props = {
  totalAmount: number;
  quantity: number;
  name: string;
  email: string;
};

const CheckoutPage = ({ totalAmount, quantity, name, email }: Props) => {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    if (!stripe || !elements) {
      setLoading(false);
      return;
    }

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setErrorMessage(submitError.message);
      setLoading(false);
      return;
    }

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment-success`,
        payment_method_data: {
          billing_details: { name, email },
        },
      },
    });

    if (error) setErrorMessage(error.message);
    setLoading(false);
  };

  if (!stripe || !elements) {
    return (
      <div className="flex items-center justify-center p-5">
        <div
          className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-e-transparent"
          role="status"
          aria-label="Loading payment form"
        />
      </div>
    );
  }

  const totalDisplay = (totalAmount / 100).toFixed(2);

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
        {loading
          ? "Processing..."
          : quantity > 1
            ? `Pay €${totalDisplay} (${quantity} tickets)`
            : `Pay €${totalDisplay}`}
      </button>
    </form>
  );
};

export default CheckoutPage;
