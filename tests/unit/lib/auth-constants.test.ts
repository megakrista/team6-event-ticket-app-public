import { describe, expect, it } from "vitest";

import {
  GOOGLE_OAUTH_STATE_COOKIE_MAX_AGE_SECONDS,
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@/lib/auth-constants";

describe("auth constants", () => {
  it("defines stable cookie names and max age", () => {
    expect(SESSION_COOKIE_NAME).toBe("session");
    expect(GOOGLE_OAUTH_STATE_COOKIE_NAME).toBe("google_oauth_state");
    expect(GOOGLE_OAUTH_STATE_COOKIE_MAX_AGE_SECONDS).toBe(600);
  });
});
