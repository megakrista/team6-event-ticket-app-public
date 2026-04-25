import { describe, expect, it } from "vitest";

import { error, success, validationError } from "@/lib/api-response";

describe("api-response helpers", () => {
  it("success returns json payload with default 200", async () => {
    const response = success({ ok: true });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("success accepts custom status", async () => {
    const response = success({ created: true }, 201);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ created: true });
  });

  it("error wraps message in error field", async () => {
    const response = error("Forbidden", 403);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("validationError returns validation payload with 400", async () => {
    const response = validationError({ email: "Invalid email" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Validation failed",
      fields: { email: "Invalid email" },
    });
  });
});
