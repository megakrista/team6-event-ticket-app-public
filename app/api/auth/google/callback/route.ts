import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@/lib/auth-constants";
import { createSession } from "@/services/sessionservices";
import {
  exchangeCodeForGoogleIdToken,
  findOrCreateGoogleUserId,
  verifyGoogleIdToken,
} from "@/services/googleauthservices";

function buildLoginRedirectUrl(request: NextRequest, oauthError: string): URL {
  const loginUrl = new URL("/login", request.nextUrl.origin);
  loginUrl.searchParams.set("oauthError", oauthError);
  return loginUrl;
}

function clearGoogleStateCookie(response: NextResponse) {
  response.cookies.set({
    name: GOOGLE_OAUTH_STATE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export async function GET(request: NextRequest) {
  const googleError = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const stateFromCookie =
    request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE_NAME)?.value;

  if (googleError || !code || !state || !stateFromCookie || state !== stateFromCookie) {
    const response = NextResponse.redirect(
      buildLoginRedirectUrl(request, "google_auth_failed"),
    );
    clearGoogleStateCookie(response);
    return response;
  }

  const idToken = await exchangeCodeForGoogleIdToken(code);
  if (!idToken) {
    const response = NextResponse.redirect(
      buildLoginRedirectUrl(request, "google_token_failed"),
    );
    clearGoogleStateCookie(response);
    return response;
  }

  const profile = verifyGoogleIdToken(idToken);
  if (!profile) {
    const response = NextResponse.redirect(
      buildLoginRedirectUrl(request, "google_profile_invalid"),
    );
    clearGoogleStateCookie(response);
    return response;
  }

  const userId = await findOrCreateGoogleUserId(profile);
  if (!userId) {
    const response = NextResponse.redirect(
      buildLoginRedirectUrl(request, "google_user_failed"),
    );
    clearGoogleStateCookie(response);
    return response;
  }

  const { token, expiresAt } = await createSession(userId);
  const response = NextResponse.redirect(new URL("/events", request.nextUrl.origin));

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  clearGoogleStateCookie(response);

  return response;
}
