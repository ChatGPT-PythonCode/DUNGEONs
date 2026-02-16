import fs from "node:fs";
import path from "node:path";
import { weightedPick } from "./encounter.js";

type BreedEntry = { parentA: string; parentB: string; results: { speciesId: string; weight: number }[] };
const table = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "content", "breedResults.json"), "utf8")
) as BreedEntry[];

export const resolveOffspringSpecies = (a: string, b: string): string => {
  const match = table.find(
    (entry) =>
      (entry.parentA === a && entry.parentB === b) ||
      (entry.parentA === b && entry.parentB === a)
  );

  if (match) return weightedPick(match.results).speciesId;
  return Math.random() > 0.5 ? a : b;
};

export const statVariation = () => Math.floor(Math.random() * 5) - 2;
