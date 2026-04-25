import { requireAdmin, requireAuth } from "@/lib/auth-helpers";
import {
  adminSoftDeleteUser,
  adminUpdateUser,
  getUserById,
} from "@/services/userservices";
import { success, error } from "@/lib/api-response";
import { toUserWriteResponse } from "../user-write-response";
import type { AdminUserInput } from "@/types/usertype";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  if (auth.session.user.id !== id && auth.session.user.role !== "ADMIN") {
    return error("Forbidden", 403);
  }

  const result = await getUserById(id);

  if (result.error) {
    return error(result.error, result.status);
  }

  return success({ user: result.user });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: AdminUserInput;
  try {
    body = (await request.json()) as AdminUserInput;
  } catch {
    return error("Invalid JSON body", 400);
  }

  const { id } = await params;
  const result = await adminUpdateUser(id, body, auth.session.user.id);
  return toUserWriteResponse(result);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const result = await adminSoftDeleteUser(id, auth.session.user.id);
  return toUserWriteResponse(result);
}
