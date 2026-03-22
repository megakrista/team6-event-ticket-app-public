import { NextResponse } from "next/server";
import { loginFromBody } from "../services/loginservices";
import { createSession } from "../services/sessionservices";
import { type LoginBody } from "../types/logintype";

const SESSION_COOKIE_NAME = "session";

export async function postLoginRoute(request: Request) {
  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await loginFromBody(body);
  const response = NextResponse.json(result.body, { status: result.status });

  if(result.status !== 200 || !result.body.userId) return response;

  const {token, expiresAt} = await createSession(result.body.userId);

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
}