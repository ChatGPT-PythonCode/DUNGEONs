import { z } from "zod";

export const StatsSchema = z.object({
  atk: z.number().int().nonnegative(),
  def: z.number().int().nonnegative(),
  spd: z.number().int().nonnegative(),
  hp: z.number().int().positive()
});

export type Stats = z.infer<typeof StatsSchema>;

export const AllocationSchema = z.object({
  atk: z.number().int().nonnegative().default(0),
  def: z.number().int().nonnegative().default(0),
  spd: z.number().int().nonnegative().default(0),
  hp: z.number().int().nonnegative().default(0)
});

export type Allocation = z.infer<typeof AllocationSchema>;

export const RaritySchema = z.enum(["common", "rare", "epic", "legendary"]);
export type Rarity = z.infer<typeof RaritySchema>;

export const STAT_POINTS_PER_LEVEL = 3;
export const STARTER_MEAT = 10;

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const LoginSchema = RegisterSchema;

export const StarterChoiceSchema = z.object({
  speciesId: z.string()
});

export const AllocateStatsSchema = z.object({
  monsterId: z.string(),
  allocations: AllocationSchema
});

export const TameAttemptSchema = z.object({
  encounterId: z.string(),
  meatUsed: z.number().int().min(1).max(20)
});

export const BattleStartSchema = z.object({
  yourMonsterId: z.string(),
  encounterId: z.string().optional(),
  opponentMonsterId: z.string().optional()
});

export const BreedStartSchema = z.object({
  parentAId: z.string(),
  parentBId: z.string()
});

export const JoinTournamentSchema = z.object({
  monsterId: z.string()
});
