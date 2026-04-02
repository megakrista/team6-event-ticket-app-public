import {
  deleteEventByIdRoute,
  getEventByIdRoute,
  putEventByIdRoute,
} from "@/routes/eventroute";

export const GET = getEventByIdRoute;
export const PUT = putEventByIdRoute;
export const DELETE = deleteEventByIdRoute;
