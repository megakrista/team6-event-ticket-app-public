import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("checkoutRateLimitExceeded", () => {
  it("allows first 25 requests and blocks 26th within window", async () => {
    const { checkoutRateLimitExceeded } = await import("@/lib/checkout-rate-limit");

    let blocked = false;
    for (let i = 0; i < 26; i += 1) {
      blocked = checkoutRateLimitExceeded("ip-1");
    }

    expect(blocked).toBe(true);
  });

  it("resets bucket after window passes", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1_000);

    const { checkoutRateLimitExceeded } = await import("@/lib/checkout-rate-limit");

    for (let i = 0; i < 26; i += 1) {
      checkoutRateLimitExceeded("ip-1");
    }

    nowSpy.mockReturnValue(1_000 + 10 * 60 * 1000 + 1);
    const blockedAfterReset = checkoutRateLimitExceeded("ip-1");

    expect(blockedAfterReset).toBe(false);
  });

  it("tracks keys independently", async () => {
    const { checkoutRateLimitExceeded } = await import("@/lib/checkout-rate-limit");

    for (let i = 0; i < 26; i += 1) {
      checkoutRateLimitExceeded("ip-1");
    }

    expect(checkoutRateLimitExceeded("ip-2")).toBe(false);
  });
});

describe("clientIpFromRequest", () => {
  it("uses first x-forwarded-for ip", async () => {
    const { clientIpFromRequest } = await import("@/lib/checkout-rate-limit");
    const request = new Request("https://example.test", {
      headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" },
    });

    expect(clientIpFromRequest(request)).toBe("1.1.1.1");
  });

  it("falls back to x-real-ip then unknown", async () => {
    const { clientIpFromRequest } = await import("@/lib/checkout-rate-limit");

    const withRealIp = new Request("https://example.test", {
      headers: { "x-real-ip": " 3.3.3.3 " },
    });
    const withoutIp = new Request("https://example.test");

    expect(clientIpFromRequest(withRealIp)).toBe("3.3.3.3");
    expect(clientIpFromRequest(withoutIp)).toBe("unknown");
  });
});
