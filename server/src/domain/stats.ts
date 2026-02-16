import { Allocation, Stats } from "@dungeons/shared";

export const sumAllocation = (allocation: Allocation) =>
  allocation.atk + allocation.def + allocation.spd + allocation.hp;

export const buildMaxStats = (
  base: Stats,
  growth: Stats,
  level: number,
  allocation: Allocation
): Stats => ({
  atk: base.atk + growth.atk * (level - 1) + allocation.atk,
  def: base.def + growth.def * (level - 1) + allocation.def,
  spd: base.spd + growth.spd * (level - 1) + allocation.spd,
  hp: base.hp + growth.hp * (level - 1) + allocation.hp * 3
});
