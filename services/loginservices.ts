import bcrypt from "bcrypt";
import prisma from "@/lib/prisma";
import { normalizeEmail } from "@/lib/user-validation";
import {
  type NormalizedLoginBody,
  type LoginBody,
  type LoginServiceResult,
} from "../types/logintype";

function normalizeLoginBody(body: LoginBody): {
  normalizedBody: NormalizedLoginBody | null;
  validationErrors: Record<string, string>;
} {
  const validationErrors: Record<string, string> = {};
  const email = normalizeEmail(body.email);
  // TODO: remove trim() after password validation.
  const password = typeof body.password === "string" ? body.password.trim() : "";

  if (!email) validationErrors.email = "Required";
  if (!password) validationErrors.password = "Required";

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
    },
    validationErrors,
  };
}

export async function loginFromBody(body: LoginBody): Promise<LoginServiceResult> {
  const { normalizedBody, validationErrors } = normalizeLoginBody(body);

  if (!normalizedBody) {
    return {
      status: 400,
      body: {
        error: "Email and password are required",
        fields: validationErrors,
      },
    };
  }

  try {
    const user = await prisma.user.findUnique({
      where: {email: normalizedBody.email},
      select: {id: true, passwordHash: true, deletedAt: true},
    });

    if(!user || user.deletedAt){
      return {
        status: 401,
        body: {
          error: "Invalid email or password",
        },
      };
    }

    if (!user.passwordHash) {
      return {
        status: 401,
        body: {
          error: "This account uses Google sign-in. Continue with Google.",
        },
      };
    }

    const isPasswordValid = await bcrypt.compare(normalizedBody.password, user.passwordHash);

    if(!isPasswordValid){
      return {
        status: 401,
        body: {
          error: "Invalid email or password",
        },
      };
    }

    return {
      status: 200,
      body: {
        message: "Login successful",
        userId: user.id,
      },
    };
  } catch {
    return {
      status: 500,
      body: {
        error: "Internal server error",
      },
    };
  }
}
