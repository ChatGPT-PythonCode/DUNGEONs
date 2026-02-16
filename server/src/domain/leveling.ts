import { STAT_POINTS_PER_LEVEL } from "@dungeons/shared";

const EXP_PER_LEVEL = 100;

export const applyExp = (level: number, exp: number, gained: number) => {
  let currentLevel = level;
  let currentExp = exp + gained;
  let levelsGained = 0;
  while (currentExp >= EXP_PER_LEVEL) {
    currentExp -= EXP_PER_LEVEL;
    currentLevel += 1;
    levelsGained += 1;
  }
  return {
    level: currentLevel,
    exp: currentExp,
    levelsGained,
    statPointsAwarded: levelsGained * STAT_POINTS_PER_LEVEL
  };
};
