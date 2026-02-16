import { randomUUID } from "node:crypto";

export const weightedPick = <T extends { weight: number }>(items: T[]): T => {
  const total = items.reduce((acc, i) => acc + i.weight, 0);
  let roll = Math.random() * total;
  for (const i of items) {
    roll -= i.weight;
    if (roll <= 0) return i;
  }
  return items[items.length - 1];
};

export const rollLevel = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const createEncounterId = () => randomUUID();
