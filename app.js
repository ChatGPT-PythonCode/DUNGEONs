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
  constructor(seed = 2026, size = 18) {
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

    const roomCount = rng.int(8, 14);
    for (let i = 0; i < roomCount; i++) {
      const rw = rng.int(3, 6);
      const rh = rng.int(3, 6);
      const rx = rng.int(1, this.size - rw - 2);
      const ry = rng.int(1, this.size - rh - 2);
      for (let y = ry; y < ry + rh; y++) {
        for (let x = rx; x < rx + rw; x++) map[y][x] = TILE.FLOOR;
      }
    }

    for (let y = 1; y < this.size - 1; y++) {
      for (let x = 1; x < this.size - 1; x++) {
        if (map[y][x] === TILE.FLOOR && rng.next() < 0.35) {
          if (map[y][x + 1] === TILE.WALL) map[y][x + 1] = TILE.FLOOR;
          if (map[y + 1][x] === TILE.WALL) map[y + 1][x] = TILE.FLOOR;
        }
      }
    }

    const floorCells = this.collectCells(map, v => v === TILE.FLOOR);
    if (floorCells.length < 30) {
      for (let y = 1; y < this.size - 1; y++) {
        for (let x = 1; x < this.size - 1; x++) {
          if (rng.next() < 0.5) map[y][x] = TILE.FLOOR;
        }
      }
    }

    const walkables = this.collectCells(map, v => v === TILE.FLOOR);
    const spawn = walkables[rng.int(0, walkables.length - 1)] || { x: 1, y: 1 };

    const warpAId = dungeonId + rng.int(1, 9);
    let warpBId = rng.next() < 0.35 ? Math.max(0, dungeonId - rng.int(1, 6)) : dungeonId + rng.int(10, 20);
    if (warpAId === warpBId) warpBId += 1;

    const warpA = this.farthestWalkable(spawn, walkables);
    const warpB = this.farthestWalkable(warpA, walkables.filter(c => c.x !== warpA.x || c.y !== warpA.y));
    map[warpA.y][warpA.x] = TILE.WARP_A;
    map[warpB.y][warpB.x] = TILE.WARP_B;

    const monsters = [];
    const monsterCount = rng.int(5, 11);
    const types = Object.keys(MONSTER_TEMPLATES);
    for (let i = 0; i < monsterCount; i++) {
      const kind = rng.pick(types);
      const base = MONSTER_TEMPLATES[kind];
      const pos = walkables[rng.int(0, walkables.length - 1)];
      if (!pos || (pos.x === spawn.x && pos.y === spawn.y)) continue;
      monsters.push({
        id: `${dungeonId}-${i}`,
        kind,
        hp: base.hp,
        maxHp: base.hp,
        attack: base.attack,
        xp: base.xp,
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
      const dist = Math.abs(c.x - from.x) + Math.abs(c.y - from.y);
      if (dist > bestDist) {
        bestDist = dist;
        best = c;
      }
    }
    return best;
  }
}

class Game {
  constructor(seed = 2026) {
    this.rng = new RNG(seed);
    this.world = new WorldGenerator(seed, 18);
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
    const tile = this.tileAt(nx, ny);
    if (tile === TILE.WARP_A || tile === TILE.WARP_B) {
      const warp = this.dungeon.warps.find(w => w.x === nx && w.y === ny);
      if (warp) {
        this.log.unshift(`You used warp gate to dungeon ${warp.id}.`);
        this.loadDungeon(warp.id);
        return;
      }
    }

    this.monsterTurn();
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

function draw() {
  const { map, size, monsters } = game.dungeon;
  const tileSize = canvas.width / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = map[y][x];
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
    <p><strong>Monsters:</strong> ${game.dungeon.monsters.length}</p>
    <p><strong>Warp A:</strong> ${warpA.id} (${warpA.x},${warpA.y})</p>
    <p><strong>Warp B:</strong> ${warpB.id} (${warpB.x},${warpB.y})</p>
    <p class="subtle">Stand on a warp tile to travel.</p>
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

document.getElementById("up-btn").addEventListener("click", () => moveByInput(0, -1));
document.getElementById("down-btn").addEventListener("click", () => moveByInput(0, 1));
document.getElementById("left-btn").addEventListener("click", () => moveByInput(-1, 0));
document.getElementById("right-btn").addEventListener("click", () => moveByInput(1, 0));

document.addEventListener("keydown", event => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
  }
  if (key === "arrowup" || key === "w") moveByInput(0, -1);
  if (key === "arrowdown" || key === "s") moveByInput(0, 1);
  if (key === "arrowleft" || key === "a") moveByInput(-1, 0);
  if (key === "arrowright" || key === "d") moveByInput(1, 0);
});

renderAll();
