/**
 * Regras de validação de clube espelhando o backend (clubs.service.ts).
 * O backend continua sendo a fonte de verdade; aqui evitamos uma viagem
 * desnecessária à API e mostramos a mensagem no campo certo.
 */

export type ClubField = "name" | "acronym";

export interface ClubValidationError {
  field: ClubField;
  message: string;
}

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Mesma chave de unicidade do backend: preserva acentos, ignora caixa. */
export function nameKey(value: string): string {
  return normalizeName(value).toLocaleLowerCase("pt-BR");
}

function lettersOnly(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z]/gi, "")
    .toUpperCase();
}

export function validateClubForm(rawName: string, rawAcronym: string): ClubValidationError | null {
  const name = normalizeName(rawName);
  const words = name.split(" ");

  if (
    name.length < 3 ||
    name.length > 60 ||
    !/^[A-Za-zÀ-ÖØ-öø-ÿ .-]+$/.test(name) ||
    words.length < 2 ||
    words.length > 5
  ) {
    return {
      field: "name",
      message:
        "O nome deve ter de 3 a 60 caracteres e de 2 a 5 palavras, com apenas letras, espaços, hífen ou ponto.",
    };
  }

  if (!/^[A-Z]{3}$/.test(rawAcronym)) {
    return {
      field: "acronym",
      message: "A sigla deve ter exatamente 3 letras de A a Z, maiúsculas.",
    };
  }

  if (/^([A-Z])\1\1$/.test(rawAcronym)) {
    return {
      field: "acronym",
      message: "A sigla não pode ter as três letras iguais.",
    };
  }

  const letters = lettersOnly(name);
  if (letters.length === 0 || rawAcronym[0] !== letters[0]) {
    return {
      field: "acronym",
      message: "A primeira letra da sigla deve ser a primeira letra do nome.",
    };
  }

  let cursor = 0;
  for (const letter of rawAcronym) {
    const index = letters.indexOf(letter, cursor);
    if (index < 0) {
      return {
        field: "acronym",
        message: "As letras da sigla devem aparecer no nome, nessa mesma ordem.",
      };
    }
    cursor = index + 1;
  }

  return null;
}
