import prisma from "@/lib/prisma";

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

  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : undefined;
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : undefined;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;

  if (firstName !== undefined && (firstName.length < 1 || firstName.length > 50)) {
    errors.firstName = "First name must be 1-50 characters";
  }

  if (lastName !== undefined && (lastName.length < 1 || lastName.length > 50)) {
    errors.lastName = "Last name must be 1-50 characters";
  }

  if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Invalid email format";
  }

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