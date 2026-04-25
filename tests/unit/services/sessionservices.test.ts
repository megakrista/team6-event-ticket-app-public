import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  session: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
}));

import {
  createSession,
  deleteSession,
  getSessionByToken,
  hashSessionToken,
} from "@/services/sessionservices";

beforeEach(() => {
  prismaMock.session.create.mockReset();
  prismaMock.session.findUnique.mockReset();
  prismaMock.session.update.mockReset();
  prismaMock.session.deleteMany.mockReset();
  vi.restoreAllMocks();
});

describe("hashSessionToken", () => {
  it("returns deterministic sha256 hash", () => {
    expect(hashSessionToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("createSession", () => {
  it("creates session with hashed random token and 1h expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));
    vi.spyOn(crypto, "randomBytes").mockImplementation(
      ((size: number) => Buffer.alloc(size, "a")) as typeof crypto.randomBytes,
    );

    const result = await createSession("u1");

    expect(result.token).toBe(Buffer.from("a".repeat(32)).toString("hex"));
    expect(result.expiresAt.toISOString()).toBe("2030-01-01T01:00:00.000Z");
    expect(prismaMock.session.create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        tokenHash: hashSessionToken(result.token),
        expiresAt: new Date("2030-01-01T01:00:00.000Z"),
      },
    });

    vi.useRealTimers();
  });
});

describe("getSessionByToken", () => {
  it("returns null when token is missing", async () => {
    await expect(getSessionByToken(undefined)).resolves.toBeNull();
    expect(prismaMock.session.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when session not found", async () => {
    prismaMock.session.findUnique.mockResolvedValue(null);

    await expect(getSessionByToken("token")).resolves.toBeNull();
  });

  it("returns null when linked user is deleted", async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: "s1",
      tokenHash: "h",
      expiresAt: new Date("2030-01-01T01:00:00.000Z"),
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
      user: { id: "u1", email: "a@b.com", role: "CUSTOMER", deletedAt: new Date() },
    });

    await expect(getSessionByToken("token")).resolves.toBeNull();
  });

  it("returns session untouched when expiry is not near refresh threshold", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));
    const expiresAt = new Date("2030-01-01T00:30:00.000Z");
    prismaMock.session.findUnique.mockResolvedValue({
      id: "s1",
      tokenHash: "h",
      expiresAt,
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
      user: { id: "u1", email: "a@b.com", role: "CUSTOMER", deletedAt: null },
    });

    const result = await getSessionByToken("token");

    expect(prismaMock.session.update).not.toHaveBeenCalled();
    expect(result?.touched).toBe(false);
    expect(result?.expiresAt).toEqual(expiresAt);
    vi.useRealTimers();
  });

  it("refreshes expiry when within threshold and below absolute max", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));
    prismaMock.session.findUnique.mockResolvedValue({
      id: "s1",
      tokenHash: "h",
      expiresAt: new Date("2030-01-01T00:10:00.000Z"),
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
      user: { id: "u1", email: "a@b.com", role: "CUSTOMER", deletedAt: null },
    });
    prismaMock.session.update.mockResolvedValue({
      expiresAt: new Date("2030-01-01T01:00:00.000Z"),
    });

    const result = await getSessionByToken("token");

    expect(prismaMock.session.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { expiresAt: new Date("2030-01-01T01:00:00.000Z") },
      select: { expiresAt: true },
    });
    expect(result?.touched).toBe(true);
    expect(result?.expiresAt.toISOString()).toBe("2030-01-01T01:00:00.000Z");
    vi.useRealTimers();
  });

  it("does not refresh when already at absolute max expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T08:00:00.000Z"));
    const atMax = new Date("2030-01-01T08:00:00.000Z");
    prismaMock.session.findUnique.mockResolvedValue({
      id: "s1",
      tokenHash: "h",
      expiresAt: atMax,
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
      user: { id: "u1", email: "a@b.com", role: "CUSTOMER", deletedAt: null },
    });

    const result = await getSessionByToken("token");

    expect(prismaMock.session.update).not.toHaveBeenCalled();
    expect(result?.touched).toBe(false);
    expect(result?.expiresAt).toEqual(atMax);
    vi.useRealTimers();
  });
});

describe("deleteSession", () => {
  it("no-ops when token is missing", async () => {
    await deleteSession(undefined);
    expect(prismaMock.session.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes by hashed token", async () => {
    await deleteSession("plain-token");

    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: hashSessionToken("plain-token") },
    });
  });
});
