import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
}));

const bcryptMock = vi.hoisted(() => ({
  compare: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
}));

vi.mock("bcrypt", () => ({
  default: bcryptMock,
}));

import { loginFromBody } from "@/services/loginservices";

beforeEach(() => {
  prismaMock.user.findUnique.mockReset();
  bcryptMock.compare.mockReset();
});

describe("loginFromBody", () => {
  it("returns 400 when email/password are missing", async () => {
    await expect(loginFromBody({ email: "", password: "" })).resolves.toEqual({
      status: 400,
      body: { error: "Email and password are required" },
    });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("normalizes email and password before checking credentials", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      passwordHash: "hash",
      deletedAt: null,
    });
    bcryptMock.compare.mockResolvedValue(true);

    const result = await loginFromBody({
      email: "  USER@Example.com  ",
      password: "  pass123  ",
    });

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
      select: { id: true, passwordHash: true, deletedAt: true },
    });
    expect(bcryptMock.compare).toHaveBeenCalledWith("pass123", "hash");
    expect(result).toEqual({
      status: 200,
      body: { message: "Login successful", userId: "u1" },
    });
  });

  it("returns 401 when user does not exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(loginFromBody({ email: "a@b.com", password: "pass" })).resolves.toEqual({
      status: 401,
      body: { error: "Invalid email or password" },
    });
  });

  it("returns 401 when user is soft-deleted", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      passwordHash: "hash",
      deletedAt: new Date(),
    });

    await expect(loginFromBody({ email: "a@b.com", password: "pass" })).resolves.toEqual({
      status: 401,
      body: { error: "Invalid email or password" },
    });
  });

  it("returns Google sign-in message when account has no password hash", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      passwordHash: null,
      deletedAt: null,
    });

    await expect(loginFromBody({ email: "a@b.com", password: "pass" })).resolves.toEqual({
      status: 401,
      body: {
        error: "This account uses Google sign-in. Continue with Google.",
      },
    });
    expect(bcryptMock.compare).not.toHaveBeenCalled();
  });

  it("returns 401 when password is invalid", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      passwordHash: "hash",
      deletedAt: null,
    });
    bcryptMock.compare.mockResolvedValue(false);

    await expect(loginFromBody({ email: "a@b.com", password: "pass" })).resolves.toEqual({
      status: 401,
      body: { error: "Invalid email or password" },
    });
  });

  it("returns 500 when DB throws", async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error("db down"));

    await expect(loginFromBody({ email: "a@b.com", password: "pass" })).resolves.toEqual({
      status: 500,
      body: { error: "Internal server error" },
    });
  });
});
