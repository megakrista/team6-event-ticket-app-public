import { requireAuth } from "@/lib/auth-helpers";
import { getUserById } from "@/services/userservices";
import { success, error } from "@/lib/api-response";

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
