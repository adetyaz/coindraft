// Standalone script — deployed separately from the main coindraft app (this
// branch/folder is never merged into the app's build). Keeps exactly ONE
// seeded account sitting in the real matchmaking queue at a time (rotating
// through the roster), by calling the app's existing, unmodified public API
// exactly like a browser would. Only one bot queues at once so bots never
// accidentally match each other — a real player joining is the only thing
// that can match the on-duty bot.
//
// Each tick, every bot's own contest list is checked directly (GET
// /api/contests) for any 'open' contest that still needs that bot's lineup
// submitted — this covers BOTH cases: the bot's own join call finding a
// match, and a real player's join call matching into the bot's queue slot
// (which the bot itself has no way to observe except by checking its own
// contest list). The lineup endpoint is idempotent, so re-checking and
// re-submitting is always safe.
//
// Usage:
//   SESSION_SECRET=... BASE_URL=https://coindraft.vercel.app node keep-bots-online.cjs
//
// Requires SESSION_SECRET to match whatever the target deployment uses.

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const SESSION_SECRET = process.env.SESSION_SECRET;
const POLL_MS = 10_000; // re-queue the on-duty bot before the app's 30s queue TTL expires

if (!SESSION_SECRET) {
	console.error('SESSION_SECRET env var is required (must match the target deployment).');
	process.exit(1);
}

const BOTS = [
	{ id: 'f684269c-7d3d-40b0-a21b-98bb766d64ff', username: 'CryptoWhale_99' },
	{ id: 'c84f9dd6-2e38-4765-974b-f38d1830d01b', username: 'AlphaLegend' },
	{ id: 'e747d3d3-736d-4f23-9ace-c20fcb6c1f93', username: 'SatoshiKnight' },
	{ id: 'b68c834e-3293-4412-ae54-efb19133d1cc', username: 'BullZone_OG' },
	{ id: '8b53257d-9c96-4a43-84c0-3a4a06f7e4b3', username: 'DegenScout' },
	{ id: '403c6e78-7c55-43f2-ba68-6380565332f3', username: 'ChartWizard' },
	{ id: '2c00b2ed-41a1-40a5-8458-4f932e112963', username: 'MoonRunner' },
	{ id: 'fb185647-3d16-41d3-96c5-2ff0001dd0e6', username: 'RektProof' }
];

// Bots currently resolved-and-idle skip queueing duty for a bit so the same
// bot doesn't immediately re-match itself against a fresh human right away —
// purely cosmetic variety, not required for correctness.
let dutyIndex = 0;
const submittedLineups = new Set(); // `${botId}:${contestId}` already handled this run

// Mirrors src/lib/server/auth.ts's createSessionToken exactly.
function createSessionToken(userId) {
	const payload = { userId, ts: Date.now() };
	const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64');
	const sig = Buffer.from(payloadStr + SESSION_SECRET).toString('base64').slice(0, 16);
	return `${payloadStr}.${sig}`;
}

async function callApi(bot, path, options = {}) {
	const token = createSessionToken(bot.id);
	const res = await fetch(`${BASE_URL}${path}`, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			Cookie: `session=${token}`,
			...(options.headers || {})
		}
	});
	const data = await res.json().catch(() => ({}));
	return { ok: res.ok, status: res.status, data };
}

async function submitLineupForBot(bot, contestId) {
	const key = `${bot.id}:${contestId}`;
	if (submittedLineups.has(key)) return true;

	const { ok, data: tokens } = await callApi(bot, '/api/tokens');
	if (!ok || !Array.isArray(tokens) || tokens.length < 5) {
		console.warn(`[${bot.username}] couldn't fetch tokens to draft a lineup, skipping`);
		return false;
	}
	const shuffled = [...tokens].sort(() => Math.random() - 0.5).slice(0, 5);
	const sectors = ['l1', 'l2', 'defi', 'meme', 'wildcard'];
	const picks = shuffled.map((t, i) => ({
		sector: sectors[i],
		symbol: t.symbol ?? t.currency_id,
		name: t.name ?? t.symbol ?? '',
		currencyId: t.currency_id
	}));

	const res = await callApi(bot, `/api/contest/${contestId}/lineup`, {
		method: 'POST',
		body: JSON.stringify({ picks })
	});
	if (res.ok) {
		console.log(`[${bot.username}] submitted a lineup for contest ${contestId}`);
		submittedLineups.add(key);
		return true;
	}
	console.warn(`[${bot.username}] lineup submit failed:`, res.data);
	return false;
}

/** Checks a bot's own contest list for any open contest still needing its lineup. */
async function handleOpenContests(bot) {
	const { ok, data } = await callApi(bot, '/api/contests');
	if (!ok || !Array.isArray(data)) return false;

	const open = data.filter(
		(c) => c.status === 'open' && (c.userAId === bot.id || c.userBId === bot.id)
	);
	for (const c of open) {
		await submitLineupForBot(bot, c.id);
	}
	return open.length > 0;
}

let tickRunning = false;

async function tick() {
	// setInterval can fire again before a slow tick() finishes (cold-start
	// latency, network hiccups, etc). Without this guard, two ticks could run
	// concurrently against two different bots — which is exactly how two
	// bots can end up matching each other instead of one always waiting for
	// a real player.
	if (tickRunning) {
		console.log('previous tick still running, skipping this interval');
		return;
	}
	tickRunning = true;
	try {
		await runTick();
	} finally {
		tickRunning = false;
	}
}

async function runTick() {
	const bot = BOTS[dutyIndex];

	// Always check for contests this bot already owes a lineup to first —
	// covers the case where a real player's join call matched into this
	// bot's queue slot since the bot's own last tick.
	const hadOpenContest = await handleOpenContests(bot);
	if (hadOpenContest) {
		console.log(`[${bot.username}] handled its open contest(s) — rotating duty`);
		dutyIndex = (dutyIndex + 1) % BOTS.length;
		return;
	}

	try {
		const { ok, data } = await callApi(bot, '/api/matchmaking/join', {
			method: 'POST',
			body: JSON.stringify({ type: 'daily' })
		});
		if (!ok) {
			console.warn(`[${bot.username}] join failed:`, data);
			return;
		}
		if (data.status === 'matched') {
			console.log(`[${bot.username}] matched into contest ${data.contestId} — drafting`);
			await submitLineupForBot(bot, data.contestId);
			dutyIndex = (dutyIndex + 1) % BOTS.length;
		} else {
			console.log(`[${bot.username}] on duty, waiting for a real opponent...`);
		}
	} catch (e) {
		console.error(`[${bot.username}] tick error:`, e.message);
	}
}

console.log(`Rotating ${BOTS.length} bots on matchmaking duty against ${BASE_URL} every ${POLL_MS / 1000}s. Ctrl+C to stop.`);

tick();
setInterval(tick, POLL_MS);
