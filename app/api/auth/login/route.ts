import { NextResponse } from "next/server";
import { loginFromBody } from "@/services/loginservices";
import { createSession } from "@/services/sessionservices";
import { type LoginBody } from "@/types/logintype";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

export async function POST(request: Request) {
  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await loginFromBody(body);

  if (result.status !== 200 || !result.body.userId) {
    return NextResponse.json(result.body, { status: result.status });
  }

  try {
    const { token, expiresAt } = await createSession(result.body.userId);
    const response = NextResponse.json(
      { message: result.body.message ?? "Login successful" },
      { status: 200 },
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

    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: 500 },
    );
  }
}
