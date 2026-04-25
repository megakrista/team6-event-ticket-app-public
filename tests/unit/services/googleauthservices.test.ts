import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  oAuthAccount: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
}));

import {
  buildGoogleAuthorizationUrl,
  exchangeCodeForGoogleIdToken,
  findOrCreateGoogleUserId,
  verifyGoogleIdToken,
} from "@/services/googleauthservices";

function createIdToken(payload: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${body}.sig`;
}

function prismaKnownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("db error", {
    code,
    clientVersion: "test",
  });
}

beforeEach(() => {
  prismaMock.$transaction.mockReset();
  prismaMock.oAuthAccount.findUnique.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  process.env.GOOGLE_CLIENT_ID = "google-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "google-secret";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/callback";
});

describe("buildGoogleAuthorizationUrl", () => {
  it("returns null when Google config is missing", () => {
    delete process.env.GOOGLE_CLIENT_SECRET;

    expect(buildGoogleAuthorizationUrl("state-1")).toBeNull();
  });

  it("returns fully configured URL", () => {
    const url = buildGoogleAuthorizationUrl("state-1");
    expect(url).not.toBeNull();
    const parsed = new URL(url!);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(parsed.searchParams.get("client_id")).toBe("google-client-id");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/callback",
    );
    expect(parsed.searchParams.get("scope")).toBe("openid email profile");
    expect(parsed.searchParams.get("state")).toBe("state-1");
  });
});

describe("exchangeCodeForGoogleIdToken", () => {
  it("returns null when config is missing", async () => {
    delete process.env.GOOGLE_CLIENT_ID;

    await expect(exchangeCodeForGoogleIdToken("code")).resolves.toBeNull();
  });

  it("returns null when google token endpoint is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    );

    await expect(exchangeCodeForGoogleIdToken("code")).resolves.toBeNull();
  });

  it("returns id_token when google exchange succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id_token: "id-token" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(exchangeCodeForGoogleIdToken("code")).resolves.toBe("id-token");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
      }),
    );
  });

  it("returns null when payload has no id_token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    );

    await expect(exchangeCodeForGoogleIdToken("code")).resolves.toBeNull();
  });
});

describe("verifyGoogleIdToken", () => {
  it("returns null for invalid token format", () => {
    expect(verifyGoogleIdToken("not-a-jwt")).toBeNull();
  });

  it("returns null when issuer is invalid", () => {
    const token = createIdToken({
      iss: "invalid-issuer",
      aud: "google-client-id",
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: "sub-1",
      email: "user@example.com",
      email_verified: true,
    });

    expect(verifyGoogleIdToken(token)).toBeNull();
  });

  it("returns null when audience does not match", () => {
    const token = createIdToken({
      iss: "accounts.google.com",
      aud: "other-client-id",
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: "sub-1",
      email: "user@example.com",
      email_verified: true,
    });

    expect(verifyGoogleIdToken(token)).toBeNull();
  });

  it("returns null when token is expired", () => {
    const token = createIdToken({
      iss: "accounts.google.com",
      aud: "google-client-id",
      exp: Math.floor(Date.now() / 1000) - 1,
      sub: "sub-1",
      email: "user@example.com",
      email_verified: true,
    });

    expect(verifyGoogleIdToken(token)).toBeNull();
  });

  it("returns null when email is not verified", () => {
    const token = createIdToken({
      iss: "accounts.google.com",
      aud: "google-client-id",
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: "sub-1",
      email: "user@example.com",
      email_verified: false,
    });

    expect(verifyGoogleIdToken(token)).toBeNull();
  });

  it("returns normalized profile with fallback names and truncation", () => {
    const token = createIdToken({
      iss: "https://accounts.google.com",
      aud: ["other", "google-client-id"],
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: "sub-1",
      email: "USER@EXAMPLE.COM",
      email_verified: "true",
      given_name: "A".repeat(60),
      family_name: "B".repeat(60),
    });

    expect(verifyGoogleIdToken(token)).toEqual({
      sub: "sub-1",
      email: "user@example.com",
      firstName: "A".repeat(50),
      lastName: "B".repeat(50),
    });
  });
});

describe("findOrCreateGoogleUserId", () => {
  it("returns existing linked active user id", async () => {
    prismaMock.$transaction.mockImplementation(async (cb: (tx: any) => Promise<string | null>) =>
      cb({
        oAuthAccount: {
          findUnique: vi.fn().mockResolvedValue({
            user: { id: "u1", deletedAt: null },
          }),
          create: vi.fn(),
        },
        user: {
          findUnique: vi.fn(),
          create: vi.fn(),
        },
      }),
    );

    await expect(
      findOrCreateGoogleUserId({
        sub: "sub-1",
        email: "user@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
      }),
    ).resolves.toBe("u1");
  });

  it("returns null when linked user is soft-deleted", async () => {
    prismaMock.$transaction.mockImplementation(async (cb: (tx: any) => Promise<string | null>) =>
      cb({
        oAuthAccount: {
          findUnique: vi.fn().mockResolvedValue({
            user: { id: "u1", deletedAt: new Date() },
          }),
          create: vi.fn(),
        },
        user: {
          findUnique: vi.fn(),
          create: vi.fn(),
        },
      }),
    );

    await expect(
      findOrCreateGoogleUserId({
        sub: "sub-1",
        email: "user@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
      }),
    ).resolves.toBeNull();
  });

  it("links existing active user by email", async () => {
    const tx = {
      oAuthAccount: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "oa1" }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "u2", deletedAt: null }),
        create: vi.fn(),
      },
    };
    prismaMock.$transaction.mockImplementation(async (cb: (tx: any) => Promise<string | null>) =>
      cb(tx),
    );

    await expect(
      findOrCreateGoogleUserId({
        sub: "sub-1",
        email: "user@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
      }),
    ).resolves.toBe("u2");
    expect(tx.oAuthAccount.create).toHaveBeenCalledWith({
      data: {
        provider: "google",
        providerAccountId: "sub-1",
        userId: "u2",
      },
    });
  });

  it("creates user + oauth account when no existing user", async () => {
    const tx = {
      oAuthAccount: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "oa1" }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "u3" }),
      },
    };
    prismaMock.$transaction.mockImplementation(async (cb: (tx: any) => Promise<string | null>) =>
      cb(tx),
    );

    await expect(
      findOrCreateGoogleUserId({
        sub: "sub-1",
        email: "user@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
      }),
    ).resolves.toBe("u3");
    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        email: "user@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        passwordHash: null,
      },
      select: { id: true },
    });
  });

  it("returns null when existing user by email is soft-deleted", async () => {
    const tx = {
      oAuthAccount: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "u2", deletedAt: new Date() }),
        create: vi.fn(),
      },
    };
    prismaMock.$transaction.mockImplementation(async (cb: (tx: any) => Promise<string | null>) =>
      cb(tx),
    );

    await expect(
      findOrCreateGoogleUserId({
        sub: "sub-1",
        email: "user@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
      }),
    ).resolves.toBeNull();
  });

  it("handles concurrent create (P2002) by reading existing account", async () => {
    prismaMock.$transaction.mockRejectedValue(prismaKnownError("P2002"));
    prismaMock.oAuthAccount.findUnique.mockResolvedValue({
      user: { id: "u4", deletedAt: null },
    });

    await expect(
      findOrCreateGoogleUserId({
        sub: "sub-1",
        email: "user@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
      }),
    ).resolves.toBe("u4");
  });

  it("returns null for unexpected transaction error", async () => {
    prismaMock.$transaction.mockRejectedValue(new Error("boom"));

    await expect(
      findOrCreateGoogleUserId({
        sub: "sub-1",
        email: "user@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
      }),
    ).resolves.toBeNull();
  });
});
