import { describe, expect, it } from "vitest";
import { formatMoney } from "@/src/utils/format";

describe("formatMoney", () => {
  it("usa duas casas e vírgula decimal", () => {
    expect(formatMoney(1234.5)).toBe("1.234,50");
    expect(formatMoney(300)).toBe("300,00");
  });

  it("trata valor ausente como zero", () => {
    expect(formatMoney(null)).toBe("0,00");
    expect(formatMoney(undefined)).toBe("0,00");
  });
});
