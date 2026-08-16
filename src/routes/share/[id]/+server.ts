import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { contests, lineups, lineupPicks, users } from '$lib/server/schema';

// Returns raw HTML directly (not a Svelte component) so link-preview crawlers
// (Twitter/Discord/etc — no JS execution, no cookies) get real og: meta tags
// in the initial response. This app runs ssr = false everywhere else because
// the root layout pulls in wallet SDKs that break under Node SSR; going
// through +page.svelte here would inherit that layout and crash the same
// way. A plain +server.ts endpoint never renders Svelte components or
// layouts, so it sidesteps that entirely.
export async function GET({ params, url }) {
	const contestId = params.id;
	const userId = url.searchParams.get('u');
	if (!contestId || !userId) return new Response('Not found', { status: 404 });

	const contest = await db
		.select()
		.from(contests)
		.where(eq(contests.id, contestId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (!contest || contest.status !== 'resolved') return new Response('Not found', { status: 404 });
	if (contest.userAId !== userId && contest.userBId !== userId) {
		return new Response('Not found', { status: 404 });
	}

	const lineup = await db
		.select()
		.from(lineups)
		.where(and(eq(lineups.contestId, contestId), eq(lineups.userId, userId)))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (!lineup) return new Response('Not found', { status: 404 });

	const picks = await db.select().from(lineupPicks).where(eq(lineupPicks.lineupId, lineup.id));
	const user = await db
		.select({ username: users.username })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	const didWin = contest.winnerId === userId;
	const yourScore = Number(Number(lineup.finalScore ?? 0).toFixed(0));
	const username = user?.username ?? 'Player';
	const contestType = contest.type ?? 'daily';

	const cardUrl = `${url.origin}/api/contest/${contestId}/card?u=${userId}`;
	const pageUrl = `${url.origin}/share/${contestId}?u=${userId}`;
	const title = `${didWin ? 'I won' : 'I played'} a ${contestType} contest on CoinDraft — ${yourScore} pts`;
	const description = picks
		.map((p) => `${p.tokenSymbol} ${Number(p.pctChange ?? 0) >= 0 ? '+' : ''}${Number(p.pctChange ?? 0).toFixed(1)}%`)
		.join(' · ');
	const tweetText = encodeURIComponent(
		`${didWin ? '🏆 I just won' : 'Just played'} a ${contestType} contest on CoinDraft — ${yourScore} pts`
	);
	const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(pageUrl)}`;

	const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

	const pickChips = picks
		.map((p) => {
			const pct = Number(p.pctChange ?? 0);
			const pctStr = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
			return `<span style="background:#f0eff8;color:#534ab7;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600;margin:3px">${esc(p.tokenSymbol)} ${esc(pctStr)}</span>`;
		})
		.join('');

	const html = `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>${esc(title)}</title>
	<meta name="description" content="${esc(description)}" />

	<meta property="og:type" content="website" />
	<meta property="og:title" content="${esc(title)}" />
	<meta property="og:description" content="${esc(description)}" />
	<meta property="og:image" content="${esc(cardUrl)}" />
	<meta property="og:url" content="${esc(pageUrl)}" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="${esc(title)}" />
	<meta name="twitter:description" content="${esc(description)}" />
	<meta name="twitter:image" content="${esc(cardUrl)}" />

	<style>
		body { font-family: 'Archivo', system-ui, sans-serif; background: #F5FAFA; margin: 0; padding: 40px 16px; color: #1A2421; }
		.card { max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; align-items: center; }
		img { width: 100%; border-radius: 18px; box-shadow: 0 12px 34px rgba(26,36,33,0.18); }
		.result { width: 100%; box-sizing: border-box; border: 1px solid #E1E8E6; border-radius: 20px; background: #FFFFFF; padding: 20px; }
		.status { font-weight: 800; color: ${didWin ? '#B04A32' : '#5C6B66'}; }
		.actions { display: flex; gap: 10px; width: 100%; }
		.actions a { flex: 1; box-sizing: border-box; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 999px; font-weight: 800; font-size: 14px; text-decoration: none; }
		.share-x { background: #F78E79; color: #1A2421; }
		.play { background: #FFFFFF; color: #5C6B66; border: 1px solid #E1E8E6; }
	</style>
</head>
<body>
	<div class="card">
		<img src="${esc(cardUrl)}" alt="${esc(title)}" />
		<div class="result">
			<h1 style="margin:0 0 4px;font-size:18px">${esc(username)}'s ${esc(contestType)} contest</h1>
			<p class="status" style="margin:0 0 12px">${didWin ? 'YOU WON' : 'YOU LOST'} · ${yourScore} pts</p>
			<div>${pickChips}</div>
		</div>
		<div class="actions">
			<a class="share-x" href="${esc(tweetUrl)}" target="_blank" rel="noopener noreferrer">Share to X</a>
			<a class="play" href="${url.origin}/dashboard">Play CoinDraft</a>
		</div>
	</div>
</body>
</html>`;

	return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
