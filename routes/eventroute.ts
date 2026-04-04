import {
  createEvent,
  getEventById,
  listEvents,
  ListEventsParams,
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

export async function getEventsRoute(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const params: ListEventsParams = {
      search: searchParams.get("search") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      page: searchParams.has("page")
        ? parseInt(searchParams.get("page")!, 10)
        : undefined,
    };
    const { events, total } = await listEvents(params);
    return success({ events, total });
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

  if ("error" in result) {
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
