import { describe, it, expect } from "vitest";
import { cn, formatCurrency, formatDate } from "./utils";

describe("cn", () => {
  it("should merge tailwind classes correctly", () => {
    const result = cn("px-2", "py-2", "px-4");
    expect(result).toContain("py-2");
    expect(result).toContain("px-4");
    expect(result).not.toContain("px-2 px-4");
  });

  it("should handle conditional classes", () => {
    const isActive = true;
    const result = cn("base", isActive && "active", !isActive && "inactive");
    expect(result).toContain("base");
    expect(result).toContain("active");
    expect(result).not.toContain("inactive");
  });

  it("should handle arrays of classes", () => {
    const result = cn(["class1", "class2"], "class3");
    expect(result).toContain("class1");
    expect(result).toContain("class2");
    expect(result).toContain("class3");
  });

  it("should handle objects", () => {
    const result = cn({ active: true, disabled: false });
    expect(result).toBe("active");
  });
});

describe("formatCurrency", () => {
  it("should format BRL currency correctly", () => {
    expect(formatCurrency(100)).toBe("R$\u00a0100,00");
    expect(formatCurrency(1000.5)).toBe("R$\u00a01.000,50");
    expect(formatCurrency(0)).toBe("R$\u00a00,00");
  });

  it("should handle negative values", () => {
    expect(formatCurrency(-100)).toBe("-R$\u00a0100,00");
  });

  it("should handle decimal values", () => {
    expect(formatCurrency(99.99)).toBe("R$\u00a099,99");
    expect(formatCurrency(0.01)).toBe("R$\u00a00,01");
  });
});

describe("formatDate", () => {
  it("should format date in Brazilian format", () => {
    const date = new Date("2024-03-15T14:30:00").toISOString();
    const formatted = formatDate(date);
    expect(formatted).toContain("15/03/2024");
    expect(formatted).toContain("14:30");
  });

  it("should handle different dates", () => {
    const date1 = new Date("2023-12-25T10:00:00").toISOString();
    const formatted1 = formatDate(date1);
    expect(formatted1).toContain("25/12/2023");

    const date2 = new Date("2024-01-01T00:00:00").toISOString();
    const formatted2 = formatDate(date2);
    expect(formatted2).toContain("01/01/2024");
  });
});
