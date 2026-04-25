import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  user: {
    create: vi.fn(),
  },
}));

const bcryptMock = vi.hoisted(() => ({
  hash: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
}));

vi.mock("bcrypt", () => ({
  default: bcryptMock,
}));

import { createUserFromSignupBody } from "@/services/signupservices";

function prismaKnownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("db error", {
    code,
    clientVersion: "test",
  });
}

beforeEach(() => {
  prismaMock.user.create.mockReset();
  bcryptMock.hash.mockReset();
});

describe("createUserFromSignupBody", () => {
  it("returns 400 when required fields are missing", async () => {
    await expect(createUserFromSignupBody({})).resolves.toEqual({
      status: 400,
      body: {
        error: "Email, password, first name, and last name are required",
        fields: {
          email: "Required",
          password: "Required",
          firstName: "Required",
          lastName: "Required",
        },
      },
    });
    expect(bcryptMock.hash).not.toHaveBeenCalled();
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("creates user with normalized email and hashed password", async () => {
    bcryptMock.hash.mockResolvedValue("hashed-pass");
    prismaMock.user.create.mockResolvedValue({ id: "u1" });

    const result = await createUserFromSignupBody({
      email: "  USER@Example.com ",
      password: "  pass123 ",
      firstName: "  Ada ",
      lastName: " Lovelace  ",
    });

    expect(bcryptMock.hash).toHaveBeenCalledWith("pass123", 10);
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        email: "user@example.com",
        passwordHash: "hashed-pass",
        firstName: "Ada",
        lastName: "Lovelace",
      },
      select: { id: true },
    });
    expect(result).toEqual({
      status: 201,
      body: { message: "User created", userId: "u1" },
    });
  });

  it("returns 409 for duplicate email", async () => {
    bcryptMock.hash.mockResolvedValue("hashed-pass");
    prismaMock.user.create.mockRejectedValue(prismaKnownError("P2002"));

    await expect(
      createUserFromSignupBody({
        email: "a@b.com",
        password: "pass",
        firstName: "A",
        lastName: "B",
      }),
    ).resolves.toEqual({
      status: 409,
      body: { error: "Email already in use" },
    });
  });

  it("returns 500 for unexpected DB error", async () => {
    bcryptMock.hash.mockResolvedValue("hashed-pass");
    prismaMock.user.create.mockRejectedValue(new Error("db error"));

    await expect(
      createUserFromSignupBody({
        email: "a@b.com",
        password: "pass",
        firstName: "A",
        lastName: "B",
      }),
    ).resolves.toEqual({
      status: 500,
      body: { error: "Internal server error" },
    });
  });
});
