import { beforeEach, describe, expect, it, vi } from "vitest";

const loginFromBodyMock = vi.hoisted(() => vi.fn());
const createSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/services/loginservices", () => ({
  loginFromBody: loginFromBodyMock,
}));

vi.mock("@/services/sessionservices", () => ({
  createSession: createSessionMock,
}));

import { POST } from "@/app/api/auth/login/route";

beforeEach(() => {
  loginFromBodyMock.mockReset();
  createSessionMock.mockReset();
  vi.restoreAllMocks();
});

describe("POST /api/auth/login", () => {
  it("returns 400 for invalid json", async () => {
    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{bad-json",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON body",
    });
  });

  it("forwards non-200 login result", async () => {
    loginFromBodyMock.mockResolvedValue({
      status: 401,
      body: { error: "Invalid email or password" },
    });
    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", password: "bad" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid email or password",
    });
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("creates session cookie for successful login", async () => {
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");
    loginFromBodyMock.mockResolvedValue({
      status: 200,
      body: { message: "Login successful", userId: "u1" },
    });
    createSessionMock.mockResolvedValue({
      token: "session-token",
      expiresAt,
    });
    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", password: "pass" }),
    });

    const response = await POST(request);

    expect(createSessionMock).toHaveBeenCalledWith("u1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "Login successful",
    });
    expect(response.headers.get("set-cookie")).toContain("session=session-token");
  });

  it("returns 500 when session creation fails after successful login", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    loginFromBodyMock.mockResolvedValue({
      status: 200,
      body: { message: "Login successful", userId: "u1" },
    });
    createSessionMock.mockRejectedValue(new Error("session create failed"));
    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", password: "pass" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Login failed. Please try again.",
    });
  });
});
