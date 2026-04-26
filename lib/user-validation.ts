/**
 * Field-level validators for user data, shared by signup, login, self-update,
 * and admin-update flows. Keeps email/name rules in one place so they cannot
 * drift between entry points.
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
export const EMAIL_MAX = 254;
export const NAME_MIN = 1;
export const NAME_MAX = 50;

/** Returns trimmed lowercase email, or `undefined` when the field was not a string. */
export function normalizeEmail(input: unknown): string | undefined {
  return typeof input === "string" ? input.trim().toLowerCase() : undefined;
}

/** Returns trimmed name, or `undefined` when the field was not a string. */
export function normalizeName(input: unknown): string | undefined {
  return typeof input === "string" ? input.trim() : undefined;
}

export type ValidateOptions = { required?: boolean };
export type ValidateNameOptions = ValidateOptions & { field?: string };

/**
 * Validates a normalized email value.
 * - `undefined` (field absent) -> "Required" if `required`, else null.
 * - empty string -> "Required" if `required`, else "Invalid email format".
 * - otherwise enforces length cap and RFC-ish regex.
 */
export function validateEmail(
  value: string | undefined,
  opts: ValidateOptions = {},
): string | null {
  if (value === undefined) return opts.required ? "Required" : null;
  if (value.length === 0) return opts.required ? "Required" : "Invalid email format";
  if (value.length > EMAIL_MAX) return "Email is too long";
  if (!EMAIL_RE.test(value)) return "Invalid email format";
  return null;
}

/**
 * Validates a normalized name value (first or last).
 * `field` controls the label used in length errors (e.g. "First name").
 */
export function validateName(
  value: string | undefined,
  opts: ValidateNameOptions = {},
): string | null {
  if (value === undefined) return opts.required ? "Required" : null;
  if (value.length === 0 && opts.required) return "Required";
  if (value.length < NAME_MIN || value.length > NAME_MAX) {
    return `${opts.field ?? "Name"} must be ${NAME_MIN}-${NAME_MAX} characters`;
  }
  return null;
}
