class RNG {
  constructor(seed = 1337) {
    this.seed = seed >>> 0;
  }
  next() {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  int(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  pick(items) {
    return items[this.int(0, items.length - 1)];
  }
}

class WorldGenerator {
  constructor(seed = 1337, size = 12) {
    this.seed = seed;
    this.size = size;
    this.cache = new Map();
    this.types = ["Brute", "Rogue", "Stalker"]; 
  }

  dungeon(id) {
    if (!this.cache.has(id)) {
      this.cache.set(id, this.build(id));
    }
    return this.cache.get(id);
  }

  build(id) {
    const rng = new RNG((this.seed + id * 7919) >>> 0);
    const warpA = id + rng.int(1, 9);
    let warpB = rng.next() < 0.35 ? Math.max(0, id - rng.int(1, 7)) : id + rng.int(10, 20);
    if (warpB === warpA) warpB += 1;

    const monsters = [];
    for (let i = 0; i < rng.int(3, 7); i++) {
      const kind = rng.pick(this.types);
      const templates = {
        Brute: { hp: 18, attack: 6, xp: 10 },
        Rogue: { hp: 12, attack: 5, xp: 12 },
        Stalker: { hp: 15, attack: 7, xp: 14 }
      };
      monsters.push({
        id: `${id}-${i}`,
        kind,
        hp: templates[kind].hp,
        attack: templates[kind].attack,
        xp: templates[kind].xp,
        x: rng.int(0, this.size - 1),
        y: rng.int(0, this.size - 1)
      });
    }

    return { id, size: this.size, warps: [warpA, warpB], monsters };
  }
}

class Game {
  constructor(seed = 2026) {
    this.world = new WorldGenerator(seed);
    this.player = {
      hp: 100,
      maxHp: 100,
      level: 1,
      xp: 0,
      xpToNext: 25,
      attack: 7,
      skills: []
    };
    this.playerPos = { x: 0, y: 0 };
    this.dungeonId = 0;
    this.log = ["Game started."];
  }

  get dungeon() {
    return this.world.dungeon(this.dungeonId);
  }

  moveToward(x, y, tx, ty, size) {
    const dx = tx > x ? 1 : tx < x ? -1 : 0;
    const dy = ty > y ? 1 : ty < y ? -1 : 0;
    const nx = Math.abs(tx - x) >= Math.abs(ty - y) ? x + dx : x;
    const ny = Math.abs(tx - x) >= Math.abs(ty - y) ? y : y + dy;
    return {
      x: Math.max(0, Math.min(size - 1, nx)),
      y: Math.max(0, Math.min(size - 1, ny))
    };
  }

  distance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  unlockSkill() {
    const pool = ["Power Strike", "Blink", "Arc Burst", "Battle Trance", "Regeneration"];
    const remaining = pool.filter(s => !this.player.skills.includes(s));
    const pick = (remaining.length ? remaining : pool)[Math.floor(Math.random() * (remaining.length || pool.length))];
    this.player.skills.push(pick);
    return pick;
  }

  gainXp(amount) {
    this.player.xp += amount;
    while (this.player.xp >= this.player.xpToNext) {
      this.player.xp -= this.player.xpToNext;
      this.player.level += 1;
      this.player.attack += 2;
      this.player.maxHp += 8;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 12);
      this.player.xpToNext = Math.floor(this.player.xpToNext * 1.35);
      const skill = this.unlockSkill();
      this.log.unshift(`Level up! Lv.${this.player.level} and unlocked ${skill}.`);
    }
  }

  step() {
    const d = this.dungeon;
    const survivors = [];

    for (const m of d.monsters) {
      const dist = this.distance(m, this.playerPos);
      let action = "chase";
      let target = { x: m.x, y: m.y };

      if (dist === 1) {
        action = "attack";
      } else if (m.kind === "Brute") {
        target = this.moveToward(m.x, m.y, this.playerPos.x, this.playerPos.y, d.size);
      } else if (m.kind === "Rogue") {
        action = "flank";
        target = this.moveToward(m.x, m.y, this.playerPos.x + (m.x <= this.playerPos.x ? 1 : -1), this.playerPos.y, d.size);
      } else {
        if (dist <= 3) {
          action = "chase";
          target = this.moveToward(m.x, m.y, this.playerPos.x, this.playerPos.y, d.size);
        } else {
          action = "flank";
          target = this.moveToward(m.x, m.y, this.playerPos.x, this.playerPos.y + (m.y <= this.playerPos.y ? 1 : -1), d.size);
        }
      }

      m.x = target.x;
      m.y = target.y;

      this.log.unshift(`${m.kind} uses ${action}.`);
      if (action === "attack") {
        this.player.hp -= m.attack;
        this.log.unshift(`Player takes ${m.attack} damage.`);
      }

      if (this.distance(m, this.playerPos) <= 1) {
        m.hp -= this.player.attack;
        this.log.unshift(`Player hits ${m.kind} for ${this.player.attack}.`);
      }

      if (m.hp > 0) {
        survivors.push(m);
      } else {
        this.log.unshift(`Defeated ${m.kind} (+${m.xp} XP).`);
        this.gainXp(m.xp);
      }
    }

    d.monsters = survivors;
    if (this.player.hp <= 0) {
      this.log.unshift("You were defeated. Refresh to restart.");
    }
  }

  warp(index) {
    this.dungeonId = this.dungeon.warps[index];
    this.playerPos = { x: 0, y: 0 };
    this.log.unshift(`Warped to dungeon ${this.dungeonId}.`);
  }
}

const game = new Game(2026);
const statsEl = document.getElementById("player-stats");
const dungeonEl = document.getElementById("dungeon-card");
const logEl = document.getElementById("log");
const stepBtn = document.getElementById("step-btn");
const warpABtn = document.getElementById("warp-a-btn");
const warpBBtn = document.getElementById("warp-b-btn");

function render() {
  const d = game.dungeon;
  statsEl.innerHTML = `
    <h2>Player</h2>
    <p><strong>HP:</strong> <span class="${game.player.hp > 20 ? "good" : "danger"}">${game.player.hp}/${game.player.maxHp}</span></p>
    <p><strong>Level:</strong> ${game.player.level} &nbsp; <strong>XP:</strong> ${game.player.xp}/${game.player.xpToNext}</p>
    <p><strong>Attack:</strong> ${game.player.attack}</p>
    <div class="pills">${game.player.skills.map(skill => `<span class="pill">${skill}</span>`).join("") || '<span class="subtle">No skills yet</span>'}</div>
  `;

  dungeonEl.innerHTML = `
    <h2>Dungeon ${d.id}</h2>
    <p><strong>Warp A:</strong> ${d.warps[0]} &nbsp; <strong>Warp B:</strong> ${d.warps[1]}</p>
    <p><strong>Monsters Alive:</strong> ${d.monsters.length}</p>
    <div class="pills">${d.monsters.slice(0, 10).map(m => `<span class="pill">${m.kind} (${m.hp}hp)</span>`).join("") || '<span class="subtle">Cleared for now</span>'}</div>
  `;

  logEl.innerHTML = game.log.slice(0, 16).map(line => `<li>${line}</li>`).join("");

  warpABtn.textContent = `Use Warp A → ${d.warps[0]}`;
  warpBBtn.textContent = `Use Warp B → ${d.warps[1]}`;

  const disabled = game.player.hp <= 0;
  stepBtn.disabled = disabled;
  warpABtn.disabled = disabled;
  warpBBtn.disabled = disabled;
}

stepBtn.addEventListener("click", () => {
  game.step();
  render();
});

warpABtn.addEventListener("click", () => {
  game.warp(0);
  render();
});

warpBBtn.addEventListener("click", () => {
  game.warp(1);
  render();
});

render();
