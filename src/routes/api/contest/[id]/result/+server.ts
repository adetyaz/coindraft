import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { contests, lineups, lineupPicks } from '$lib/server/schema';
import { parseSessionToken } from '$lib/server/auth';
import { getSnapshot } from '$lib/server/sosovalue';
import { calcPickScore, calcLineupScore } from '$lib/server/scoring';

function extractPrice(snapshot: unknown): number {
	if (!snapshot || typeof snapshot !== 'object') return 0;
	const s = snapshot as Record<string, unknown>;
	const candidates = [
		s?.price,
		s?.current_price,
		s?.close,
		s?.last_price,
		s?.usd_price,
		s?.priceUsd,
		s?.price_usd,
		s?.latestPrice,
		(s?.market_data as Record<string, unknown> | undefined)?.current_price
			? ((s.market_data as Record<string, unknown>).current_price as Record<string, unknown>)?.usd
			: undefined
	];
	for (const value of candidates) {
		const n = Number(value);
		if (Number.isFinite(n) && n > 0) return n;
	}
	return 0;
}

export async function GET({ params, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const contestId = params.id;
	if (!contestId) return json({ error: 'Contest id is required' }, { status: 400 });

	const contest = await db
		.select()
		.from(contests)
		.where(eq(contests.id, contestId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (!contest) return json({ error: 'Contest not found' }, { status: 404 });
	if (contest.userAId !== parsed.userId) return json({ error: 'Forbidden' }, { status: 403 });

	const lineup = await db
		.select()
		.from(lineups)
		.where(and(eq(lineups.contestId, contestId), eq(lineups.userId, parsed.userId)))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (!lineup) return json({ error: 'Lineup not found' }, { status: 404 });

	const picks = await db.select().from(lineupPicks).where(eq(lineupPicks.lineupId, lineup.id));
	if (picks.length === 0) return json({ error: 'No picks found' }, { status: 404 });

	// If already resolved, return stored results without re-scoring (avoids extra API calls)
	if (contest.status === 'resolved') {
		const scoredPicks = picks.map((p) => ({
			sector: p.sector,
			pick: p.tokenSymbol,
			pct: Number(Number(p.pctChange ?? 0).toFixed(2)),
			opponent: 'Bot',
			points: Number(Number(p.score ?? 0).toFixed(2))
		}));
		const total = calcLineupScore(picks.map((p) => ({ score: p.score ?? 0 })));
		const won = contest.winnerId === parsed.userId;
		return json({
			contestId,
			status: won ? 'YOU WON' : 'YOU LOST',
			xp: won ? 250 : 60,
			yourScore: Number(Number(lineup.finalScore ?? 0).toFixed(0)),
			opponentScore: Number(Math.max(0, total - 120 + 110).toFixed(0)),
			breakdown: scoredPicks
		});
	}

	const scoredPicks: Array<{
		sector: string;
		pick: string;
		pct: number;
		opponent: string;
		points: number;
	}> = [];

	// Fetch all exit prices in parallel — snapshots are cached 60s so repeat fetches are free
	const snapshots = await Promise.all(
		picks.map((p) => getSnapshot(p.currencyId).catch(() => null))
	);

	for (let i = 0; i < picks.length; i++) {
		const pick = picks[i];
		const exitPrice = extractPrice(snapshots[i]);
		const entry = Number(pick.entryPrice ?? 0);
		const pct = entry > 0 ? ((exitPrice - entry) / entry) * 100 : 0;
		const score = calcPickScore(entry || 1, exitPrice || entry || 1);

		await db
			.update(lineupPicks)
			.set({
				exitPrice: String(exitPrice),
				pctChange: String(pct),
				score: String(score)
			})
			.where(eq(lineupPicks.id, pick.id));

		scoredPicks.push({
			sector: pick.sector,
			pick: pick.tokenSymbol,
			pct: Number(pct.toFixed(2)),
			opponent: 'Bot',
			points: Number(score.toFixed(2))
		});
	}

	const total = calcLineupScore(scoredPicks.map((p) => ({ score: p.points })));
	const botScore = Math.max(0, total - 120 + Math.random() * 220);
	const won = total >= botScore;

	await db
		.update(lineups)
		.set({ finalScore: String(total) })
		.where(eq(lineups.id, lineup.id));

	await db
		.update(contests)
		.set({
			status: 'resolved',
			winnerId: won ? parsed.userId : null,
			endAt: new Date()
		})
		.where(eq(contests.id, contestId));

	return json({
		contestId,
		status: won ? 'YOU WON' : 'YOU LOST',
		xp: won ? 250 : 60,
		yourScore: Number(total.toFixed(0)),
		opponentScore: Number(botScore.toFixed(0)),
		breakdown: scoredPicks
	});
}
