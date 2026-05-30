# Fabric Flo — agent guide

Phone-first PWA for film/TV productions to track **fabrics and their matching bags** on set. One
physical piece per row, each with its own dynamic QR (or handwritten rental-house label), plus
locations, a shared scan log, and rental-list exports. Works offline; optional Supabase cloud sync
adds email sign-in, multi-crew productions, and Invite Codes.

## Stack

- **Web**: Vite + React + TypeScript + React Router (`src/`), PWA via vite-plugin-pwa.
- **Native**: Capacitor (`ios/`, `android/`), app id `app.fabricflo.tracker`.
- **Backend**: Supabase (Postgres + Auth + RLS + RPCs), migrations in `supabase/migrations/`.

## Read first

- [docs/FABRIC_FLO_GLOSSARY.md](docs/FABRIC_FLO_GLOSSARY.md) — product language and invariants.
  **Read this before editing any UI copy or product flow.**
- [docs/BACKEND_SETUP.md](docs/BACKEND_SETUP.md) — Supabase setup and what only the operator can do.
- [docs/BACKEND_API.md](docs/BACKEND_API.md), [docs/SYNC.md](docs/SYNC.md) — RPC surface and sync model.

## Key paths

| Area | Location |
|------|----------|
| Domain types and labels | `src/types.ts` |
| Cloud sync client | `src/lib/cloudRepository.ts` |
| Pages | `src/pages/` (`MarketingPage`, `HomePage`, `InventoryPage`, `ScanPage`, `LogPage`, ...) |
| Invite UI / share | `src/components/ProductionInviteSection.tsx`, `src/lib/inviteShare.ts` |
| Rental lists + logs | `src/components/DepartmentHeadListsPanel.tsx` |
| SQL migrations | `supabase/migrations/001`–`009` (bundle: `supabase/APPLY_ALL_MIGRATIONS.sql`) |

## Conventions

- Use **Invite Code** (never "join code"); one inventory row is the **fabric + bag pair**.
- Multi-crew/cloud features require `VITE_FABRIC_FLO_BACKEND=normalized`.
- Do not commit secrets (`.env`); `.env.example` documents required `VITE_*` vars.

## Useful commands

- `npm run dev`, `npm run build`, `npm run verify:release`
- `npm run supabase:bundle` — bundle migrations into one SQL file
- `npm run knowledge:export` — refresh the Claude knowledge pack in `docs/export/`
