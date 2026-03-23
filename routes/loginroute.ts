import { NextResponse } from "next/server";
import { loginFromBody } from "../services/loginservices";
import { type LoginBody } from "../types/logintype";

export async function postLoginRoute(request: Request) {
  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await loginFromBody(body);

  return NextResponse.json(result.body, { status: result.status });
}