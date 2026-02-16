import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import {
  AllocateStatsSchema,
  BattleStartSchema,
  BreedStartSchema,
  JoinTournamentSchema,
  LoginSchema,
  RegisterSchema,
  STARTER_MEAT,
  StarterChoiceSchema,
  TameAttemptSchema
} from "@dungeons/shared";
import { authMiddleware, AuthedRequest, signToken } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { createEncounterId, rollLevel, weightedPick } from "../domain/encounter.js";
import { buildMaxStats, sumAllocation } from "../domain/stats.js";
import { getEncounter, putEncounter, removeEncounter } from "../lib/encounterStore.js";
import { calculateTameChance } from "../domain/taming.js";
import { simulateBattle } from "../domain/battle.js";
import { applyExp } from "../domain/leveling.js";
import { resolveOffspringSpecies, statVariation } from "../domain/breeding.js";
import { runTournamentIfReady } from "../domain/tournament.js";
import { Server } from "socket.io";
import { broadcastMatchResult, broadcastTournament } from "../realtime/socket.js";

export const createRouter = (io: Server) => {
  const router = Router();
  const strictLimiter = rateLimit({ windowMs: 60_000, limit: 20 });

  router.post("/auth/register", async (req, res) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await prisma.user.create({ data: { email: parsed.data.email, passwordHash } });
    await prisma.inventory.create({ data: { userId: user.id, meat: STARTER_MEAT } });
    res.json({ token: signToken(user.id) });
  });

  router.post("/auth/login", async (req, res) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return res.status(401).json({ error: "invalid credentials" });
    }
    res.json({ token: signToken(user.id) });
  });

  router.use(authMiddleware);

  router.get("/me", async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { inventory: true, monsters: { include: { species: true } } }
    });
    const badges = await prisma.badge.findMany({ where: { userId: req.userId } });
    res.json({ user, badges });
  });

  router.get("/content/starters", async (_req, res) => {
    const species = await prisma.monsterSpecies.findMany({ where: { rarity: "common" }, take: 3 });
    res.json(species);
  });

  router.post("/starter/select", async (req: AuthedRequest, res) => {
    const parsed = StarterChoiceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());
    const existing = await prisma.monster.count({ where: { ownerId: req.userId! } });
    if (existing > 0) return res.status(400).json({ error: "starter already selected" });
    const species = await prisma.monsterSpecies.findUnique({ where: { id: parsed.data.speciesId } });
    if (!species) return res.status(404).json({ error: "species not found" });
    const base = species.baseStatsJson as any;
    const created = await prisma.monster.create({
      data: {
        ownerId: req.userId!,
        speciesId: species.id,
        currentHp: base.hp,
        allocatedStatsJson: { atk: 0, def: 0, spd: 0, hp: 0 }
      }
    });
    res.json(created);
  });

  router.get("/areas", async (_req, res) => {
    const areas = await prisma.area.findMany();
    res.json(areas);
  });

  router.post("/explore/start", strictLimiter, async (req: AuthedRequest, res) => {
    const { areaId } = req.body as { areaId: string };
    const area = await prisma.area.findUnique({ where: { id: areaId } });
    if (!area) return res.status(404).json({ error: "area not found" });
    const encounterRow = weightedPick(area.encounterTableJson as any[]);
    const species = await prisma.monsterSpecies.findUnique({ where: { id: encounterRow.speciesId } });
    if (!species) return res.status(500).json({ error: "species missing" });
    const level = rollLevel(area.levelRangeMin, area.levelRangeMax);
    const base = species.baseStatsJson as any;
    const growth = species.growthJson as any;
    const maxHp = base.hp + growth.hp * (level - 1);
    const id = createEncounterId();
    putEncounter({ id, userId: req.userId!, areaId, speciesId: species.id, level, currentHp: maxHp, maxHp });
    res.json({ encounterId: id, species, level, currentHp: maxHp, maxHp });
  });

  router.post("/battle/start", strictLimiter, async (req: AuthedRequest, res) => {
    const parsed = BattleStartSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());
    const mine = await prisma.monster.findFirst({
      where: { instanceId: parsed.data.yourMonsterId, ownerId: req.userId },
      include: { species: true }
    });
    if (!mine) return res.status(404).json({ error: "monster not found" });

    const myStats = buildMaxStats(mine.species.baseStatsJson as any, mine.species.growthJson as any, mine.level, mine.allocatedStatsJson as any);

    if (parsed.data.encounterId) {
      const encounter = getEncounter(parsed.data.encounterId);
      if (!encounter || encounter.userId !== req.userId) return res.status(404).json({ error: "encounter missing" });
      const species = await prisma.monsterSpecies.findUnique({ where: { id: encounter.speciesId } });
      if (!species) return res.status(404).json({ error: "species missing" });
      const enemyStats = buildMaxStats(species.baseStatsJson as any, species.growthJson as any, encounter.level, { atk: 0, def: 0, spd: 0, hp: 0 });
      const result = simulateBattle(
        { name: mine.species.name, level: mine.level, hp: mine.currentHp, stats: myStats },
        { name: species.name, level: encounter.level, hp: encounter.currentHp, stats: enemyStats }
      );
      encounter.currentHp = result.rightHp;
      await prisma.monster.update({ where: { instanceId: mine.instanceId }, data: { currentHp: result.leftHp } });

      if (result.winner === "left") {
        const after = applyExp(mine.level, mine.exp, result.expEarned);
        await prisma.monster.update({
          where: { instanceId: mine.instanceId },
          data: {
            exp: after.exp,
            level: after.level,
            unspentStatPoints: { increment: after.statPointsAwarded }
          }
        });
      }
      return res.json(result);
    }

    if (parsed.data.opponentMonsterId) {
      const opponent = await prisma.monster.findUnique({ where: { instanceId: parsed.data.opponentMonsterId }, include: { species: true } });
      if (!opponent) return res.status(404).json({ error: "opponent not found" });
      const oppStats = buildMaxStats(opponent.species.baseStatsJson as any, opponent.species.growthJson as any, opponent.level, opponent.allocatedStatsJson as any);
      const result = simulateBattle(
        { name: mine.species.name, level: mine.level, hp: mine.currentHp, stats: myStats },
        { name: opponent.species.name, level: opponent.level, hp: opponent.currentHp, stats: oppStats }
      );
      res.json(result);
      return;
    }

    res.status(400).json({ error: "encounterId or opponentMonsterId is required" });
  });

  router.post("/encounter/tame", strictLimiter, async (req: AuthedRequest, res) => {
    const parsed = TameAttemptSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());
    const encounter = getEncounter(parsed.data.encounterId);
    if (!encounter || encounter.userId !== req.userId) return res.status(404).json({ error: "encounter not found" });

    if (encounter.fledUntil && Date.now() < encounter.fledUntil) {
      return res.status(429).json({ error: "encounter recovering after failed tame" });
    }

    const inventory = await prisma.inventory.findUnique({ where: { userId: req.userId! } });
    if (!inventory || inventory.meat < parsed.data.meatUsed) {
      return res.status(400).json({ error: "not enough meat" });
    }

    const species = await prisma.monsterSpecies.findUnique({ where: { id: encounter.speciesId } });
    if (!species) return res.status(404).json({ error: "species missing" });

    const chance = calculateTameChance({
      monsterBaseTameDifficulty: species.tameDifficulty,
      meatUsed: parsed.data.meatUsed,
      hpPct: encounter.currentHp / encounter.maxHp
    });

    await prisma.inventory.update({ where: { userId: req.userId! }, data: { meat: { decrement: parsed.data.meatUsed } } });
    const roll = Math.random();
    if (roll <= chance) {
      const created = await prisma.monster.create({
        data: {
          ownerId: req.userId!,
          speciesId: species.id,
          level: encounter.level,
          currentHp: encounter.currentHp,
          allocatedStatsJson: { atk: 0, def: 0, spd: 0, hp: 0 }
        }
      });
      removeEncounter(encounter.id);
      return res.json({ success: true, chance, created });
    }

    encounter.fledUntil = Date.now() + 15_000;
    res.json({ success: false, chance, cooldownMs: 15_000 });
  });

  router.post("/monsters/allocate-stats", async (req: AuthedRequest, res) => {
    const parsed = AllocateStatsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());

    const mon = await prisma.monster.findFirst({ where: { instanceId: parsed.data.monsterId, ownerId: req.userId } });
    if (!mon) return res.status(404).json({ error: "monster not found" });

    const used = sumAllocation(parsed.data.allocations as any);
    if (used > mon.unspentStatPoints) return res.status(400).json({ error: "cannot allocate more than unspent points" });

    const current = mon.allocatedStatsJson as any;
    await prisma.monster.update({
      where: { instanceId: mon.instanceId },
      data: {
        allocatedStatsJson: {
          atk: current.atk + parsed.data.allocations.atk,
          def: current.def + parsed.data.allocations.def,
          spd: current.spd + parsed.data.allocations.spd,
          hp: current.hp + parsed.data.allocations.hp
        },
        unspentStatPoints: { decrement: used }
      }
    });

    res.json({ ok: true });
  });

  router.post("/breed/start", strictLimiter, async (req: AuthedRequest, res) => {
    const parsed = BreedStartSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());
    const parents = await prisma.monster.findMany({
      where: { ownerId: req.userId, instanceId: { in: [parsed.data.parentAId, parsed.data.parentBId] } },
      include: { species: true }
    });
    if (parents.length !== 2) return res.status(400).json({ error: "must own both parents" });
    if (parents.some((p) => p.level < 5)) return res.status(400).json({ error: "parents must be at least level 5" });

    const speciesId = resolveOffspringSpecies(parents[0].speciesId, parents[1].speciesId);
    const species = await prisma.monsterSpecies.findUnique({ where: { id: speciesId } });
    if (!species) return res.status(404).json({ error: "offspring species not found" });

    const base = species.baseStatsJson as any;
    const variantHp = Math.max(20, base.hp + statVariation());
    const created = await prisma.monster.create({
      data: {
        ownerId: req.userId!,
        speciesId,
        level: 1,
        currentHp: variantHp,
        allocatedStatsJson: { atk: 0, def: 0, spd: 0, hp: 0 },
        parentAId: parsed.data.parentAId,
        parentBId: parsed.data.parentBId
      }
    });

    res.json({ offspring: created });
  });

  router.get("/tournaments/current", async (_req, res) => {
    const tournament = await prisma.tournament.findFirst({ where: { status: { in: ["open", "running"] } }, orderBy: { createdAt: "desc" } });
    res.json(tournament);
  });

  router.post("/tournaments/join", strictLimiter, async (req: AuthedRequest, res) => {
    const parsed = JoinTournamentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());

    const monster = await prisma.monster.findFirst({ where: { instanceId: parsed.data.monsterId, ownerId: req.userId } });
    if (!monster) return res.status(404).json({ error: "monster missing" });

    let tournament = await prisma.tournament.findFirst({ where: { status: "open" }, orderBy: { createdAt: "desc" } });
    if (!tournament) {
      tournament = await prisma.tournament.create({ data: { status: "open" } });
    }

    await prisma.tournamentEntry.create({
      data: { tournamentId: tournament.id, userId: req.userId!, monsterInstanceId: monster.instanceId }
    });

    broadcastTournament(io, { tournamentId: tournament.id, status: "open" });

    const winner = await runTournamentIfReady(prisma, tournament.id);
    if (winner) {
      broadcastMatchResult(io, { tournamentId: tournament.id, winnerUserId: winner.userId });
      broadcastTournament(io, { tournamentId: tournament.id, status: "finished" });
    }

    res.json({ joined: true, tournamentId: tournament.id });
  });

  router.post("/rest", async (req: AuthedRequest, res) => {
    const mine = await prisma.monster.findMany({ where: { ownerId: req.userId }, include: { species: true } });
    await Promise.all(
      mine.map((m) =>
        prisma.monster.update({
          where: { instanceId: m.instanceId },
          data: { currentHp: (m.species.baseStatsJson as any).hp + ((m.species.growthJson as any).hp * (m.level - 1)) }
        })
      )
    );
    res.json({ ok: true });
  });

  return router;
};
