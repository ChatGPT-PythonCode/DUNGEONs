# Never-Ending Dungeon Explorer (Top-Down Static Web Game)

A fully client-side top-down dungeon crawler that can be hosted on any static site provider.

## Gameplay

- Procedurally generated **large dungeon maps** (36x36 tiles).
- More dungeon-like generation:
  - rectangular rooms,
  - narrow corridors,
  - branch passages for exploration.
- Connectivity guarantee: generated floor space is flood-fill connected so reachable areas stay traversable.
- Player controls:
  - **Arrow keys** or on-screen arrows for movement,
  - **Space** or **SPACE / ATTACK** for attack,
  - **Shift** or **SHIFT / ESCAPE** for evasive repositioning.
- Mobile/touch support:
  - tap adjacent map tile to move,
  - tap adjacent monster tile + attack button to fight,
  - touch-friendly controls.
- Exactly **2 warp gates per dungeon**, each linking to another generated dungeon.
- Smarter monster behavior:
  - stateful aggro/search logic,
  - crowd-aware movement so they don’t all stack behind the player,
  - flanking/chasing by monster type.
- Player progression:
  - XP and leveling,
  - stat growth (HP/ATK),
  - power-up skills (Power Strike, Blink, Arc Burst, Battle Trance, Regeneration).
- Procedurally generated **big dungeon maps** (32x32 tiles).
- Dungeons are generated as a connected cavern so there is always a walkable path across the explored floor network.
- Player movement with **Arrow keys** or on-screen arrow controls.
- **Space** (keyboard) or **SPACE / ATTACK** button for attacks.
- Mobile/touch support:
  - Tap a neighboring map tile to move.
  - Tap attack button to attack adjacent enemies.
- Exactly **2 warp gates per dungeon**, each linking to another generated dungeon.
- Multiple smart monster types:
  - **Brute**: direct chaser.
  - **Rogue**: flank behavior.
  - **Stalker**: flank at range, chase at close distance.
- Turn-based combat while moving through the map.
- Player progression:
  - XP and leveling.
  - Stat growth (HP/ATK).
  - Power-up skills (Power Strike, Blink, Arc Burst, Battle Trance, Regeneration).

## Run locally

```bash
python -m http.server 4173
```

Open `http://localhost:4173`.

## Static hosting

Deploy these files directly with no build step:

- `index.html`
- `styles.css`
- `app.js`

Compatible with GitHub Pages, Netlify, Cloudflare Pages, and Vercel static hosting.
