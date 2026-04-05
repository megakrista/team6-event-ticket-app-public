import { getUserById } from "@/services/userservices";
import { success, error } from "@/lib/api-response";

export async function getUserByIdRoute(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await getUserById(id);

  if (result.error) {
    return error(result.error, result.status);
  }

  return success({ user: result.user });
}