# CoinDraft Bots Service

Always-on background worker that keeps 8 seeded accounts sitting in CoinDraft's
real matchmaking queue, so a real player is always matched quickly instead of
finding an empty queue.

**Important:** this is not part of the main app. It lives on the
`bots-service` branch only — never merge this branch into `main`. It's a
separate deployable unit (a plain long-running Node process, not a web
service) that talks to the live app entirely through its existing, public
API, exactly like a browser would. No application code was changed to build
this.

## How it works

1. Exactly one bot is "on duty" at a time (rotating through the roster) —
   this is deliberate: if multiple bots queued simultaneously they'd end up
   matching each other instead of waiting for a real player.
2. Every 10 seconds, the on-duty bot either re-queues itself (refreshing
   before the app's own 30-second queue TTL expires) or, if it's already been
   matched into a contest, submits a real lineup (live tokens, live prices)
   and hands duty to the next bot.
3. When a real player joins matchmaking and nobody else is queued, the app's
   own unmodified matchmaking logic matches them with whichever bot is on
   duty — same code path as matching two real players.

## Deploy

Requires `SESSION_SECRET` to match the target deployment's value (Vercel
project env vars) — this is what lets the script authenticate as the seeded
bot accounts, mirroring `src/lib/server/auth.ts`'s session token format
exactly.

**Railway** (recommended — this is a persistent worker, not a web service):

```bash
npm install -g @railway/cli
railway login
railway init          # from inside this bots-service/ folder
railway variables --set "SESSION_SECRET=..." --set "BASE_URL=https://coindraft.vercel.app"
railway up
```

Railway may warn "no open port detected" — expected and harmless, this
process never opens an HTTP port, it only makes outbound requests.

## Env vars

| Var | Required | Purpose |
| --- | --- | --- |
| `SESSION_SECRET` | yes | Must match the target deployment's session secret |
| `BASE_URL` | no (defaults to `http://localhost:5173`) | Which deployment to keep bots online against |
