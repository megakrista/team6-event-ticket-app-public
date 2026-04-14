import {
  deleteEvent,
  getEventById,
  updateEvent,
  updateEventStatus,
  type EventWriteResult,
} from "@/services/eventservices";
import { success, error, validationError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth-helpers";
import { type EventInput, type EventStatusInput } from "@/types/eventtype";

function toEventWriteResponse(result: EventWriteResult) {
  if ("validationErrors" in result) {
    return validationError(result.validationErrors);
  }

  if ("error" in result) {
    return error(result.error, result.status);
  }

  return success({ event: result.event }, result.status);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await getEventById(id);

  if (result.status !== 200) {
    return error(result.error, result.status);
  }

  return success({ event: result.event });
}

export async function PUT(
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

export async function DELETE(
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminResult = await requireAdmin();
  if (!adminResult.ok) {
    return adminResult.response;
  }

  let body: EventStatusInput;

  try {
    body = (await request.json()) as EventStatusInput;
  } catch {
    return error("Invalid JSON body", 400);
  }

  const { id } = await params;
  const result = await updateEventStatus(id, body);

  return toEventWriteResponse(result);
}
