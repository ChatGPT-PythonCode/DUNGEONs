class RNG {
  constructor(seed = 1) {
    this.seed = seed >>> 0;
  }
  next() {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  int(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  pick(arr) {
    return arr[this.int(0, arr.length - 1)];
  }
}

const TILE = {
  WALL: 0,
  FLOOR: 1,
  WARP_A: 2,
  WARP_B: 3
};

const MONSTER_TEMPLATES = {
  Brute: { hp: 26, attack: 7, xp: 18, color: "#ff6b6b" },
  Rogue: { hp: 18, attack: 6, xp: 22, color: "#f8c471" },
  Stalker: { hp: 22, attack: 8, xp: 26, color: "#bb8fce" }
};

class WorldGenerator {
  constructor(seed = 2026, size = 32) {
    this.seed = seed;
    this.size = size;
    this.cache = new Map();
  }

  getDungeon(dungeonId) {
    if (!this.cache.has(dungeonId)) {
      this.cache.set(dungeonId, this.buildDungeon(dungeonId));
    }
    return this.cache.get(dungeonId);
  }

  buildDungeon(dungeonId) {
    const rng = new RNG((this.seed + dungeonId * 7919) >>> 0);
    const map = Array.from({ length: this.size }, () => Array(this.size).fill(TILE.WALL));

    const start = { x: rng.int(2, this.size - 3), y: rng.int(2, this.size - 3) };
    this.carveConnectedCavern(map, start, rng);
    this.removeDisconnectedPockets(map, start);

    const walkables = this.collectCells(map, v => v === TILE.FLOOR);
    const spawn = walkables[rng.int(0, walkables.length - 1)] || start;

    const warpAId = dungeonId + rng.int(1, 9);
    let warpBId = rng.next() < 0.35 ? Math.max(0, dungeonId - rng.int(1, 6)) : dungeonId + rng.int(10, 20);
    if (warpAId === warpBId) warpBId += 1;

    const warpA = this.farthestWalkable(spawn, walkables);
    const warpB = this.farthestWalkable(warpA, walkables.filter(c => c.x !== warpA.x || c.y !== warpA.y));
    map[warpA.y][warpA.x] = TILE.WARP_A;
    map[warpB.y][warpB.x] = TILE.WARP_B;

    const monsters = [];
    const monsterCount = rng.int(14, 24);
    const types = Object.keys(MONSTER_TEMPLATES);
    for (let i = 0; i < monsterCount; i++) {
      const kind = rng.pick(types);
      const base = MONSTER_TEMPLATES[kind];
      const pos = walkables[rng.int(0, walkables.length - 1)];
      if (!pos || map[pos.y][pos.x] !== TILE.FLOOR) continue;
      if (this.manhattan(pos, spawn) < 7) continue;

      if (!pos || (pos.x === spawn.x && pos.y === spawn.y)) continue;
      if (map[pos.y][pos.x] !== TILE.FLOOR) continue;
      monsters.push({
        id: `${dungeonId}-${i}`,
        kind,
        hp: base.hp,
        maxHp: base.hp,
        attack: base.attack,
        xp: base.xp,
        aggroRange: base.aggro,
        loseRange: base.lose,
        mode: "idle",
        lastSeen: null,
        x: pos.x,
        y: pos.y
      });
    }

    return {
      id: dungeonId,
      size: this.size,
      map,
      spawn,
      monsters,
      warps: [
        { id: warpAId, x: warpA.x, y: warpA.y, tile: TILE.WARP_A },
        { id: warpBId, x: warpB.x, y: warpB.y, tile: TILE.WARP_B }
      ]
    };
  }

  carveRooms(map, rng) {
    const rooms = [];
    const roomAttempts = 110;

    for (let i = 0; i < roomAttempts; i++) {
      const w = rng.int(4, 8);
      const h = rng.int(4, 8);
      const x = rng.int(1, this.size - w - 2);
      const y = rng.int(1, this.size - h - 2);
      const candidate = { x, y, w, h, center: { x: x + Math.floor(w / 2), y: y + Math.floor(h / 2) } };

      const overlaps = rooms.some(r =>
        x <= r.x + r.w + 1 &&
        x + w + 1 >= r.x &&
        y <= r.y + r.h + 1 &&
        y + h + 1 >= r.y
      );
      if (overlaps) continue;

      for (let yy = y; yy < y + h; yy++) {
        for (let xx = x; xx < x + w; xx++) map[yy][xx] = TILE.FLOOR;
      }
      rooms.push(candidate);
      if (rooms.length >= 20) break;
    }

    if (!rooms.length) {
      for (let y = 2; y < this.size - 2; y++) {
        for (let x = 2; x < this.size - 2; x++) map[y][x] = TILE.FLOOR;
      }
      rooms.push({ x: 2, y: 2, w: this.size - 4, h: this.size - 4, center: { x: Math.floor(this.size / 2), y: Math.floor(this.size / 2) } });
    }

    return rooms;
  }

  connectRooms(map, rooms, rng) {
    const sorted = [...rooms].sort((a, b) => a.center.x - b.center.x + (rng.next() < 0.5 ? -1 : 1));
    for (let i = 1; i < sorted.length; i++) {
      this.carveCorridor(map, sorted[i - 1].center, sorted[i].center, rng);
    }

    const extraLinks = Math.max(3, Math.floor(sorted.length / 3));
    for (let i = 0; i < extraLinks; i++) {
      const a = rng.pick(sorted);
      const b = rng.pick(sorted);
      if (a !== b) this.carveCorridor(map, a.center, b.center, rng);
    }
  }

  carveCorridor(map, from, to, rng) {
    let x = from.x;
    let y = from.y;
    const horizontalFirst = rng.next() < 0.5;

    const carveHorizontal = () => {
      while (x !== to.x) {
        x += to.x > x ? 1 : -1;
        map[y][x] = TILE.FLOOR;
      }
    };

    const carveVertical = () => {
      while (y !== to.y) {
        y += to.y > y ? 1 : -1;
        map[y][x] = TILE.FLOOR;
      }
    };

    map[y][x] = TILE.FLOOR;
    if (horizontalFirst) {
      carveHorizontal();
      carveVertical();
    } else {
      carveVertical();
      carveHorizontal();
    }
  }

  carveBranchPassages(map, rng) {
    const starts = this.collectCells(map, v => v === TILE.FLOOR);
    const dirs = [
  carveConnectedCavern(map, start, rng) {
    let x = start.x;
    let y = start.y;
    map[y][x] = TILE.FLOOR;

    const totalCells = (this.size - 2) * (this.size - 2);
    const targetFloor = Math.floor(totalCells * 0.52);
    let carved = 1;

    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ];

    for (let i = 0; i < 48; i++) {
      let current = rng.pick(starts);
      if (!current) continue;
      const length = rng.int(4, 14);
      for (let step = 0; step < length; step++) {
        const d = rng.pick(dirs);
        const nx = Math.max(1, Math.min(this.size - 2, current.x + d.x));
        const ny = Math.max(1, Math.min(this.size - 2, current.y + d.y));
        map[ny][nx] = TILE.FLOOR;
        current = { x: nx, y: ny };
    while (carved < targetFloor) {
      const dir = rng.pick(directions);
      const nx = Math.max(1, Math.min(this.size - 2, x + dir.x));
      const ny = Math.max(1, Math.min(this.size - 2, y + dir.y));

      x = nx;
      y = ny;
      if (map[y][x] === TILE.WALL) {
        map[y][x] = TILE.FLOOR;
        carved += 1;
      }

      if (rng.next() < 0.08) {
        const width = rng.int(2, 4);
        const height = rng.int(2, 4);
        for (let yy = Math.max(1, y - height); yy <= Math.min(this.size - 2, y + height); yy++) {
          for (let xx = Math.max(1, x - width); xx <= Math.min(this.size - 2, x + width); xx++) {
            if (map[yy][xx] === TILE.WALL) {
              map[yy][xx] = TILE.FLOOR;
              carved += 1;
            }
          }
        }
      }
    }
  }

  removeDisconnectedPockets(map, spawn) {
    const reachable = new Set();
    const queue = [spawn];
    reachable.add(`${spawn.x},${spawn.y}`);
    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ];

    while (queue.length) {
      const cell = queue.shift();
      for (const d of dirs) {
        const nx = cell.x + d.x;
        const ny = cell.y + d.y;
        if (ny < 0 || ny >= map.length || nx < 0 || nx >= map[0].length) continue;
        if (map[ny][nx] === TILE.WALL) continue;
        const key = `${nx},${ny}`;
        if (reachable.has(key)) continue;
        reachable.add(key);
        queue.push({ x: nx, y: ny });
      }
    }

    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[0].length; x++) {
        if (map[y][x] !== TILE.WALL && !reachable.has(`${x},${y}`)) {
          map[y][x] = TILE.WALL;
        }
      }
    }
  }

  collectCells(map, predicate) {
    const cells = [];
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[0].length; x++) {
        if (predicate(map[y][x])) cells.push({ x, y });
      }
    }
    return cells;
  }

  farthestWalkable(from, cells) {
    let best = cells[0] || { x: 1, y: 1 };
    let bestDist = -1;
    for (const c of cells) {
      const dist = this.manhattan(c, from);
      const dist = Math.abs(c.x - from.x) + Math.abs(c.y - from.y);
      if (dist > bestDist) {
        bestDist = dist;
        best = c;
      }
    }
    return best;
  }

  manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }
}

