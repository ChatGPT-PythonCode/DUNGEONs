export interface TameInput {
  monsterBaseTameDifficulty: number;
  meatUsed: number;
  hpPct: number;
  playerBonus?: number;
}

export const calculateTameChance = ({
  monsterBaseTameDifficulty,
  meatUsed,
  hpPct,
  playerBonus = 0
}: TameInput): number => {
  const difficultyFactor = 1 - monsterBaseTameDifficulty;
  const meatFactor = Math.log2(meatUsed + 1) * 0.18;
  const hpFactor = (1 - hpPct) * 0.45;
  const chance = difficultyFactor * 0.35 + meatFactor + hpFactor + playerBonus;
  return Math.max(0.05, Math.min(0.95, chance));
};
