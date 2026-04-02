import {
  getEventByIdRoute,
  patchEventStatusByIdRoute,
  putEventByIdRoute,
} from "@/routes/eventroute";

export const GET = getEventByIdRoute;
export const PUT = putEventByIdRoute;
export const PATCH = patchEventStatusByIdRoute;
