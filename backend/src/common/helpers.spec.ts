import { describe, expect, it } from 'vitest';
import { formatBrasilia, parseBrasilia } from './brasilia-time';
import { parsePathId } from './parse-id.pipe';
import { compareNames, normalizeSpaces } from './text';

describe('RN01 data e hora de Brasília', () => {
  it('formata com segundos e -03:00', () => {
    expect(formatBrasilia(new Date('2027-03-02T13:15:30Z'))).toBe(
      '2027-03-02T10:15:30-03:00',
    );
  });

  it('aceita o formato da requisição', () => {
    expect(parseBrasilia('2027-03-02T10:15-03:00')?.toISOString()).toBe(
      '2027-03-02T13:15:00.000Z',
    );
  });

  it.each([
    '2027-03-02T10:15',
    '2027-03-02T10:15Z',
    '2027-02-30T10:15-03:00',
    '2027-03-02T24:00-03:00',
  ])('recusa %s', (value) => {
    expect(parseBrasilia(value)).toBeNull();
  });
});

describe('V8 id na URL', () => {
  it.each(['1', '42', '2147483647'])('aceita %s', (raw) => {
    expect(parsePathId(raw, 'Jogador não encontrado.')).toBe(Number(raw));
  });

  it.each(['abc', '0', '-1', '1.5', '01', '2147483648'])(
    'trata %s como inexistente',
    (raw) => {
      expect(() => parsePathId(raw, 'Jogador não encontrado.')).toThrow(
        'Jogador não encontrado.',
      );
    },
  );
});

describe('texto', () => {
  it('normaliza espaços', () => {
    expect(normalizeSpaces('  Águias   FC ')).toBe('Águias FC');
  });

  it('ordena ignorando acento e caixa', () => {
    expect(
      ['Zé Silva', 'álvaro Dias', 'Bruno Lima'].sort(compareNames),
    ).toEqual(['álvaro Dias', 'Bruno Lima', 'Zé Silva']);
  });
});
