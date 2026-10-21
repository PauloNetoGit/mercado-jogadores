import { BadRequestException } from '@nestjs/common';
import { foldText, wordsOf } from '../../common/text';

const NAME_PATTERN = /^[\p{L} .-]+$/u;
const ACRONYM_PATTERN = /^[A-Z]{3}$/;

/** Nome do clube, já normalizado pela V4: 3 a 60 caracteres, 2 a 5 palavras, só letras, espaço, hífen e ponto. */
export function assertValidClubName(name: string): void {
  const words = wordsOf(name).length;
  if (
    name.length < 3 ||
    name.length > 60 ||
    words < 2 ||
    words > 5 ||
    !NAME_PATTERN.test(name)
  ) {
    throw new BadRequestException(
      'name deve ter de 3 a 60 caracteres e de 2 a 5 palavras, só com letras, espaços, hífen e ponto.',
    );
  }
}

/**
 * Sigla: 3 letras de A a Z maiúsculas, que aparecem no nome nessa ordem (sem diferenciar
 * maiúsculas, minúsculas e acentos), a primeira sendo a primeira letra do nome, e nunca as três iguais.
 */
export function assertValidAcronym(name: string, acronym: string): void {
  if (!ACRONYM_PATTERN.test(acronym) || new Set(acronym).size === 1) {
    throw new BadRequestException(
      'acronym deve ter exatamente 3 letras maiúsculas de A a Z, não todas iguais.',
    );
  }

  const letters = foldText(name)
    .replace(/[^a-z]/g, '')
    .toUpperCase();
  let cursor = 0;
  for (const letter of acronym) {
    const index = letters.indexOf(letter, cursor);
    if (index < 0) {
      throw new BadRequestException(
        'As letras de acronym devem aparecer no nome, nessa ordem.',
      );
    }
    cursor = index + 1;
  }
  if (acronym[0] !== letters[0]) {
    throw new BadRequestException(
      'A primeira letra de acronym deve ser a primeira letra do nome.',
    );
  }
}

/** RN10: o nome é único ignorando maiúsculas e minúsculas, mas considerando acentos. */
export function clubNameKey(name: string): string {
  return name.toLowerCase();
}
