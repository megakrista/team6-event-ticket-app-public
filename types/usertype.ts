import type { UserRole } from "@prisma/client";

export type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  createdAt: Date;
};

export type AdminUserListItem = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole;
  createdAt: Date;
};

export type AdminUserInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: UserRole;
};

export type UserValidationErrors = { [field: string]: string };

type UserValidationFailure = {
  status: 400;
  validationErrors: UserValidationErrors;
};

type UserWriteError =
  | { status: 400; error: string }
  | { status: 404; error: "User not found" }
  | { status: 500; error: "Internal server error" };

type UserWriteSuccess = {
  status: 200;
  user: AdminUserListItem;
};

export type UserWriteResult =
  | UserValidationFailure
  | UserWriteError
  | UserWriteSuccess;