class Game {
  constructor(seed = 2026) {
    this.rng = new RNG(seed);
    this.world = new WorldGenerator(seed, 36);
    this.player = {
      hp: 130,
      maxHp: 130,
      level: 1,
      xp: 0,
      xpToNext: 45,
      attack: 11,
      skills: []
    };
    this.world = new WorldGenerator(seed, 32);
    this.player = {
      hp: 120,
      maxHp: 120,
      level: 1,
      xp: 0,
      xpToNext: 40,
      attack: 10,
      skills: []
    };
    this.dungeonId = 0;
    this.log = ["Entered dungeon 0."];
    this.loadDungeon(0);
  }

  loadDungeon(id) {
    this.dungeonId = id;
    this.dungeon = this.world.getDungeon(id);
    this.playerPos = { x: this.dungeon.spawn.x, y: this.dungeon.spawn.y };
    this.log.unshift(`Dungeon ${id}: discovered two warp gates.`);
  }

  tileAt(x, y) {
    return this.dungeon.map[y]?.[x] ?? TILE.WALL;
  }

  isWalkable(x, y) {
    return this.tileAt(x, y) !== TILE.WALL;
  }

  manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  movePlayer(dx, dy) {
    if (this.player.hp <= 0) return;
    const nx = this.playerPos.x + dx;
    const ny = this.playerPos.y + dy;
    if (!this.isWalkable(nx, ny)) {
      this.log.unshift("You bump into a wall.");
      return;
    }

    const monster = this.monsterAt(nx, ny);
    if (monster) {
      this.attackMonster(monster);
      this.monsterTurn();
      return;
    }

    this.playerPos = { x: nx, y: ny };
    this.handleWarpIfOnTile();
    this.monsterTurn();
  }

