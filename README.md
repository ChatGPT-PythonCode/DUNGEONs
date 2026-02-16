# DUNGEONs Multiplayer Monster Collection MVP

PWA-first monorepo with server-authoritative gameplay.

## Structure

- `client` - React + Vite mobile-first UI and Canvas symbol rendering.
- `server` - Express + Socket.IO API with deterministic game logic modules.
- `shared` - Shared zod schemas/constants for request validation.

## Core implemented systems

- Auth (`/auth/register`, `/auth/login`) with JWT.
- New player grants 10 meat and chooses a common starter.
- Areas and exploration encounters with weighted spawn tables.
- Server-authoritative battle simulator and EXP leveling.
- Taming formula using base difficulty + meat + hp percentage.
- Stat allocation with server-side point budget enforcement.
- Breeding with data-driven breed table (`content/breedResults.json`) and lineage tracking.
- On-demand tournaments (run when 4 entries queue), server simulated bracket, meat+badge rewards.
- Realtime area presence and tournament status over Socket.IO.
- Data-driven content pipeline (`server/content/*.json`) for adding new monster species/areas.

## Quick start

1. Create PostgreSQL DB and set env vars:
   - `DATABASE_URL=postgresql://...`
   - `JWT_SECRET=...`
2. Install:
   - `npm install`
3. Generate Prisma client and migrate:
   - `npm run prisma:generate -w server`
   - `npx prisma migrate dev --schema server/prisma/schema.prisma`
4. Seed content:
   - `npm run seed`
5. Run:
   - `npm run dev`

## Multiplayer events

- `area:join`, `area:leave`, `area:presence_update`
- `tournament:status`, `tournament:match_result`

