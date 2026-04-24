import { NextResponse, type NextRequest } from "next/server";
import { deleteSession } from "@/services/sessionservices";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { error } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  try {
    await deleteSession(token);
  } catch {
    return error("Logout failed. Please try again.", 500);
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });

  return response;
}
