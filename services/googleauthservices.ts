import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

const GOOGLE_PROVIDER = "google";
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type GoogleTokenResponse = {
  id_token?: string;
};

type GoogleIdTokenPayload = {
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  given_name?: unknown;
  family_name?: unknown;
  name?: unknown;
};

export type GoogleUserProfile = {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
};

function safeTrim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function truncate(value: string, max = 50): string {
  return value.length > max ? value.slice(0, max) : value;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const normalized = fullName.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { firstName: "", lastName: "" };
  }

  const parts = normalized.split(" ");
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

function parseIdTokenPayload(idToken: string): GoogleIdTokenPayload | null {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf-8");
    const payload = JSON.parse(payloadJson) as unknown;
    if (!payload || typeof payload !== "object") {
      return null;
    }

    return payload as GoogleIdTokenPayload;
  } catch {
    return null;
  }
}

function getVerifiedAudience(
  aud: unknown,
  expectedClientId: string,
): string | null {
  if (typeof aud === "string") {
    return aud === expectedClientId ? aud : null;
  }

  if (Array.isArray(aud) && aud.every((item) => typeof item === "string")) {
    return aud.includes(expectedClientId) ? expectedClientId : null;
  }

  return null;
}

export function buildGoogleAuthorizationUrl(state: string): string | null {
  const config = getGoogleOAuthConfig();
  if (!config) {
    return null;
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForGoogleIdToken(
  code: string,
): Promise<string | null> {
  const config = getGoogleOAuthConfig();
  if (!config) {
    return null;
  }

  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const tokenResult = (await response.json()) as GoogleTokenResponse;
  const idToken = typeof tokenResult.id_token === "string"
    ? tokenResult.id_token
    : null;

  return idToken;
}

export function verifyGoogleIdToken(idToken: string): GoogleUserProfile | null {
  const config = getGoogleOAuthConfig();
  if (!config) {
    return null;
  }

  const payload = parseIdTokenPayload(idToken);
  if (!payload) {
    return null;
  }

  const iss = safeTrim(payload.iss);
  if (!GOOGLE_ISSUERS.has(iss)) {
    return null;
  }

  if (!getVerifiedAudience(payload.aud, config.clientId)) {
    return null;
  }

  if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) {
    return null;
  }

  const sub = safeTrim(payload.sub);
  const email = safeTrim(payload.email).toLowerCase();
  const emailVerified =
    payload.email_verified === true || payload.email_verified === "true";

  if (!sub || !email || !emailVerified) {
    return null;
  }

  const givenName = safeTrim(payload.given_name);
  const familyName = safeTrim(payload.family_name);
  const fullName = safeTrim(payload.name);
  const emailLocalPart = email.split("@")[0] || "Google";
  const splitFromFullName = splitName(fullName);

  const firstName = truncate(
    givenName || splitFromFullName.firstName || emailLocalPart || "Google",
  );
  const lastName = truncate(familyName || splitFromFullName.lastName || "User");

  return {
    sub,
    email,
    firstName,
    lastName,
  };
}

export async function findOrCreateGoogleUserId(
  profile: GoogleUserProfile,
): Promise<string | null> {
  try {
    return await prisma.$transaction(async (tx) => {
      const existingAccount = await tx.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: GOOGLE_PROVIDER,
            providerAccountId: profile.sub,
          },
        },
        select: {
          user: {
            select: {
              id: true,
              deletedAt: true,
            },
          },
        },
      });

      if (existingAccount) {
        if (existingAccount.user.deletedAt) {
          return null;
        }

        return existingAccount.user.id;
      }

      const existingUser = await tx.user.findUnique({
        where: { email: profile.email },
        select: { id: true, deletedAt: true },
      });

      let userId: string;

      if (existingUser) {
        if (existingUser.deletedAt) {
          return null;
        }

        userId = existingUser.id;
      } else {
        const user = await tx.user.create({
          data: {
            email: profile.email,
            firstName: profile.firstName,
            lastName: profile.lastName,
            passwordHash: null,
          },
          select: { id: true },
        });

        userId = user.id;
      }

      await tx.oAuthAccount.create({
        data: {
          provider: GOOGLE_PROVIDER,
          providerAccountId: profile.sub,
          userId,
        },
      });

      return userId;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const account = await prisma.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: GOOGLE_PROVIDER,
            providerAccountId: profile.sub,
          },
        },
        select: {
          user: {
            select: {
              id: true,
              deletedAt: true,
            },
          },
        },
      });

      if (account && !account.user.deletedAt) {
        return account.user.id;
      }
    }

    return null;
  }
}
