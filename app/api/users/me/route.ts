import { getCurrentUser } from "@/lib/auth-helpers";
import { getUserById } from "@/services/userservices";
import { success, error } from "@/lib/api-response";

export async function GET() {
  const auth = await getCurrentUser();

  if (!auth.ok) {
    return auth.response;
  }

  const userId = auth.session.user.id;
  const result = await getUserById(userId);

  if (result.error) {
    return error(result.error, result.status);
  }

  return success({ user: result.user });
}
