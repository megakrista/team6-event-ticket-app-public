import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  type NormalizedSignupBody,
  type SignupBody,
  type SignupServiceResult,
} from "../types/signuptype";

function normalizeSignupBody(body: SignupBody): {
  normalizedBody: NormalizedSignupBody | null;
  validationErrors: Record<string, string>;
} {
  const validationErrors: Record<string, string> = {};
  const email = typeof body.email === "string" ? body.email.trim() : "";
  // TODO: remove trim() after password validation.
  const password =
    typeof body.password === "string" ? body.password.trim() : "";
  const firstName =
    typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";

  if (!email) {
    validationErrors.email = "Required";
  }

  if (!password) {
    validationErrors.password = "Required";
  }

  if (!firstName) {
    validationErrors.firstName = "Required";
  }

  if (!lastName) {
    validationErrors.lastName = "Required";
  }

  if (Object.keys(validationErrors).length > 0) {
    return {
      normalizedBody: null,
      validationErrors,
    };
  }

  return {
    normalizedBody: {
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
    },
    validationErrors,
  };
}

export async function createUserFromSignupBody(
  body: SignupBody,
): Promise<SignupServiceResult> {
  const { normalizedBody, validationErrors } = normalizeSignupBody(body);

  if (!normalizedBody) {
    return {
      status: 400,
      body: {
        error: "Email, password, first name, and last name are required",
        fields: validationErrors,
      },
    };
  }

  try {
    const passwordHash = await bcrypt.hash(normalizedBody.password, 10);

    const user = await prisma.user.create({
      data: {
        email: normalizedBody.email,
        passwordHash,
        firstName: normalizedBody.firstName,
        lastName: normalizedBody.lastName,
      },
      select: {
        id: true,
      },
    });

    return {
      status: 201,
      body: {
        message: "User created",
        userId: user.id,
      },
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        status: 409,
        body: {
          error: "Email already in use",
        },
      };
    }

    return {
      status: 500,
      body: {
        error: "Internal server error",
      },
    };
  }
}
