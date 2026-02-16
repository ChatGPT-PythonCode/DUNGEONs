# Never-Ending Dungeon Explorer (Static Web App)

A browser-based endless dungeon prototype that runs fully on a static site (no backend).

## What it does

- Procedurally generates an unbounded chain of dungeons.
- Every dungeon has exactly **2 warps** to other dungeons.
- Spawns multiple monster types with different behaviors:
  - **Brute**: direct chase pressure.
  - **Rogue**: flanking movement.
  - **Stalker**: long-range flank, close-range chase.
- Player progression includes:
  - XP gain on monster defeat.
  - Level ups that increase stats.
  - Skill unlocks (power-up style abilities).

## Run locally

Because this is a static site, any simple file server works.

```bash
python -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

## Deploy to static hosting

This project can be hosted directly on:

- GitHub Pages
- Netlify
- Vercel (static mode)
- Cloudflare Pages

No build step is required; deploy these files as-is:

- `index.html`
- `styles.css`
- `app.js`
