import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

const readJson = <T>(file: string): T => {
  const p = path.join(process.cwd(), "content", file);
  return JSON.parse(fs.readFileSync(p, "utf8"));
};

async function main() {
  const species = readJson<any[]>("monsterSpecies.json");
  const areas = readJson<any[]>("areas.json");

  for (const s of species) {
    await prisma.monsterSpecies.upsert({
      where: { id: s.id },
      update: {
        name: s.name,
        rarity: s.rarity,
        baseStatsJson: s.baseStats,
        growthJson: s.growth,
        renderSeed: s.renderSeed,
        tameDifficulty: s.tameDifficulty
      },
      create: {
        id: s.id,
        name: s.name,
        rarity: s.rarity,
        baseStatsJson: s.baseStats,
        growthJson: s.growth,
        renderSeed: s.renderSeed,
        tameDifficulty: s.tameDifficulty
      }
    });
  }

  for (const area of areas) {
    await prisma.area.upsert({
      where: { id: area.id },
      update: {
        name: area.name,
        biomeTag: area.biomeTag,
        levelRangeMin: area.levelRangeMin,
        levelRangeMax: area.levelRangeMax,
        encounterTableJson: area.encounterTable
      },
      create: {
        id: area.id,
        name: area.name,
        biomeTag: area.biomeTag,
        levelRangeMin: area.levelRangeMin,
        levelRangeMax: area.levelRangeMax,
        encounterTableJson: area.encounterTable
      }
    });
  }
}

main().finally(async () => prisma.$disconnect());
