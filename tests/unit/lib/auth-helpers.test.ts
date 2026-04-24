import { beforeEach, describe, expect, it, vi } from "vitest";

const cookiesMock = vi.hoisted(() => vi.fn());
const getSessionByTokenMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/services/sessionservices", () => ({
  getSessionByToken: getSessionByTokenMock,
}));

import { getCurrentUser, requireAdmin, requireAuth } from "@/lib/auth-helpers";

beforeEach(() => {
  cookiesMock.mockReset();
  getSessionByTokenMock.mockReset();
});

describe("requireAuth / getCurrentUser", () => {
  it("returns unauthorized when no valid session", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    });
    getSessionByTokenMock.mockResolvedValue(null);

    const result = await requireAuth();

    expect(getSessionByTokenMock).toHaveBeenCalledWith(undefined);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected auth failure");
    }
    expect(result.response.status).toBe(401);
    await expect(result.response.json()).resolves.toEqual({
      error: "Unauthorized",
    });
  });

  it("returns authenticated session when token is valid", async () => {
    const session = {
      session: { id: "s1" },
      user: { id: "u1", role: "ADMIN", deletedAt: null },
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      touched: false,
    };
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "token-1" }),
    });
    getSessionByTokenMock.mockResolvedValue(session);

    const result = await requireAuth();

    expect(result).toEqual({ ok: true, session });
  });

  it("getCurrentUser aliases requireAuth", async () => {
    const session = {
      session: { id: "s1" },
      user: { id: "u1", role: "USER", deletedAt: null },
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      touched: false,
    };
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "token-1" }),
    });
    getSessionByTokenMock.mockResolvedValue(session);

    const result = await getCurrentUser();

    expect(result).toEqual({ ok: true, session });
  });
});

describe("requireAdmin", () => {
  it("returns auth failure when user is not authenticated", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    });
    getSessionByTokenMock.mockResolvedValue(null);

    const result = await requireAdmin();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected auth failure");
    }
    expect(result.response.status).toBe(401);
    await expect(result.response.json()).resolves.toEqual({
      error: "Unauthorized",
    });
  });

  it("returns forbidden for authenticated non-admin user", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "token-1" }),
    });
    getSessionByTokenMock.mockResolvedValue({
      session: { id: "s1" },
      user: { id: "u1", role: "USER", deletedAt: null },
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      touched: false,
    });

    const result = await requireAdmin();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected admin failure");
    }
    expect(result.response.status).toBe(403);
    await expect(result.response.json()).resolves.toEqual({
      error: "Forbidden",
    });
  });

  it("returns session for admin user", async () => {
    const session = {
      session: { id: "s1" },
      user: { id: "u1", role: "ADMIN", deletedAt: null },
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      touched: false,
    };
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "token-1" }),
    });
    getSessionByTokenMock.mockResolvedValue(session);

    const result = await requireAdmin();

    expect(result).toEqual({ ok: true, session });
  });
});
