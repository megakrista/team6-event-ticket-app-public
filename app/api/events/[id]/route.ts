import {
  deleteEventByIdRoute,
  getEventByIdRoute,
  patchEventStatusByIdRoute,
  putEventByIdRoute,
} from "@/routes/eventroute";

export const GET = getEventByIdRoute;
export const PUT = putEventByIdRoute;
export const DELETE = deleteEventByIdRoute;
export const PATCH = patchEventStatusByIdRoute;
