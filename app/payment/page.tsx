"use client";

import CheckoutPage from "@/ui/Checkoutpage";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useState } from "react";

if (process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY === undefined) {
  throw new Error("NEXT_PUBLIC_STRIPE_PUBLIC_KEY is not defined");
}
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY);

function convertToSubcurrency(amount: number, factor = 100) {
  return Math.round(amount * factor);
}

export default function Home() {
  const amount = 49.99;
  
  // Vormi staatus
  const [formData, setFormData] = useState({
    name: "",
    email: "",
  });

  return (
    <main className="max-w-6xl mx-auto p-6 md:p-10 text-white border m-4 md:m-10 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 shadow-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        
        {/* VASAK POOL: Ürituse kirjeldus */}
        <div className="text-left space-y-6">
          <div>
            <h1 className="text-4xl font-extrabold mb-2">TalTech Gala 2024</h1>
            <p className="text-blue-100 leading-relaxed">
              Liitu aasta oodatuima üritusega! Teid ootab õhtu täis võrgustikke, 
              huvitavaid ettekandeid ja meeleolukat meelelahutust TalTechi aulas.
            </p>
          </div>
          
          <div className="bg-white/10 p-4 rounded-lg">
            <h3 className="font-bold mb-1">Aeg ja koht:</h3>
            <p className="text-sm">15. detsember, 19:00 @ TalTech Aula</p>
          </div>

          <div className="text-3xl font-bold">
            Pilet: <span className="text-yellow-400">${amount}</span>
          </div>
        </div>

        {/* PAREM POOL: Osaleja andmed ja Stripe */}
        <div className="bg-white text-slate-900 p-8 rounded-lg shadow-inner">
          <h2 className="text-xl font-bold mb-6">Registreerimine</h2>
          
          <div className="space-y-4 mb-8">
            <div>
              <label className="block text-sm font-medium mb-1">Täisnimi</label>
              <input 
                type="text" 
                placeholder="Mari Tamm"
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">E-mail</label>
              <input 
                type="email" 
                placeholder="mari@tamm.ee"
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
          </div>

          <hr className="my-6 border-slate-200" />

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
        </div>

      </div>
    </main>
  );
}
