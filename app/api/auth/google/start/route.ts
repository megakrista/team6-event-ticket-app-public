import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_STATE_COOKIE_MAX_AGE_SECONDS,
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
} from "@/lib/auth-constants";
import { buildGoogleAuthorizationUrl } from "@/services/googleauthservices";

export async function GET() {
  const state = crypto.randomBytes(24).toString("hex");
  const authorizationUrl = buildGoogleAuthorizationUrl(state);

  if (!authorizationUrl) {
    return NextResponse.json(
      { error: "Google OAuth is not configured" },
      { status: 500 },
    );
  }

  const response = NextResponse.redirect(authorizationUrl);

  response.cookies.set({
    name: GOOGLE_OAUTH_STATE_COOKIE_NAME,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GOOGLE_OAUTH_STATE_COOKIE_MAX_AGE_SECONDS,
  });

  return response;
}