  escapeAction() {
    if (this.player.hp <= 0) return;
    const neighbors = this.neighbors(this.playerPos.x, this.playerPos.y)
      .filter(c => this.isWalkable(c.x, c.y) && !this.monsterAt(c.x, c.y));

    if (!neighbors.length) {
      this.log.unshift("No route to escape.");
      this.monsterTurn();
      return;
    }

    let best = neighbors[0];
    let bestScore = -Infinity;
    for (const n of neighbors) {
      let nearest = Infinity;
      let closeCount = 0;
      for (const m of this.dungeon.monsters) {
        if (m.hp <= 0) continue;
        const d = this.manhattan(n, m);
        nearest = Math.min(nearest, d);
        if (d <= 3) closeCount += 1;
      }
      const score = nearest * 3 - closeCount;
      if (score > bestScore) {
        bestScore = score;
        best = n;
      }
    }

    this.playerPos = best;
    this.log.unshift("You evade to create distance.");
    this.handleWarpIfOnTile();
    this.monsterTurn();
  }

  attackAction() {
    if (this.player.hp <= 0) return;
    const candidates = this.dungeon.monsters
      .filter(m => m.hp > 0)
      .map(m => ({ monster: m, dist: this.manhattan(m, this.playerPos) }))
  attackAction() {
    if (this.player.hp <= 0) return;

    const candidates = this.dungeon.monsters
      .filter(m => m.hp > 0)
      .map(m => ({
        monster: m,
        dist: Math.abs(m.x - this.playerPos.x) + Math.abs(m.y - this.playerPos.y)
      }))
      .filter(item => item.dist === 1)
      .sort((a, b) => a.monster.hp - b.monster.hp);

    if (!candidates.length) {
      this.log.unshift("No monster in range for space attack.");
      this.monsterTurn();
      return;
    }

    this.attackMonster(candidates[0].monster);
    this.monsterTurn();
  }

  handleWarpIfOnTile() {
    const tile = this.tileAt(this.playerPos.x, this.playerPos.y);
    if (tile !== TILE.WARP_A && tile !== TILE.WARP_B) return;
    const warp = this.dungeon.warps.find(w => w.x === this.playerPos.x && w.y === this.playerPos.y);
    if (warp) {
      this.log.unshift(`You used warp gate to dungeon ${warp.id}.`);
      this.loadDungeon(warp.id);
    }
  }

  monsterAt(x, y) {
    return this.dungeon.monsters.find(m => m.x === x && m.y === y && m.hp > 0);
  }

  attackMonster(monster) {
    let damage = this.player.attack;
    if (this.player.skills.includes("Power Strike") && this.rng.next() < 0.25) {
      damage += 8;
      this.log.unshift("Power Strike triggered!");
    }
    monster.hp -= damage;
    monster.mode = "chase";
    monster.lastSeen = { ...this.playerPos };
    this.log.unshift(`You hit ${monster.kind} for ${damage}.`);
    if (monster.hp <= 0) {
      this.log.unshift(`${monster.kind} defeated (+${monster.xp} XP).`);
      this.gainXp(monster.xp);
      this.dungeon.monsters = this.dungeon.monsters.filter(m => m.hp > 0);
    }
  }

  gainXp(amount) {
    this.player.xp += amount;
    while (this.player.xp >= this.player.xpToNext) {
      this.player.xp -= this.player.xpToNext;
      this.player.level += 1;
      this.player.xpToNext = Math.floor(this.player.xpToNext * 1.4);
      this.player.attack += 2;
      this.player.maxHp += 10;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 16);
      const skill = this.unlockSkill();
      this.log.unshift(`Level ${this.player.level}! Skill unlocked: ${skill}.`);
    }
  }

