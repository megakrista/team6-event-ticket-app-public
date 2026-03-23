import { TicketInput } from "../types/tickettype";

type TicketStub = TicketInput & {
  id: string;
  userId?: string;
};

function createStubTicket(ticketInput: TicketInput, suffix = "stub"): TicketStub {
  return {
    ...ticketInput,
    id: `${ticketInput.eventId}-${suffix}`,
  };
}

export async function createTicket({
  ticketInput,
}: {
  ticketInput: TicketInput;
}) {
  return {
    message: "Ticket feature is temporarily stubbed.",
    ticket: createStubTicket(ticketInput, "create"),
  };
}

export async function updateTicket({
  ticketInput,
}: {
  ticketInput: TicketInput;
}) {
  return {
    message: "Ticket feature is temporarily stubbed.",
    ticket: createStubTicket(ticketInput, "update"),
  };
}

export async function findTicketByEventIdService(id: string) {
  return [
    createStubTicket(
      {
        eventId: id,
        buyerName: "Stub User",
        buyerEmail: "stub@example.com",
        quantity: 0,
        totalPrice: 0,
        availability: 0,
      },
      "find-by-event",
    ),
  ];
}

export async function getEventTickets(eventId: string) {
  return findTicketByEventIdService(eventId);
}

export async function deleteTicket(eventId: string) {
  return {
    message: "Ticket feature is temporarily stubbed.",
    eventId,
    count: 0,
  };
}

export async function getUserTickets({ userId }: { userId: string }) {
  return [
    {
      ...createStubTicket(
        {
          eventId: "stub-event",
          buyerName: "Stub User",
          buyerEmail: "stub@example.com",
          quantity: 0,
          totalPrice: 0,
          availability: 0,
        },
        "find-by-user",
      ),
      userId,
    },
  ];
}

export async function getOneTicket(id: string) {
  return {
    ...createStubTicket(
      {
        eventId: "stub-event",
        buyerName: "Stub User",
        buyerEmail: "stub@example.com",
        quantity: 0,
        totalPrice: 0,
        availability: 0,
      },
      "find-one",
    ),
    id,
  };
}