import { error, success, validationError } from "@/lib/api-response";
import { createUserFromSignupBody } from "@/services/signupservices";
import { type SignupBody } from "@/types/signuptype";

export async function POST(request: Request) {
  let body: SignupBody;

  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return error("Invalid JSON body", 400);
  }

  const result = await createUserFromSignupBody(body);

  if (result.status === 400 && result.body.fields) {
    return validationError(
      result.body.fields,
      result.body.error ?? "Validation failed",
    );
  }

  if (result.status >= 400) {
    return error(result.body.error ?? "Sign up failed", result.status);
  }

  return success(result.body, result.status);
}
