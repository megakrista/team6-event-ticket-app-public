import { describe, expect, it } from "vitest";

import { API_ROUTES } from "@/lib/api-routes";

describe("API_ROUTES", () => {
  it("exposes static route paths", () => {
    expect(API_ROUTES.venues).toBe("/api/venues");
    expect(API_ROUTES.events).toBe("/api/events");
    expect(API_ROUTES.signup).toBe("/api/auth/signup");
    expect(API_ROUTES.login).toBe("/api/auth/login");
    expect(API_ROUTES.googleAuthStart).toBe("/api/auth/google/start");
    expect(API_ROUTES.userMe).toBe("/api/users/me");
  });

  it("builds parameterized route paths", () => {
    expect(API_ROUTES.venueById("v1")).toBe("/api/venues/v1");
    expect(API_ROUTES.eventById("e1")).toBe("/api/events/e1");
    expect(API_ROUTES.userById("u1")).toBe("/api/users/u1");
  });
});
