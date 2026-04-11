import { cookies } from "next/headers";
import { error } from "@/lib/api-response";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { getSessionByToken } from "@/services/sessionservices";

type SessionResult = Awaited<ReturnType<typeof getSessionByToken>>;
type AuthenticatedSession = Exclude<SessionResult, null>;

type RequireAdminResult =
  | { ok: true; session: AuthenticatedSession }
  | { ok: false; response: ReturnType<typeof error> };

export async function requireAdmin(): Promise<RequireAdminResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const sessionResult = await getSessionByToken(token);

  if (!sessionResult) {
    return { ok: false, response: error("Unauthorized", 401) };
  }

  if (sessionResult.user.role !== "ADMIN") {
    return { ok: false, response: error("Forbidden", 403) };
  }

  return { ok: true, session: sessionResult };
}
