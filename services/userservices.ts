import { UserRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import { UUID_RE } from "@/lib/uuid";
import {
  normalizeEmail,
  normalizeName,
  validateEmail,
  validateName,
} from "@/lib/user-validation";
import type {
  AdminUserListItem,
  AdminUserInput,
  UserValidationErrors,
  UserWriteResult,
} from "@/types/usertype";

class LastAdminError extends Error {}

type AdminUserEvent =
  | "admin.user.update"
  | "admin.user.role_change"
  | "admin.user.delete";

function logAdminUserEvent(
  event: AdminUserEvent,
  payload: { actorId: string; targetId: string; role?: UserRole },
) {
  console.log(
    JSON.stringify({
      event,
      ...payload,
      at: new Date().toISOString(),
    }),
  );
}

async function runWithSerializableRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as { code?: string }).code
          : undefined;
      if (code !== "P2034") throw err;
      lastErr = err;
    }
  }
  throw lastErr;
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      createdAt: true,
    },
  });

  if (!user) {
    return { status: 404, error: "User not found" };
  }

  return {
    status: 200,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      createdAt: user.createdAt,
    },
  };
}

export type UpdateUserBody = {
  firstName?: string;
  email?: string;
  lastName?: string;
};

export async function updateUser(id: string, body: UpdateUserBody) {
  const errors: Record<string, string> = {};

  const firstName = normalizeName(body.firstName);
  const lastName = normalizeName(body.lastName);
  const email = normalizeEmail(body.email);

  const firstNameError = validateName(firstName, { field: "First name" });
  if (firstNameError) errors.firstName = firstNameError;

  const lastNameError = validateName(lastName, { field: "Last name" });
  if (lastNameError) errors.lastName = lastNameError;

  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;

  if (Object.keys(errors).length > 0) {
    return { status: 400, validationErrors: errors };
  }

  const updateData: { firstName?: string; lastName?: string; email?: string } = {};
  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (email !== undefined) updateData.email = email;

  if (Object.keys(updateData).length === 0) {
    return { status: 400, error: "No fields to update" };
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    return {
      status: 200,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        createdAt: user.createdAt,
      },
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return { status: 404, error: "User not found" };
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return { status: 400, error: "Email already in use" };
    }
    return { status: 500, error: "Failed to update user" };
  }
}

type PrismaAdminUserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  createdAt: Date;
};

function toAdminUserListItem(user: PrismaAdminUserRow): AdminUserListItem {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function validateAdminUserInput(body: AdminUserInput): {
  errors: UserValidationErrors;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: UserRole;
} {
  const errors: UserValidationErrors = {};

  const firstName = normalizeName(body.firstName);
  const lastName = normalizeName(body.lastName);
  const email = normalizeEmail(body.email);

  const firstNameError = validateName(firstName, { field: "First name" });
  if (firstNameError) errors.firstName = firstNameError;

  const lastNameError = validateName(lastName, { field: "Last name" });
  if (lastNameError) errors.lastName = lastNameError;

  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;

  const role =
    body.role === UserRole.USER || body.role === UserRole.ADMIN
      ? body.role
      : undefined;
  if (body.role !== undefined && role === undefined) {
    errors.role = "Role must be USER or ADMIN";
  }

  return { errors, firstName, lastName, email, role };
}

export async function listAdminUsers(): Promise<AdminUserListItem[]> {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      createdAt: true,
    },
  });

  return users.map(toAdminUserListItem);
}

export async function adminUpdateUser(
  id: string,
  body: AdminUserInput,
  actorId: string,
): Promise<UserWriteResult> {
  if (!UUID_RE.test(id)) {
    return { status: 404, error: "User not found" };
  }

  const { errors, firstName, lastName, email, role } =
    validateAdminUserInput(body);
  if (Object.keys(errors).length > 0) {
    return { status: 400, validationErrors: errors };
  }

  const updateData: {
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: UserRole;
  } = {};
  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (email !== undefined) updateData.email = email;

  if (
    Object.keys(updateData).length === 0 &&
    role === undefined
  ) {
    return { status: 400, error: "No fields to update" };
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { deletedAt: true, email: true, role: true },
  });
  if (!existing || existing.deletedAt) {
    return { status: 404, error: "User not found" };
  }

  const emailChanged =
    email !== undefined && email !== existing.email.toLowerCase();
  const roleChanged = role !== undefined && role !== existing.role;

  if (roleChanged && id === actorId) {
    return { status: 400, error: "You cannot change your own role" };
  }

  if (roleChanged) {
    updateData.role = role;
  }

  try {
    const user = await runWithSerializableRetry(() =>
      prisma.$transaction(
        async (tx) => {
          if (
            roleChanged &&
            existing.role === UserRole.ADMIN &&
            role === UserRole.USER
          ) {
            const otherAdmins = await tx.user.count({
              where: { role: UserRole.ADMIN, deletedAt: null, NOT: { id } },
            });
            if (otherAdmins === 0) {
              throw new LastAdminError();
            }
          }

          const updated = await tx.user.update({
            where: { id },
            data: updateData,
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              createdAt: true,
            },
          });

          if (emailChanged || roleChanged) {
            await tx.session.deleteMany({ where: { userId: id } });
          }

          return updated;
        },
        { isolationLevel: "Serializable" },
      ),
    );

    logAdminUserEvent(
      roleChanged ? "admin.user.role_change" : "admin.user.update",
      { actorId, targetId: id, role: user.role },
    );

    return { status: 200, user: toAdminUserListItem(user) };
  } catch (err: unknown) {
    if (err instanceof LastAdminError) {
      return { status: 400, error: "At least one admin must remain" };
    }
    if (err && typeof err === "object" && "code" in err) {
      if (err.code === "P2025") return { status: 404, error: "User not found" };
      if (err.code === "P2002") {
        return {
          status: 400,
          validationErrors: { email: "Email already in use" },
        };
      }
    }
    return { status: 500, error: "Internal server error" };
  }
}

export async function adminSoftDeleteUser(
  id: string,
  actorId: string,
): Promise<UserWriteResult> {
  if (!UUID_RE.test(id)) {
    return { status: 404, error: "User not found" };
  }

  if (id === actorId) {
    return { status: 400, error: "You cannot delete your own account" };
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { id },
      select: { deletedAt: true },
    });
    if (!existing || existing.deletedAt) {
      return { status: 404, error: "User not found" };
    }

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { deletedAt: new Date() },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
        },
      });
      await tx.session.deleteMany({ where: { userId: id } });
      return updated;
    });

    logAdminUserEvent("admin.user.delete", { actorId, targetId: id });

    return { status: 200, user: toAdminUserListItem(user) };
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "P2025"
    ) {
      return { status: 404, error: "User not found" };
    }
    return { status: 500, error: "Internal server error" };
  }
}