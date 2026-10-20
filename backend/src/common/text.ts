const COMBINING_MARKS = /\p{Mn}/gu;
const CONTROL_CHARS = /\p{Cc}/u;

/** V4: remove espaços (U+0020) das pontas e reduz os repetidos a um só. */
export function normalizeSpaces(value: string): string {
  return value.replace(/ {2,}/g, ' ').replace(/^ | $/g, '');
}

export function hasControlChars(value: string): boolean {
  return CONTROL_CHARS.test(value);
}

/** Minúsculas e sem acentos (NFD sem marcas Mn), para busca e ordenação. */
export function foldText(value: string): string {
  return value.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

/**
 * Ordem alfabética do enunciado: textos dobrados (minúsculas, sem acento)
 * comparados caractere a caractere pela ordem Unicode.
 */
export function compareNames(a: string, b: string): number {
  const left = foldText(a);
  const right = foldText(b);
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function wordsOf(value: string): string[] {
  return value.split(' ').filter((word) => word.length > 0);
}
