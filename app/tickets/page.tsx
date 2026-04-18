import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { getSessionByToken } from "@/services/sessionservices";
import { getUserTickets } from "@/services/ticketservices";
import TicketsManager, { type TicketItem } from "@/app/tickets/_components/TicketsManager";

export const dynamic = "force-dynamic";

function prismaTicketToItem(
  ticket: Awaited<ReturnType<typeof getUserTickets>>[number],
): TicketItem {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    attendeeName: ticket.attendeeName,
    attendeeEmail: ticket.attendeeEmail,
    amount: ticket.amount,
    status: ticket.status,
    createdAt: new Date(ticket.createdAt).toISOString(),
    event: {
      id: ticket.event.id,
      title: ticket.event.title,
      description: ticket.event.description,
      startsAt: new Date(ticket.event.startsAt).toISOString(),
      endsAt: new Date(ticket.event.endsAt).toISOString(),
      category: ticket.event.category,
      imageUrl: ticket.event.imageUrl,
      venue: {
        name: ticket.event.venue.name,
        address: ticket.event.venue.address,
      },
    },
  };
}

export default async function TicketsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const sessionResult = await getSessionByToken(token);

  if (!sessionResult) {
    redirect("/login");
  }

  const tickets = await getUserTickets(sessionResult.user.id);
  const ticketItems = tickets.map(prismaTicketToItem);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-zinc-900">My Tickets</h1>
      </div>

      <TicketsManager initialTickets={ticketItems} />
    </div>
  );
}
