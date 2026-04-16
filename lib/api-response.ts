import { NextResponse } from "next/server";

export type ApiFieldErrors = Record<string, string>;

export function success<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function validationError(
  fields: ApiFieldErrors,
  message = "Validation failed",
) {
  return NextResponse.json(
    { error: message, fields },
    { status: 400 },
  );
}
