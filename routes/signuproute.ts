import { NextResponse } from "next/server";
import { createUserFromSignupBody } from "../services/signupservices";
import { type SignupBody } from "../types/signuptype";

export async function postSignupRoute(request: Request) {
  let body: SignupBody;

  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await createUserFromSignupBody(body);

  return NextResponse.json(result.body, { status: result.status });
}
