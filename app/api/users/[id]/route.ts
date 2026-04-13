import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { getUserByIdRoute } from "@/routes/userroute";
import { getSessionByToken } from "@/services/sessionservices";

export const GET = async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const sessionResult = await getSessionByToken(token);

  if (!sessionResult) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { id } = await params;
  
  // Only allow access if user is accessing their own data or is an admin
  if (sessionResult.user.id !== id && sessionResult.user.role !== "ADMIN") {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  return await getUserByIdRoute(request, { params });
};
