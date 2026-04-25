import { describe, expect, it } from "vitest";

import { capitalize, formatDateTime, formatPrice } from "@/lib/format-helpers";

describe("formatDateTime", () => {
  it("formats date into non-empty human-readable string", () => {
    const result = formatDateTime(new Date("2030-01-01T10:30:00.000Z"));

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("formatPrice", () => {
  it("returns Free for zero or negative values", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(-5)).toBe("Free");
  });

  it("formats positive values as EUR currency", () => {
    const result = formatPrice(12.5);

    expect(result).toContain("€");
  });
});

describe("capitalize", () => {
  it("capitalizes first letter", () => {
    expect(capitalize("hello")).toBe("Hello");
  });

  it("returns empty string for empty input", () => {
    expect(capitalize("")).toBe("");
  });
});
