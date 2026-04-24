import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
}));

import { getUserById, updateUser } from "@/services/userservices";

beforeEach(() => {
  prismaMock.user.findUnique.mockReset();
  prismaMock.user.update.mockReset();
});

describe("getUserById", () => {
  it("returns 404 when user is missing", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(getUserById("u1")).resolves.toEqual({
      status: 404,
      error: "User not found",
    });
  });

  it("returns mapped user response with fullName", async () => {
    const createdAt = new Date("2030-01-01T00:00:00.000Z");
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      firstName: "Ada",
      lastName: "Lovelace",
      createdAt,
    });

    await expect(getUserById("u1")).resolves.toEqual({
      status: 200,
      user: {
        id: "u1",
        email: "a@b.com",
        firstName: "Ada",
        lastName: "Lovelace",
        fullName: "Ada Lovelace",
        createdAt,
      },
    });
  });
});

describe("updateUser", () => {
  it("returns validation errors for bad firstName/lastName/email", async () => {
    const result = await updateUser("u1", {
      firstName: "",
      lastName: "x".repeat(51),
      email: "not-an-email",
    });

    expect(result).toEqual({
      status: 400,
      validationErrors: {
        firstName: "First name must be 1-50 characters",
        lastName: "Last name must be 1-50 characters",
        email: "Invalid email format",
      },
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("returns 400 when there is nothing to update", async () => {
    await expect(updateUser("u1", {})).resolves.toEqual({
      status: 400,
      error: "No fields to update",
    });
  });

  it("updates user with normalized values", async () => {
    const createdAt = new Date("2030-01-01T00:00:00.000Z");
    prismaMock.user.update.mockResolvedValue({
      id: "u1",
      email: "new@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      createdAt,
    });

    const result = await updateUser("u1", {
      firstName: "  Ada ",
      lastName: " Lovelace ",
      email: " NEW@EXAMPLE.COM ",
    });

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "new@example.com",
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });
    expect(result).toEqual({
      status: 200,
      user: {
        id: "u1",
        email: "new@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        fullName: "Ada Lovelace",
        createdAt,
      },
    });
  });

  it("returns 404 on P2025", async () => {
    prismaMock.user.update.mockRejectedValue({ code: "P2025" });

    await expect(updateUser("u1", { firstName: "Ada" })).resolves.toEqual({
      status: 404,
      error: "User not found",
    });
  });

  it("returns 400 on P2002 duplicate email", async () => {
    prismaMock.user.update.mockRejectedValue({ code: "P2002" });

    await expect(updateUser("u1", { email: "a@b.com" })).resolves.toEqual({
      status: 400,
      error: "Email already in use",
    });
  });

  it("returns 500 on unexpected update error", async () => {
    prismaMock.user.update.mockRejectedValue(new Error("boom"));

    await expect(updateUser("u1", { firstName: "Ada" })).resolves.toEqual({
      status: 500,
      error: "Failed to update user",
    });
  });
});
