import { Stats } from "@dungeons/shared";

export interface Fighter {
  name: string;
  level: number;
  hp: number;
  stats: Stats;
}

export interface BattleResult {
  winner: "left" | "right";
  rounds: string[];
  leftHp: number;
  rightHp: number;
  expEarned: number;
}

const damage = (attacker: Fighter, defender: Fighter) => {
  const raw = attacker.stats.atk + attacker.level * 1.5 - defender.stats.def * 0.8;
  return Math.max(1, Math.floor(raw));
};

export const simulateBattle = (left: Fighter, right: Fighter): BattleResult => {
  const rounds: string[] = [];
  let leftHp = left.hp;
  let rightHp = right.hp;
  let attacker: "left" | "right" = left.stats.spd >= right.stats.spd ? "left" : "right";

  while (leftHp > 0 && rightHp > 0) {
    if (attacker === "left") {
      const dealt = damage(left, right);
      rightHp = Math.max(0, rightHp - dealt);
      rounds.push(`${left.name} hits ${right.name} for ${dealt}`);
      attacker = "right";
    } else {
      const dealt = damage(right, left);
      leftHp = Math.max(0, leftHp - dealt);
      rounds.push(`${right.name} hits ${left.name} for ${dealt}`);
      attacker = "left";
    }
  }

  const winner = leftHp > 0 ? "left" : "right";
  return {
    winner,
    rounds,
    leftHp,
    rightHp,
    expEarned: winner === "left" ? 35 + right.level * 8 : 0
  };
};
