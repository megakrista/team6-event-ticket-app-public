import { success, error, validationError } from "@/lib/api-response";
import { type UserWriteResult } from "@/types/usertype";

export function toUserWriteResponse(result: UserWriteResult) {
  if ("validationErrors" in result) {
    return validationError(result.validationErrors);
  }

  if ("error" in result) {
    return error(result.error, result.status);
  }

  return success({ user: result.user }, result.status);
}
