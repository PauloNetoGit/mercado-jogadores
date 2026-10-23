import { describe, expect, it } from "vitest";
import { nameKey, validateClubForm } from "@/src/utils/club-validation";

describe("validateClubForm", () => {
  it("aceita nome e sigla válidos", () => {
    expect(validateClubForm("Real Madrid", "RMD")).toBeNull();
  });

  it("exige de 2 a 5 palavras no nome", () => {
    expect(validateClubForm("Flamengo", "FLA")?.field).toBe("name");
  });

  it("exige sigla com 3 letras maiúsculas", () => {
    expect(validateClubForm("Real Madrid", "rm")?.field).toBe("acronym");
  });

  it("recusa as três letras iguais", () => {
    expect(validateClubForm("Real Madrid", "RRR")?.message).toBe(
      "A sigla não pode ter as três letras iguais.",
    );
  });

  it("exige que a sigla comece pela primeira letra do nome", () => {
    expect(validateClubForm("Real Madrid", "MAD")?.message).toBe(
      "A primeira letra da sigla deve ser a primeira letra do nome.",
    );
  });

  it("exige as letras da sigla na ordem em que aparecem no nome", () => {
    expect(validateClubForm("Real Madrid", "RDM")?.message).toBe(
      "As letras da sigla devem aparecer no nome, nessa mesma ordem.",
    );
  });
});

describe("nameKey", () => {
  it("ignora caixa e espaços repetidos, mas preserva acentos", () => {
    expect(nameKey("  São   Paulo ")).toBe("são paulo");
  });
});
