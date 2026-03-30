export default async function PaymentSuccess({
  searchParams,
}: {
  searchParams: Promise<{ amount: string; ticketNumber?: string; eventId: string; email: string }>;
}) {
  const { amount, ticketNumber, eventId, email } = await searchParams;

  // Kui ticketNumber puudub, genereerime juhusliku koodi (nt: TKT-123456)
  const generatedTicket = ticketNumber || `TKT-${Math.random().toString(36).toUpperCase().substring(2, 8)}`;

  return (
    <main className="max-w-6xl mx-auto p-10 text-white text-center border m-10 rounded-md bg-gradient-to-tr from-blue-500 to-purple-500 shadow-2xl">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold mb-2 text-white">Thank you {email}!</h1>
        <h2 className="text-2xl opacity-90">you successfully registered to our event</h2>
        
        {/* Piletikaart */}
        <div className="mt-10 bg-white text-gray-800 p-6 rounded-lg shadow-xl max-w-sm mx-auto border-dashed border-2 border-purple-300">
          <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold">Ticket ID</p>
          <p className="text-3xl font-mono font-black text-purple-600 my-2">
            {generatedTicket}
          </p>
          <div className="border-t pt-4 mt-4 flex justify-between items-center">
            <div className="text-left">
              <p className="text-[10px] uppercase text-gray-400">Event ID</p>
              <p className="font-bold">{eventId}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase text-gray-400">Summa</p>
              <p className="font-bold text-green-600">${amount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/20 backdrop-blur-sm p-4 rounded-md mt-10 inline-block">
          <p className="text-sm">Confirmation is sent to your email.</p>
        </div>
      </div>
    </main>
  );
}
