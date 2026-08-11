# CoinDraft Bots Service

Always-on background worker that keeps 8 seeded accounts sitting in CoinDraft's
real matchmaking queue, so a real player is always matched quickly instead of
finding an empty queue.

**Important:** this is not part of the main app. It lives on the
`bots-service` branch only — never merge this branch into `main`. It's a
separate deployable unit that talks to the live app entirely through its
existing, public API, exactly like a browser would. No application code was
changed to build this.

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
4. A re-entrancy guard stops two ticks from ever running concurrently
   (possible if one tick is slow — e.g. a cold-start request), which would
   otherwise let two different bots queue at once and match each other.
5. Every network failure is caught — one bad tick just gets retried next
   interval, it never takes down the whole process.

Requires `SESSION_SECRET` to match the target deployment's value (Vercel
project env vars) — this is what lets the script authenticate as the seeded
bot accounts, mirroring `src/lib/server/auth.ts`'s session token format
exactly.

## Deploy on Render (free tier)

Render has **no free tier for background workers** — only web services get a
free instance. So this script also binds an HTTP port (only if `PORT` is
set) and answers a status endpoint, purely so Render treats it as a web
service for billing. The bot logic itself is identical either way. Because
free web services on Render sleep after 15 minutes with no HTTP traffic, an
external uptime pinger has to hit the service periodically to keep it awake
— that's the tradeoff for staying on the free tier.

1. Push this branch to GitHub (already done if you're reading this from the repo).
2. On [render.com](https://render.com), **New → Web Service**, connect this repo, branch: `bots-service`.
3. Root directory: `bots-service`. Build command: `npm install`. Start command: `npm start`.
4. Instance type: **Free**.
5. Environment variables:
   - `SESSION_SECRET` — must match Vercel's value exactly
   - `BASE_URL` — `https://coindraft.vercel.app`
   - Render sets `PORT` automatically — don't set it yourself.
6. Deploy. Once live, note the Render-assigned URL (something like `https://coindraft-bots.onrender.com`).
7. Set up an external pinger so Render never sleeps it: sign up at
   [uptimerobot.com](https://uptimerobot.com) (free), add an HTTP(S) monitor
   pointed at your Render URL, interval **5 minutes** (comfortably under
   Render's 15-minute sleep timer).

Visit the Render URL directly any time to see live status — it returns JSON
with the bot count, last tick time, and last event (e.g. `"CryptoWhale_99 on
duty, waiting"`).

## Alternative: a real persistent-worker host

If the Render + external-pinger setup ever feels too fragile (a missed ping
= bots silently offline until the next one lands), this same script runs
unmodified as a genuine background worker anywhere that supports one —
Railway, Fly.io, a small always-on VM (e.g. Oracle Cloud's free tier), etc.
Just don't set `PORT` and it skips the HTTP server entirely, running exactly
as a plain long-running process.

## Env vars

| Var | Required | Purpose |
| --- | --- | --- |
| `SESSION_SECRET` | yes | Must match the target deployment's session secret |
| `BASE_URL` | no (defaults to `http://localhost:5173`) | Which deployment to keep bots online against |
| `PORT` | no | If set, starts the health-check HTTP server (Render sets this automatically) |
