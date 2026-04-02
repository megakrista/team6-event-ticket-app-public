import {
  createEvent,
  deleteEvent,
  getEventById,
  listEvents,
  updateEvent,
  type EventWriteResult,
} from "@/services/eventservices";
import { success, error, validationError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth-helpers";
import { type EventInput } from "@/types/eventtype";

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
  const adminResult = await requireAdmin();
  if (!adminResult.ok) {
    return adminResult.response;
  }

  let body: EventInput;

  try {
    body = (await request.json()) as EventInput;
  } catch {
    return error("Invalid JSON body", 400);
  }

  const result = await createEvent(body, adminResult.session.user.id);

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
  const adminResult = await requireAdmin();
  if (!adminResult.ok) {
    return adminResult.response;
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

export async function deleteEventByIdRoute(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminResult = await requireAdmin();
  if (!adminResult.ok) {
    return adminResult.response;
  }

  const { id } = await params;
  const result = await deleteEvent(id);

  return toEventWriteResponse(result);
}
