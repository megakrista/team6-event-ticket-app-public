import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  normalizeEmail,
  normalizeName,
  validateEmail,
  validateName,
} from "@/lib/user-validation";
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
  const email = normalizeEmail(body.email);
  const firstName = normalizeName(body.firstName);
  const lastName = normalizeName(body.lastName);
  // TODO: remove trim() after password validation.
  const password =
    typeof body.password === "string" ? body.password.trim() : "";

  const emailError = validateEmail(email, { required: true });
  if (emailError) validationErrors.email = emailError;

  if (!password) validationErrors.password = "Required";

  const firstNameError = validateName(firstName, {
    required: true,
    field: "First name",
  });
  if (firstNameError) validationErrors.firstName = firstNameError;

  const lastNameError = validateName(lastName, {
    required: true,
    field: "Last name",
  });
  if (lastNameError) validationErrors.lastName = lastNameError;

  if (Object.keys(validationErrors).length > 0) {
    return {
      normalizedBody: null,
      validationErrors,
    };
  }

  return {
    normalizedBody: {
      email: email!,
      password,
      firstName: firstName!,
      lastName: lastName!,
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
