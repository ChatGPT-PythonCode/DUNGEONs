# Never-Ending Dungeon Explorer (Top-Down Static Web Game)

A fully client-side top-down dungeon crawler that can be hosted on any static site provider.

## Gameplay

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
