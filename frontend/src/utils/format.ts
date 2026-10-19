const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formata valores monetários no padrão da liga: 1.234,50 */
export function formatMoney(value: number | null | undefined): string {
  return moneyFormatter.format(Number(value ?? 0));
}
