const DAY_MS = 86_400_000;

export function calculateLoyaltyPenalty(loyaltyUntil: Date, now: Date = new Date()) {
  const remainingMs = loyaltyUntil.getTime() - now.getTime();
  const remainingDays = remainingMs <= 0 ? 0 : Math.ceil(remainingMs / DAY_MS);

  const penaltyRate =
    remainingDays === 0 ? 0 :
    remainingDays <= 30 ? 5 :
    remainingDays <= 180 ? 10 : 20;

  return { remainingDays, penaltyRate };
}
