<!-- AGENTS.md — CoinDraft -->

# CoinDraft — Agent Guide

## Project Overview

CoinDraft is a wallet-first crypto fantasy game built in **SvelteKit + TypeScript**. Users connect an EVM or Solana wallet, draft a five-token lineup across crypto sectors (L1, L2, DeFi, Meme, Wildcard), submit it into a head-to-head contest, and receive a resolved result based on real market data from the SoSoValue API. The app is deployed on Vercel and uses Neon (serverless Postgres) as its database.

The project is currently at **Wave 1** scope: a working end-to-end draft-to-result loop with wallet auth, live market data, AI-powered post-match breakdowns (via Groq), and a Vercel deployment.

- **Language**: TypeScript
- **Package Manager**: npm
- **Framework**: SvelteKit (runes mode enforced)
- **Styling**: Tailwind CSS v4
- **Database**: Neon (serverless Postgres)
- **ORM**: Drizzle ORM
- **Auth**: Reown AppKit (EVM + Solana), SIWE + ed25519 signatures
- **AI**: Groq API (`llama-3.3-70b-versatile`)
- **Data**: SoSoValue API (server-side only)
- **Deployment**: Vercel (`@sveltejs/adapter-vercel`)

---

## Build and Development Commands

All commands are run via npm:

| Command               | Purpose                                   |
| --------------------- | ----------------------------------------- |
| `npm run dev`         | Start the Vite dev server                 |
| `npm run build`       | Create a production build                 |
| `npm run preview`     | Preview the production build locally      |
| `npm run check`       | Run Svelte type-checking (`svelte-check`) |
| `npm run check:watch` | Type-check in watch mode                  |
| `npm run lint`        | Run Prettier check + ESLint               |
| `npm run format`      | Auto-format with Prettier                 |
| `npm run db:push`     | Push Drizzle schema to the database       |
| `npm run db:generate` | Generate Drizzle migration files          |
| `npm run db:migrate`  | Run pending Drizzle migrations            |
| `npm run db:studio`   | Open Drizzle Studio                       |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/coindraft"

# SoSoValue API
SOSOVALUE_API_KEY=your_key_here
SOSOVALUE_BASE_URL=https://openapi.sosovalue.com/openapi/v1

# AI (Groq)
GROQ_API_KEY=your_key_here

# Auth
SESSION_SECRET=your_random_32_char_secret_key_here

# Reown (public client key — exposed to browser)
PUBLIC_REOWN_PROJECT_ID=your_reown_project_id_here
```

**Security rule**: `SOSOVALUE_API_KEY` must never be used in client-side code. All SoSoValue calls go through SvelteKit `+server.ts` API routes.

---

## Code Organization

```
src/
├── app.d.ts              # SvelteKit ambient types
├── app.html              # HTML shell
├── lib/
│   ├── appkit.ts         # Reown AppKit singleton (client-only, EVM + Solana)
│   ├── constants.ts      # Game sectors (L1, L2, DeFi, Meme, Wildcard)
│   ├── toast.ts          # Toast store + helper
│   ├── tokenRegistry.ts  # Hardcoded draft pool (Wave 1)
│   ├── components/
│   │   └── Toast.svelte  # Toast UI component
│   ├── assets/           # SVG logos, diagrams
│   └── server/           # Server-only code ($lib/server)
│       ├── auth.ts       # Session token create/parse + user lookups
│       ├── db.ts         # Drizzle + Neon client (legacy, kept for compat)
│       ├── db/index.ts   # Drizzle + Neon client (dynamic env)
│       ├── schema.ts     # Drizzle schema (users, contests, lineups, lineupPicks)
│       ├── scoring.ts    # Pick/lineup scoring logic + ETF streak detection
│       └── sosovalue.ts  # SoSoValue API client with in-memory cache
└── routes/
    ├── +layout.svelte    # Root layout: nav, wallet auth, session
    ├── +layout.server.ts # Server load: parse session, protect routes
    ├── +layout.ts        # `export const ssr = false`
    ├── +page.svelte      # Landing page (hero, playbook, winners)
    ├── layout.css        # Tailwind entrypoint (`@import 'tailwindcss'`)
    ├── api/
    │   ├── auth/         # nonce, verify, logout, login (wallet-only), signup
    │   ├── contests/     # list + create contests
    │   ├── contest/[id]/ # lineup submission, result resolution
    │   ├── tokens/       # token list with live prices
    │   ├── sectors/      # sector performance
    │   ├── etf/          # ETF flow alerts
    │   ├── news/         # news feed
    │   ├── snapshot/[id]/ # market snapshot for a currency
    │   └── breakdown/    # AI post-match analysis (Groq)
    ├── dashboard/        # Contest entry + market context
    ├── draft/            # Five-pick lineup builder
    ├── manager/          # Full manager hub with sidebar
    ├── contest/result/   # Resolved contest view
    ├── login/            # Legacy email login page (non-functional)
    └── signup/           # Legacy email signup page (non-functional)
