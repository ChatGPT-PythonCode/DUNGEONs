import { PrismaClient } from "@prisma/client";
import { buildMaxStats } from "./stats.js";
import { simulateBattle } from "./battle.js";

export const runTournamentIfReady = async (prisma: PrismaClient, tournamentId: string) => {
  const entries = await prisma.tournamentEntry.findMany({
    where: { tournamentId },
    include: { monster: { include: { species: true } }, user: true }
  });

  if (entries.length < 4) return null;

  await prisma.tournament.update({ where: { id: tournamentId }, data: { status: "running", startedAt: new Date() } });

  let active = [...entries];
  let round = 1;
  while (active.length > 1) {
    const next: typeof active = [];
    for (let i = 0; i < active.length; i += 2) {
      const left = active[i];
      const right = active[i + 1];
      if (!right) {
        next.push(left);
        continue;
      }
      const leftStats = buildMaxStats(left.monster.species.baseStatsJson as any, left.monster.species.growthJson as any, left.monster.level, left.monster.allocatedStatsJson as any);
      const rightStats = buildMaxStats(right.monster.species.baseStatsJson as any, right.monster.species.growthJson as any, right.monster.level, right.monster.allocatedStatsJson as any);
      const result = simulateBattle(
        { name: left.monster.species.name, level: left.monster.level, hp: leftStats.hp, stats: leftStats },
        { name: right.monster.species.name, level: right.monster.level, hp: rightStats.hp, stats: rightStats }
      );
      const loser = result.winner === "left" ? right : left;
      const winner = result.winner === "left" ? left : right;
      await prisma.tournamentEntry.update({ where: { id: loser.id }, data: { eliminatedRound: round, result: "eliminated" } });
      next.push(winner);
    }
    active = next;
    round += 1;
  }

  const champion = active[0];
  await prisma.tournamentEntry.update({ where: { id: champion.id }, data: { result: "winner" } });
  await prisma.inventory.update({ where: { userId: champion.userId }, data: { meat: { increment: 8 } } });
  await prisma.badge.create({ data: { userId: champion.userId, label: "Arena Champion" } });

  await prisma.tournament.update({ where: { id: tournamentId }, data: { status: "finished", endedAt: new Date() } });
  return champion;
};
