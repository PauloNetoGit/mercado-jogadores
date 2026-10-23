import { describe, expect, it } from "vitest";
import {
  defaultLoyalty,
  formatBrasilia,
  maskDate,
  maskTime,
  parseLoyalty,
} from "@/src/utils/loyalty";

// 12/10/2026 12:00 em Brasília (15:00 UTC)
const NOW = new Date("2026-10-12T15:00:00Z");

describe("máscaras", () => {
  it("maskDate aplica dd/mm/aaaa enquanto digita", () => {
    expect(maskDate("12112027")).toBe("12/11/2027");
    expect(maskDate("1211")).toBe("12/11");
  });

  it("maskTime aplica hh:mm", () => {
    expect(maskTime("1530")).toBe("15:30");
  });
});

describe("parseLoyalty", () => {
  it("converte a data digitada para o formato com -03:00", () => {
    const result = parseLoyalty("12/11/2027", "15:00", NOW);
    expect(result.value).toBe("2027-11-12T15:00-03:00");
  });

  it("recusa formato inválido, com a mensagem junto ao campo", () => {
    const result = parseLoyalty("2027-11-12", "3pm", NOW);
    expect(result.errors?.date).toBe("Use o formato dd/mm/aaaa.");
    expect(result.errors?.time).toBe("Use o formato hh:mm.");
  });

  it("recusa data inexistente", () => {
    expect(parseLoyalty("31/02/2027", "10:00", NOW).errors?.date).toBe("Essa data não existe.");
  });

  it("recusa data no passado", () => {
    expect(parseLoyalty("01/01/2026", "10:00", NOW).errors?.date).toMatch(
      /depois do momento da compra/,
    );
  });

  it("recusa mais de 1.095 dias", () => {
    expect(parseLoyalty("01/01/2031", "10:00", NOW).errors?.date).toMatch(/1\.095 dias/);
  });
});

describe("defaultLoyalty e formatBrasilia", () => {
  it("sugere o mesmo dia do ano seguinte, na próxima hora cheia (Brasília)", () => {
    expect(defaultLoyalty(NOW)).toEqual({ date: "12/10/2027", time: "13:00" });
  });

  it("mostra a data já no horário de Brasília", () => {
    expect(formatBrasilia("2027-11-12T15:00:00-03:00")).toBe("12/11/2027, 15:00");
  });
});
