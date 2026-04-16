import { requireAuth } from "@/lib/auth-helpers";
import { getUserById, updateUser, type UpdateUserBody } from "@/services/userservices";
import { success, error, validationError } from "@/lib/api-response";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const result = await getUserById(auth.session.user.id);
  if (result.error) return error(result.error, result.status);

  return success({ user: result.user });
}

export async function PUT(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  let body: UpdateUserBody;
  try {
    body = (await request.json()) as UpdateUserBody;
  } catch {
    return error("Invalid JSON body", 400);
  }

  const result = await updateUser(auth.session.user.id, body);

  if ("validationErrors" in result && result.validationErrors) {
    return validationError(result.validationErrors);
  }

  if (result.error) return error(result.error, result.status);
  return success({ user: result.user });
}
