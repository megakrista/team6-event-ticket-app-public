import { error, success, validationError } from "@/lib/api-response";
import { loginFromBody } from "@/services/loginservices";
import { createSession } from "@/services/sessionservices";
import { type LoginBody } from "@/types/logintype";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

export async function POST(request: Request) {
  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return error("Invalid JSON body", 400);
  }

  const result = await loginFromBody(body);

  if (result.status !== 200 || !result.body.userId) {
    const status = result.status === 200 ? 500 : result.status;

    if (status === 400 && result.body.fields) {
      return validationError(
        result.body.fields,
        result.body.error ?? "Validation failed",
      );
    }

    return error(result.body.error ?? "Login failed. Please try again.", status);
  }

  try {
    const { token, expiresAt } = await createSession(result.body.userId);
    const response = success(
      { message: result.body.message ?? "Login successful" },
      200,
    );

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });

    return response;
  } catch (sessionError) {
    console.error(
      "Failed to create session after successful credential check",
      sessionError,
    );

    return error("Login failed. Please try again.", 500);
  }
}