```

### Key module rules

- **Client code** lives in `src/lib/` (not inside `src/lib/server/`).
- **Server-only code** lives in `src/lib/server/`. SvelteKit prevents client imports from here.
- **API routes** are SvelteKit `+server.ts` files under `src/routes/api/`.
- **Pages** are `+page.svelte` files under `src/routes/`.

---

## Technology Stack Details

### SvelteKit

- Runes mode is enforced for all non-node_modules files (`svelte.config.js`).
- SSR is disabled globally (`src/routes/+layout.ts` exports `ssr = false`).
- The app uses Svelte 5 runes (`$state`, `$derived`, `$derived.by`, `$props`).

### Tailwind CSS v4

- Configured via Vite plugin (`@tailwindcss/vite`).
- Entry CSS is `src/routes/layout.css` (`@import 'tailwindcss'`).
- Prettier uses `prettier-plugin-tailwindcss` with `tailwindStylesheet` pointing to `layout.css`.

### Drizzle + Neon

- Schema is defined in `src/lib/server/schema.ts`.
- The active DB client is `src/lib/server/db/index.ts` (uses `$env/dynamic/private`).
- `drizzle.config.ts` points to `src/lib/server/schema.ts`.

### Auth

- Wallet-first. No email/password in production.
- Reown AppKit handles EVM (Wagmi) and Solana (Phantom, Solflare) connections.
- Flow: `nonce` → wallet signs message → `verify` → session cookie (`session`, httpOnly, 7 days).
- EVM uses SIWE (`siwe` package). Solana uses ed25519 signature verification (`tweetnacl` + `bs58`).
- Protected routes (`/draft`, `/contest`) redirect unauthenticated users to `/?auth=required`.

### SoSoValue Integration

- Base URL: `https://openapi.sosovalue.com/openapi/v1`
- Auth header: `x-soso-api-key`
- All calls go through `src/lib/server/sosovalue.ts`.
- In-memory `Map` cache with per-endpoint TTLs:
  - `/currencies` — 24h
  - `/currencies/sector-spotlight` — 5min
  - `/etfs/summary-history` — 5min
  - `/news/featured` — 15min
  - `/currencies/{id}/market-snapshot` — 60s
- Retry with backoff on HTTP 429.

### AI Breakdown

- `POST /api/breakdown` sends pick data + news context to Groq (`llama-3.3-70b-versatile`).
- Returns a concise 2–3 sentence analysis.
- News fetch failures are non-fatal; the prompt proceeds without headlines.

---

## Code Style Guidelines

### Formatting

- **Prettier** with tabs, single quotes, no trailing commas, print width 100.
- Plugins: `prettier-plugin-svelte`, `prettier-plugin-tailwindcss`.
- Run `npm run format` before committing.

### Linting

- **ESLint** flat config (`eslint.config.js`).
- Extends: `@eslint/js/recommended`, `typescript-eslint/recommended`, `eslint-plugin-svelte/recommended`, `prettier`.
- `no-undef` is off (TypeScript handles this).
- Run `npm run lint` before committing.

### TypeScript

- Strict mode enabled.
- `moduleResolution: "bundler"`.
- Relative import extensions are rewritten (`rewriteRelativeImportExtensions: true`).

### Naming and Structure

- Use Svelte 5 runes. Avoid legacy `$:` reactive statements.
- Server files that must stay server-only go under `src/lib/server/`.
- API route handlers export `GET`/`POST` functions from `@sveltejs/kit`.
- Database schema uses camelCase TS names with snake_case column names (e.g., `xpTotal` → `xp_total`).

### Colors (design system)

| Role           | Hex       |
| -------------- | --------- |
| Primary brand  | `#534AB7` |
| Brand light    | `#EEEDFE` |
| Positive       | `#0F6E56` |
| Positive light | `#E1F5EE` |
| Negative       | `#993C1D` |
| Negative light | `#FAECE7` |
| Neutral text   | `#888780` |

---

## Testing Instructions

There is **no automated test suite** in the project yet. Validation is manual:

