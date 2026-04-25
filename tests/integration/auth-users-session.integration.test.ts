import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { loginFromBody } from "@/services/loginservices";
import { createSession, deleteSession, getSessionByToken, hashSessionToken } from "@/services/sessionservices";
import { createUserFromSignupBody } from "@/services/signupservices";
import { getUserById, updateUser } from "@/services/userservices";

const MARKER = `it-auth-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

function assertIntegrationDbConfig() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set for integration tests. Configure it in .env or shell env.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("DATABASE_URL is invalid. Expected a valid PostgreSQL connection string.");
  }

  const hasAuth = parsed.username.length > 0 && parsed.password.length > 0;
  if (!hasAuth) {
    throw new Error(
      "DATABASE_URL must include both username and password for Postgres auth (e.g. postgresql://user:pass@host:5432/db).",
    );
  }
}

function uniqueEmail(label: string): string {
  return `${MARKER}-${label}-${crypto.randomUUID()}@example.com`;
}

async function cleanupIntegrationRecords() {
  await prisma.session.deleteMany({
    where: { user: { email: { startsWith: `${MARKER}-` } } },
  });

  await prisma.oAuthAccount.deleteMany({
    where: { user: { email: { startsWith: `${MARKER}-` } } },
  });

  await prisma.user.deleteMany({
    where: { email: { startsWith: `${MARKER}-` } },
  });
}

describe.sequential("auth/users/session integration", () => {
  beforeAll(async () => {
    assertIntegrationDbConfig();
    await cleanupIntegrationRecords();
  });

  afterAll(async () => {
    await cleanupIntegrationRecords();
  });

  it("creates a user via signup and authenticates through login", async () => {
    const email = uniqueEmail("signup-login");
    const password = "Secret123!";

    const signup = await createUserFromSignupBody({
      email: ` ${email.toUpperCase()} `,
      password: ` ${password} `,
      firstName: "  Ada ",
      lastName: " Lovelace  ",
    });

    expect(signup.status).toBe(201);
    if (signup.status !== 201 || !signup.body.userId) {
      return;
    }

    const createdUser = await prisma.user.findUnique({
      where: { id: signup.body.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        passwordHash: true,
      },
    });

    expect(createdUser?.email).toBe(email.toLowerCase());
    expect(createdUser?.firstName).toBe("Ada");
    expect(createdUser?.lastName).toBe("Lovelace");
    expect(createdUser?.passwordHash).toBeTruthy();
    expect(createdUser?.passwordHash).not.toBe(password);

    const login = await loginFromBody({
      email: ` ${email.toUpperCase()} `,
      password: ` ${password} `,
    });

    expect(login).toEqual({
      status: 200,
      body: {
        message: "Login successful",
        userId: signup.body.userId,
      },
    });
  });

  it("returns 409 on duplicate signup email", async () => {
    const email = uniqueEmail("signup-dup");

    const first = await createUserFromSignupBody({
      email,
      password: "Secret123!",
      firstName: "First",
      lastName: "User",
    });
    expect(first.status).toBe(201);

    const second = await createUserFromSignupBody({
      email: email.toUpperCase(),
      password: "AnotherSecret123!",
      firstName: "Second",
      lastName: "User",
    });

    expect(second).toEqual({
      status: 409,
      body: {
        error: "Email already in use",
      },
    });
  });

  it("returns google sign-in guidance for users without password hashes", async () => {
    const email = uniqueEmail("google-only");
    await prisma.user.create({
      data: {
        email,
        firstName: "Google",
        lastName: "Only",
        passwordHash: null,
      },
    });

    const login = await loginFromBody({
      email,
      password: "irrelevant",
    });

    expect(login).toEqual({
      status: 401,
      body: {
        error: "This account uses Google sign-in. Continue with Google.",
      },
    });
  });

  it("creates, reads, and deletes sessions through service APIs", async () => {
    const email = uniqueEmail("session");
    const signup = await createUserFromSignupBody({
      email,
      password: "Secret123!",
      firstName: "Session",
      lastName: "User",
    });

    expect(signup.status).toBe(201);
    if (signup.status !== 201 || !signup.body.userId) {
      return;
    }

    const created = await createSession(signup.body.userId);
    expect(created.token.length).toBeGreaterThan(0);

    const fetched = await getSessionByToken(created.token);
    expect(fetched?.user.id).toBe(signup.body.userId);
    expect(fetched?.touched).toBe(false);

    await deleteSession(created.token);
    await expect(getSessionByToken(created.token)).resolves.toBeNull();

    const remaining = await prisma.session.count({
      where: { tokenHash: hashSessionToken(created.token) },
    });
    expect(remaining).toBe(0);
  });

  it("updates and fetches users, and blocks duplicate emails", async () => {
    const userOne = await prisma.user.create({
      data: {
        email: uniqueEmail("user-one"),
        firstName: "Initial",
        lastName: "Name",
      },
    });
    const userTwo = await prisma.user.create({
      data: {
        email: uniqueEmail("user-two"),
        firstName: "Other",
        lastName: "User",
      },
    });

    const nextEmail = uniqueEmail("updated");
    const updated = await updateUser(userOne.id, {
      firstName: "  Grace ",
      lastName: " Hopper  ",
      email: ` ${nextEmail.toUpperCase()} `,
    });

    expect(updated.status).toBe(200);
    const updatedUser = "user" in updated ? updated.user : undefined;
    if (updated.status !== 200 || !updatedUser) {
      return;
    }
    expect(updatedUser.email).toBe(nextEmail.toLowerCase());
    expect(updatedUser.fullName).toBe("Grace Hopper");

    const loaded = await getUserById(userOne.id);
    expect(loaded.status).toBe(200);
    const loadedUser = "user" in loaded ? loaded.user : undefined;
    if (loaded.status !== 200 || !loadedUser) {
      return;
    }
    expect(loadedUser.email).toBe(nextEmail.toLowerCase());
    expect(loadedUser.fullName).toBe("Grace Hopper");

    const duplicate = await updateUser(userOne.id, {
      email: userTwo.email.toUpperCase(),
    });
    expect(duplicate).toEqual({
      status: 400,
      error: "Email already in use",
    });
  });
});
