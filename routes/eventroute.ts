import { createEvent, getEventById, listEvents } from "@/services/eventservices";
import { success, error, validationError } from "@/lib/api-response";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { getSessionByToken } from "@/services/sessionservices";
import { type CreateEventBody } from "@/types/eventtype";
import { cookies } from "next/headers";

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

  let body: CreateEventBody;

  try {
    body = (await request.json()) as CreateEventBody;
  } catch {
    return error("Invalid JSON body", 400);
  }

  const result = await createEvent(body, sessionResult.user.id);

  if (result.validationErrors) {
    return validationError(result.validationErrors);
  }

  if (result.error) {
    return error(result.error, result.status);
  }

  return success({ event: result.event }, 201);
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