1. **Dev server**: `npm run dev`
2. **Type check**: `npm run check`
3. **Lint**: `npm run lint`
4. **End-to-end manual flow**:
   - Connect wallet (EVM or Solana) via Reown.
   - Verify session cookie is created.
   - Create a contest from `/dashboard` or `/manager`.
   - Draft 5 picks on `/draft` and submit.
   - Visit `/contest/result?contestId=...` to resolve and view the result.
   - Confirm AI breakdown loads (or degrades gracefully if Groq fails).

---

## Database Schema

Defined in `src/lib/server/schema.ts`:

- **users** — `id`, `walletAddress` (unique), `chainType` (`evm` | `solana`), `username` (unique), `xpTotal`, `streak`, `createdAt`
- **contests** — `id`, `userAId`, `userBId`, `type` (`daily` | `weekly`), `status` (`open` | `live` | `resolved`), `startAt`, `endAt`, `winnerId`
- **lineups** — `id`, `contestId`, `userId`, `locked`, `finalScore`, `breakdown`
- **lineupPicks** — `id`, `lineupId`, `tokenSymbol`, `tokenName`, `sector`, `currencyId`, `entryPrice`, `exitPrice`, `pctChange`, `score`

**Note**: A legacy schema with email/password fields exists in `src/lib/server/db/schema.ts`. The canonical schema is `src/lib/server/schema.ts`.

---

## API Routes

| Route                      | Method | Purpose                                     |
| -------------------------- | ------ | ------------------------------------------- |
| `/api/auth/nonce`          | GET    | Issue SIWE nonce cookie                     |
| `/api/auth/verify`         | POST   | Verify signature, upsert user, set session  |
| `/api/auth/logout`         | POST   | Clear session cookie                        |
| `/api/auth/login`          | POST   | Legacy — returns 400 (wallet only)          |
| `/api/auth/signup`         | POST   | Legacy — returns 400 (wallet only)          |
| `/api/contests`            | GET    | List user's contests                        |
| `/api/contests`            | POST   | Create or reuse an active contest           |
| `/api/contest/[id]/lineup` | POST   | Submit 5-pick lineup, lock contest          |
| `/api/contest/[id]/result` | GET    | Resolve contest, score picks, return result |
| `/api/tokens`              | GET    | Top 30 tokens with live prices              |
| `/api/sectors`             | GET    | Sector performance (mapped to game sectors) |
| `/api/etf`                 | GET    | ETF flow alerts (IBIT)                      |
| `/api/news`                | GET    | Featured news headlines                     |
| `/api/snapshot/[id]`       | GET    | Market snapshot for a currency              |
| `/api/breakdown`           | POST   | AI post-match analysis                      |

---

## Security Considerations

- **Never expose `SOSOVALUE_API_KEY` or `GROQ_API_KEY` to the browser.** They are only imported in `+server.ts` files or `src/lib/server/` modules.
- **Session cookies** are `httpOnly`, `sameSite: 'strict'`, and signed with `SESSION_SECRET` using a simple HMAC-like scheme.
- **Nonce cookies** expire in 5 minutes and are deleted after verification.
- **Wallet auth** is the only supported auth method. Legacy `/login` and `/signup` pages and API routes are non-functional and return 400.
- **Rate limiting**: SoSoValue client retries on 429. There is no application-level rate limiter yet.

---

## Deployment

The project is configured for **Vercel**:

- Adapter: `@sveltejs/adapter-vercel`
- Build command: `npm run build`
- Ensure `DATABASE_URL` and other secrets are set in Vercel environment variables.

---

## Available Svelte MCP Tools

This project has a `.vscode/mcp.json` configuration for the Svelte MCP server. When working on Svelte or SvelteKit topics, use these tools:

1. **list-sections** — Discover available documentation sections.
2. **get-documentation** — Retrieve full docs for specific sections.
3. **svelte-autofixer** — Analyze Svelte code and return issues/suggestions. **Always use this before finalizing Svelte code.**
4. **playground-link** — Generate a Svelte Playground link (only after user confirmation, never for files written to the project).

---

## Legacy / Known Issues

- `src/lib/server/db/schema.ts` contains an old email/password user schema. The canonical schema is `src/lib/server/schema.ts`.
- `src/lib/server/db.ts` uses `$env/static/private` and is kept for compatibility. Prefer `src/lib/server/db/index.ts`.
- `/login` and `/signup` pages exist but are non-functional. The app is wallet-only.
- The opponent in Wave 1 is synthetic (bot score is computed from the user's score). Real matchmaking is planned for Wave 2.
- Contest resolution is triggered on the first `GET` to `/api/contest/[id]/result`. There is no cron or scheduler yet.