  unlockSkill() {
    const pool = ["Power Strike", "Blink", "Arc Burst", "Battle Trance", "Regeneration"];
    const notOwned = pool.filter(s => !this.player.skills.includes(s));
    const skill = this.rng.pick(notOwned.length ? notOwned : pool);
    this.player.skills.push(skill);
    return skill;
  }

  monsterTurn() {
    const occupied = new Set(this.dungeon.monsters.filter(m => m.hp > 0).map(m => `${m.x},${m.y}`));
    const maxAdjacentAttackers = 2;
    let adjacentAttackers = 0;

    for (const m of this.dungeon.monsters) {
      if (m.hp <= 0) continue;

      const dist = this.manhattan(m, this.playerPos);
      if (dist <= m.aggroRange || m.mode === "chase") {
        m.mode = "chase";
        m.lastSeen = { ...this.playerPos };
      } else if (dist > m.loseRange && m.mode === "chase") {
        m.mode = "search";
      }

      if (dist === 1 && m.mode !== "idle" && adjacentAttackers < maxAdjacentAttackers) {
        adjacentAttackers += 1;
    const occupied = new Set(this.dungeon.monsters.map(m => `${m.x},${m.y}`));

    for (const m of this.dungeon.monsters) {
      if (m.hp <= 0) continue;
      const dist = Math.abs(m.x - this.playerPos.x) + Math.abs(m.y - this.playerPos.y);

      if (dist === 1) {
        let dmg = m.attack;
        if (this.player.skills.includes("Battle Trance") && this.rng.next() < 0.15) dmg = Math.max(1, dmg - 4);
        this.player.hp -= dmg;
        this.log.unshift(`${m.kind} attacks for ${dmg}.`);
        continue;
      }

      const next = this.chooseMonsterMove(m, occupied);
      if (!next) continue;

      occupied.delete(`${m.x},${m.y}`);
      m.x = next.x;
      m.y = next.y;
      occupied.add(`${m.x},${m.y}`);
      const target = this.monsterTarget(m, dist);
      const next = this.stepToward(m.x, m.y, target.x, target.y);
      const key = `${next.x},${next.y}`;
      if (this.isWalkable(next.x, next.y) && !occupied.has(key) && !(next.x === this.playerPos.x && next.y === this.playerPos.y)) {
        occupied.delete(`${m.x},${m.y}`);
        m.x = next.x;
        m.y = next.y;
        occupied.add(key);
      }
    }

    if (this.player.skills.includes("Regeneration") && this.rng.next() < 0.25 && this.player.hp > 0) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 3);
      this.log.unshift("Regeneration healed 3 HP.");
    }

    if (this.player.hp <= 0) {
      this.log.unshift("You died. Reload page to start over.");
    }
  }

