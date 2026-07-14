import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { contests, lineups, lineupPicks } from '$lib/server/schema';
import { parseSessionToken } from '$lib/server/auth';
import { resolveContest } from '$lib/server/contest-resolution';

export async function GET({ params, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const contestId = params.id;
	if (!contestId) return json({ error: 'Contest id is required' }, { status: 400 });

	let contest = await db
		.select()
		.from(contests)
		.where(eq(contests.id, contestId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (!contest) return json({ error: 'Contest not found' }, { status: 404 });
	if (contest.userAId !== parsed.userId && contest.userBId !== parsed.userId) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	if (contest.status === 'live') {
		const result = await resolveContest(contestId);
		if (!result.resolved) {
			const reason =
				result.reason === 'missing_lineup_b'
					? 'Opponent has not submitted a lineup yet'
					: 'Contest is not ready to resolve yet';
			return json({ error: reason }, { status: 400 });
		}
		contest = await db
			.select()
			.from(contests)
			.where(eq(contests.id, contestId))
			.limit(1)
			.then((rows) => rows[0]);
	}

	if (contest.status !== 'resolved') {
		return json({ error: 'Contest is not live yet' }, { status: 400 });
	}

	const isUserA = contest.userAId === parsed.userId;

	const myLineup = await db
		.select()
		.from(lineups)
		.where(and(eq(lineups.contestId, contestId), eq(lineups.userId, parsed.userId)))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (!myLineup) return json({ error: 'Lineup not found' }, { status: 404 });

	const myPicks = await db.select().from(lineupPicks).where(eq(lineupPicks.lineupId, myLineup.id));
	if (myPicks.length === 0) return json({ error: 'No picks found' }, { status: 404 });

	const scoredPicks = myPicks.map((p) => ({
		sector: p.sector,
		pick: p.tokenSymbol,
		pct: Number(Number(p.pctChange ?? 0).toFixed(2)),
		opponent: contest.userBId ? 'Opponent' : 'Bot',
		points: Number(Number(p.score ?? 0).toFixed(2))
	}));
	const didWin = contest.winnerId === parsed.userId;

	let opponentScore = 0;
	if (contest.userBId) {
		const opponentId = isUserA ? contest.userBId : contest.userAId;
		const opponentLineup = opponentId
			? await db
					.select()
					.from(lineups)
					.where(and(eq(lineups.contestId, contestId), eq(lineups.userId, opponentId)))
					.limit(1)
					.then((rows) => rows[0] ?? null)
			: null;
		opponentScore = opponentLineup ? Number(Number(opponentLineup.finalScore ?? 0).toFixed(0)) : 0;
	} else {
		const total = myPicks.reduce((sum, p) => sum + Number(p.score ?? 0), 0);
		opponentScore = Number(Math.max(0, total - 120 + 110).toFixed(0));
	}

	const xpMultiplier = contest.type === 'weekly' ? 2 : 1;

	return json({
		contestId,
		status: didWin ? 'YOU WON' : 'YOU LOST',
		xp: (didWin ? 250 : 60) * xpMultiplier,
		yourScore: Number(Number(myLineup.finalScore ?? 0).toFixed(0)),
		opponentScore,
		breakdown: scoredPicks
	});
}
