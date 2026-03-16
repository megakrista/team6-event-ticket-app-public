import { 
createTicket,
findTicketByEventIdService,
deleteTicket,
getUserTickets
 } from "../services/ticketservices";
import { NextFunction, Request, Response, Router } from "express";


const EventTicketRouter = Router();

EventTicketRouter.post("/create", createTicket);
EventTicketRouter.post("/event-tickets", findTicketByEventIdService);
EventTicketRouter.delete("/delete/:id", deleteTicket);
EventTicketRouter.get("/all", getUserTickets);

export default EventTicketRouter;