  chooseMonsterMove(monster, occupied) {
    const options = this.neighbors(monster.x, monster.y)
      .filter(c => this.isWalkable(c.x, c.y))
      .filter(c => !occupied.has(`${c.x},${c.y}`))
      .filter(c => !(c.x === this.playerPos.x && c.y === this.playerPos.y));

    if (!options.length) return null;

    const target = this.monsterTarget(monster);
    let best = null;
    let bestScore = Infinity;

    for (const option of options) {
      const distToTarget = this.manhattan(option, target);
      const distToPlayer = this.manhattan(option, this.playerPos);
      let crowdPenalty = 0;

      for (const other of this.dungeon.monsters) {
        if (other.hp <= 0 || other.id === monster.id) continue;
        const d = this.manhattan(option, other);
        if (d <= 1) crowdPenalty += 2.5;
        if (d === 2) crowdPenalty += 0.6;
      }

      const avoidStackBehind = monster.kind === "Brute" ? 0 : (option.x === this.playerPos.x || option.y === this.playerPos.y ? 0.7 : 0);
      const ringPenalty = distToPlayer === 1 ? 0.4 : 0;
      const score = distToTarget + crowdPenalty + avoidStackBehind + ringPenalty;

      if (score < bestScore) {
        bestScore = score;
        best = option;
      }
    }

    return best;
  }

  monsterTarget(monster) {
    if (monster.mode === "idle") return { x: monster.x, y: monster.y };

    if (monster.kind === "Brute") {
      return { x: this.playerPos.x, y: this.playerPos.y };
    }

    if (monster.kind === "Rogue") {
      return {
        x: this.playerPos.x + (monster.x <= this.playerPos.x ? 1 : -1),
        y: this.playerPos.y + (this.rng.next() < 0.5 ? 1 : -1)
      };
    }

    if (this.manhattan(monster, this.playerPos) <= 3) {
      return { x: this.playerPos.x, y: this.playerPos.y };
    }

    if (monster.lastSeen) {
      return { x: monster.lastSeen.x, y: monster.lastSeen.y };
    }

    return { x: this.playerPos.x, y: this.playerPos.y };
  }

  neighbors(x, y) {
    return [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 }
    ];
  monsterTarget(m, dist) {
    if (m.kind === "Brute") {
      return { x: this.playerPos.x, y: this.playerPos.y };
    }
    if (m.kind === "Rogue") {
      return {
        x: this.playerPos.x + (m.x <= this.playerPos.x ? 1 : -1),
        y: this.playerPos.y
      };
    }
    if (dist <= 3) return { x: this.playerPos.x, y: this.playerPos.y };
    return {
      x: this.playerPos.x,
      y: this.playerPos.y + (m.y <= this.playerPos.y ? 1 : -1)
    };
  }

  stepToward(x, y, tx, ty) {
    const dx = tx > x ? 1 : tx < x ? -1 : 0;
    const dy = ty > y ? 1 : ty < y ? -1 : 0;
    if (Math.abs(tx - x) >= Math.abs(ty - y)) {
      return { x: x + dx, y };
    }
    return { x, y: y + dy };
  }
}

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const statsEl = document.getElementById("player-stats");
const dungeonEl = document.getElementById("dungeon-card");
const logEl = document.getElementById("log");
const game = new Game(2026);
window.__game = game;

