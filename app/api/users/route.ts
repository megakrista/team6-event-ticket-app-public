import { requireAdmin } from "@/lib/auth-helpers";
import { listAdminUsers } from "@/services/userservices";
import { success, error } from "@/lib/api-response";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const users = await listAdminUsers();
    return success({ users });
  } catch {
    return error("Failed to fetch users", 500);
  }
}
