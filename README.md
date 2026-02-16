# Never-Ending Dungeon Explorer (Top-Down Static Web Game)

A fully client-side top-down dungeon crawler that can be hosted on any static site provider.

## Gameplay

- Procedurally generated **dungeon maps** with walls and walkable floors.
- Player movement with **WASD / Arrow keys** and on-screen controls.
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