function draw() {
  const { map, size, monsters } = game.dungeon;
  const tileSize = canvas.width / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = map[y][x];
      if (tile === TILE.WALL) ctx.fillStyle = "#0d1117";
      if (tile === TILE.FLOOR) ctx.fillStyle = "#1a2536";
      if (tile === TILE.WARP_A) ctx.fillStyle = "#2e86de";
      if (tile === TILE.WARP_B) ctx.fillStyle = "#8e44ad";
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      ctx.strokeStyle = "#090c12";
      if (tile === TILE.WALL) ctx.fillStyle = "#11131a";
      if (tile === TILE.FLOOR) ctx.fillStyle = "#1d2738";
      if (tile === TILE.WARP_A) ctx.fillStyle = "#2e86de";
      if (tile === TILE.WARP_B) ctx.fillStyle = "#8e44ad";
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      ctx.strokeStyle = "#0b0f18";
      ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }

  for (const m of monsters) {
    if (m.hp <= 0) continue;
    ctx.fillStyle = MONSTER_TEMPLATES[m.kind].color;
    ctx.beginPath();
    ctx.arc((m.x + 0.5) * tileSize, (m.y + 0.5) * tileSize, tileSize * 0.26, 0, Math.PI * 2);
    ctx.arc((m.x + 0.5) * tileSize, (m.y + 0.5) * tileSize, tileSize * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#58d68d";
  ctx.beginPath();
  ctx.arc((game.playerPos.x + 0.5) * tileSize, (game.playerPos.y + 0.5) * tileSize, tileSize * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function renderInfo() {
  statsEl.innerHTML = `
    <h2>Player</h2>
    <p><strong>HP:</strong> <span class="${game.player.hp > 20 ? "good" : "danger"}">${game.player.hp}/${game.player.maxHp}</span></p>
    <p><strong>Level:</strong> ${game.player.level} | <strong>XP:</strong> ${game.player.xp}/${game.player.xpToNext}</p>
    <p><strong>ATK:</strong> ${game.player.attack}</p>
    <div class="pills">${game.player.skills.map(s => `<span class="pill">${s}</span>`).join("") || '<span class="subtle">No skills yet</span>'}</div>
  `;

  const [warpA, warpB] = game.dungeon.warps;
  dungeonEl.innerHTML = `
    <h2>Dungeon ${game.dungeon.id}</h2>
    <p><strong>Size:</strong> ${game.dungeon.size} x ${game.dungeon.size}</p>
    <p><strong>Monsters:</strong> ${game.dungeon.monsters.length}</p>
    <p><strong>Warp A:</strong> ${warpA.id} (${warpA.x},${warpA.y})</p>
    <p><strong>Warp B:</strong> ${warpB.id} (${warpB.x},${warpB.y})</p>
    <p class="subtle">Arrows move. Space attacks. Shift/ESCAPE evades.</p>
    <p class="subtle">Arrow keys move. Space attacks adjacent enemy.</p>
  `;

  logEl.innerHTML = game.log.slice(0, 24).map(line => `<li>${line}</li>`).join("");
}

function renderAll() {
  draw();
  renderInfo();
}

function moveByInput(dx, dy) {
  game.movePlayer(dx, dy);
  renderAll();
}

function attackByInput() {
  game.attackAction();
  renderAll();
}

function escapeByInput() {
  game.escapeAction();
  renderAll();
}

function handleMapTouch(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const tileSize = rect.width / game.dungeon.size;
  const tx = Math.floor((clientX - rect.left) / tileSize);
  const ty = Math.floor((clientY - rect.top) / tileSize);
  const dx = tx - game.playerPos.x;
  const dy = ty - game.playerPos.y;

  if (Math.abs(dx) + Math.abs(dy) !== 1) return;
  if (game.monsterAt(tx, ty)) {
    attackByInput();
    return;
  }
  moveByInput(dx, dy);
}

document.getElementById("up-btn").addEventListener("click", () => moveByInput(0, -1));
document.getElementById("down-btn").addEventListener("click", () => moveByInput(0, 1));
document.getElementById("left-btn").addEventListener("click", () => moveByInput(-1, 0));
document.getElementById("right-btn").addEventListener("click", () => moveByInput(1, 0));
document.getElementById("attack-btn").addEventListener("click", attackByInput);
document.getElementById("escape-btn").addEventListener("click", escapeByInput);

document.addEventListener("keydown", event => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "space", "shift", "w", "a", "s", "d"].includes(key)) {

document.addEventListener("keydown", event => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "space", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
  }
  if (key === "arrowup" || key === "w") moveByInput(0, -1);
  if (key === "arrowdown" || key === "s") moveByInput(0, 1);
  if (key === "arrowleft" || key === "a") moveByInput(-1, 0);
  if (key === "arrowright" || key === "d") moveByInput(1, 0);
  if (key === " " || key === "space") attackByInput();
  if (key === "shift") escapeByInput();
});

canvas.addEventListener("pointerdown", event => {
  handleMapTouch(event.clientX, event.clientY);
});

renderAll();
