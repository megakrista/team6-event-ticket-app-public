import {
  createTicket,
  deleteTicket,
  findTicketByEventIdService,
  getUserTickets,
} from "../services/ticketservices";

const EventTicketRouter = {
  createTicket,
  findTicketByEventIdService,
  deleteTicket,
  getUserTickets,
};

export default EventTicketRouter;