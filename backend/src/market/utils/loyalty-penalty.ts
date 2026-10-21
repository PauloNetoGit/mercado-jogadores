const DAY_MS = 86_400_000;

const PENALTY_TIERS: { upToDays: number; rate: number }[] = [
  { upToDays: 0, rate: 0 },
  { upToDays: 30, rate: 5 },
  { upToDays: 180, rate: 10 },
  { upToDays: Number.POSITIVE_INFINITY, rate: 20 },
];

/** RN15: dias restantes (arredondados para cima, 0 se já passou) e o percentual da multa. */
export function calculateLoyaltyPenalty(
  loyaltyUntil: Date,
  now: Date = new Date(),
) {
  const remainingMs = loyaltyUntil.getTime() - now.getTime();
  const remainingDays = remainingMs <= 0 ? 0 : Math.ceil(remainingMs / DAY_MS);
  const penaltyRate = PENALTY_TIERS.find(
    (tier) => remainingDays <= tier.upToDays,
  )!.rate;
  return { remainingDays, penaltyRate };
}
