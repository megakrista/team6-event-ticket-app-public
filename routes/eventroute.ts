import {
  createEvent,
  getEventById,
  listEvents,
  updateEvent,
} from "@/services/eventservices";
import { success, error, validationError } from "@/lib/api-response";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { getSessionByToken } from "@/services/sessionservices";
import { type EventInput } from "@/types/eventtype";
import { cookies } from "next/headers";

type EventWriteResult = Awaited<ReturnType<typeof createEvent>>;

function toEventWriteResponse(result: EventWriteResult) {
  if ("validationErrors" in result) {
    return validationError(result.validationErrors);
  }

  if ("error" in result) {
    return error(result.error, result.status);
  }

  return success({ event: result.event }, result.status);
}

export async function getEventsRoute() {
  try {
    const events = await listEvents();
    return success({ events });
  } catch {
    return error("Failed to fetch events", 500);
  }
}

export async function postEventRoute(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const sessionResult = await getSessionByToken(token);

  if (!sessionResult) {
    return error("Unauthorized", 401);
  }

  if (sessionResult.user.role !== "ADMIN") {
    return error("Forbidden", 403);
  }

  let body: EventInput;

  try {
    body = (await request.json()) as EventInput;
  } catch {
    return error("Invalid JSON body", 400);
  }

  const result = await createEvent(body, sessionResult.user.id);

  return toEventWriteResponse(result);
}

export async function getEventByIdRoute(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await getEventById(id);

  if (result.error) {
    return error(result.error, result.status);
  }

  return success({ event: result.event });
}

export async function putEventByIdRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const sessionResult = await getSessionByToken(token);

  if (!sessionResult) {
    return error("Unauthorized", 401);
  }

  if (sessionResult.user.role !== "ADMIN") {
    return error("Forbidden", 403);
  }

  let body: EventInput;

  try {
    body = (await request.json()) as EventInput;
  } catch {
    return error("Invalid JSON body", 400);
  }

  const { id } = await params;
  const result = await updateEvent(id, body);

  return toEventWriteResponse(result);
}
