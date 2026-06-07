import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { contests, lineups, lineupPicks, users, leagueMembers } from '$lib/server/schema';
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
	if (contest.userAId !== parsed.userId && contest.userBId !== parsed.userId) {
		return json({ error: 'Forbidden' }, { status: 403 });
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

	// If already resolved, return stored results
	if (contest.status === 'resolved') {
		const scoredPicks = myPicks.map((p) => ({
			sector: p.sector,
			pick: p.tokenSymbol,
			pct: Number(Number(p.pctChange ?? 0).toFixed(2)),
			opponent: contest.userBId ? 'Opponent' : 'Bot',
			points: Number(Number(p.score ?? 0).toFixed(2))
		}));
		const didWin = contest.winnerId === parsed.userId;

		// Get real opponent score if available
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
			opponentScore = opponentLineup
				? Number(Number(opponentLineup.finalScore ?? 0).toFixed(0))
				: 0;
		} else {
			const total = calcLineupScore(myPicks.map((p) => ({ score: p.score ?? 0 })));
			opponentScore = Number(Math.max(0, total - 120 + 110).toFixed(0));
		}

		return json({
			contestId,
			status: didWin ? 'YOU WON' : 'YOU LOST',
			xp: didWin ? 250 : 60,
			yourScore: Number(Number(myLineup.finalScore ?? 0).toFixed(0)),
			opponentScore,
			breakdown: scoredPicks
		});
	}

	// Only allow resolution if contest is live
	if (contest.status !== 'live') {
		return json({ error: 'Contest is not live yet' }, { status: 400 });
	}

	const scoredPicks: Array<{
		sector: string;
		pick: string;
		pct: number;
		opponent: string;
		points: number;
	}> = [];

	// Fetch exit prices for my picks
	const snapshots = await Promise.all(
		myPicks.map((p) => getSnapshot(p.currencyId).catch(() => null))
	);

	for (let i = 0; i < myPicks.length; i++) {
		const pick = myPicks[i];
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
			opponent: contest.userBId ? 'Opponent' : 'Bot',
			points: Number(score.toFixed(2))
		});
	}

	const myTotal = calcLineupScore(scoredPicks.map((p) => ({ score: p.points })));

	// Determine opponent score
	let opponentTotal = 0;
	let didWin = false;

	if (contest.userBId) {
		// Real opponent — fetch their lineup and score it
		const opponentId = isUserA ? contest.userBId : contest.userAId;
		const opponentLineup = opponentId
			? await db
					.select()
					.from(lineups)
					.where(and(eq(lineups.contestId, contestId), eq(lineups.userId, opponentId)))
					.limit(1)
					.then((rows) => rows[0] ?? null)
			: null;

		if (!opponentLineup) {
			return json({ error: 'Opponent has not submitted a lineup yet' }, { status: 400 });
		}

		const opponentPicks = await db
			.select()
			.from(lineupPicks)
			.where(eq(lineupPicks.lineupId, opponentLineup.id));

		const opponentSnapshots = await Promise.all(
			opponentPicks.map((p) => getSnapshot(p.currencyId).catch(() => null))
		);

		let oppScoreSum = 0;
		for (let i = 0; i < opponentPicks.length; i++) {
			const pick = opponentPicks[i];
			const exitPrice = extractPrice(opponentSnapshots[i]);
			const entry = Number(pick.entryPrice ?? 0);
			const pct = entry > 0 ? ((exitPrice - entry) / entry) * 100 : 0;
			const score = calcPickScore(entry || 1, exitPrice || entry || 1);

			await db
				.update(lineupPicks)
				.set({ exitPrice: String(exitPrice), pctChange: String(pct), score: String(score) })
				.where(eq(lineupPicks.id, pick.id));

			oppScoreSum += score;
		}

		opponentTotal = oppScoreSum;
		await db
			.update(lineups)
			.set({ finalScore: String(oppScoreSum) })
			.where(eq(lineups.id, opponentLineup.id));

		didWin = myTotal >= opponentTotal;
	} else {
		// Bot opponent
		opponentTotal = Math.max(0, myTotal - 120 + Math.random() * 220);
		didWin = myTotal >= opponentTotal;
	}

	// Update my lineup
	await db
		.update(lineups)
		.set({ finalScore: String(myTotal) })
		.where(eq(lineups.id, myLineup.id));

	// Update contest
	await db
		.update(contests)
		.set({
			status: 'resolved',
			winnerId: didWin ? parsed.userId : contest.userBId || null,
			endAt: new Date()
		})
		.where(eq(contests.id, contestId));

	// Award XP to both players
	const winnerId = didWin ? parsed.userId : contest.userBId || null;
	const loserId = didWin ? contest.userBId : parsed.userId;

	if (winnerId) {
		const winner = await db
			.select()
			.from(users)
			.where(eq(users.id, winnerId))
			.limit(1)
			.then((rows) => rows[0] ?? null);
		if (winner) {
			await db
				.update(users)
				.set({ xpTotal: (winner.xpTotal ?? 0) + 250 })
				.where(eq(users.id, winnerId));
		}
	}

	if (loserId) {
		const loser = await db
			.select()
			.from(users)
			.where(eq(users.id, loserId))
			.limit(1)
			.then((rows) => rows[0] ?? null);
		if (loser) {
			await db
				.update(users)
				.set({ xpTotal: (loser.xpTotal ?? 0) + 60 })
				.where(eq(users.id, loserId));
		}
	}

	// Reset matchmaking status for both players
	if (contest.userBId) {
		await db.update(users).set({ matchmakingStatus: 'idle' }).where(eq(users.id, parsed.userId));
		await db.update(users).set({ matchmakingStatus: 'idle' }).where(eq(users.id, contest.userBId));
	}

	// Update league standings if both users are in the same league
	if (contest.userBId) {
		const winnerIdForLeague = didWin ? parsed.userId : contest.userBId;
		const loserIdForLeague = didWin ? contest.userBId : parsed.userId;

		// Find leagues where both winner and loser are members
		const winnerLeagues = await db
			.select({ leagueId: leagueMembers.leagueId })
			.from(leagueMembers)
			.where(eq(leagueMembers.userId, winnerIdForLeague));

		for (const { leagueId } of winnerLeagues) {
			if (!loserIdForLeague || !leagueId) continue;

			// Update winner's record
			const winnerMember = await db
				.select()
				.from(leagueMembers)
				.where(
					and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, winnerIdForLeague))
				)
				.limit(1)
				.then((rows) => rows[0] ?? null);

			if (winnerMember) {
				await db
					.update(leagueMembers)
					.set({
						wins: (winnerMember.wins ?? 0) + 1,
						points: (winnerMember.points ?? 0) + 3
					})
					.where(eq(leagueMembers.id, winnerMember.id));
			}

			// Update loser's record
			const loserMember = await db
				.select()
				.from(leagueMembers)
				.where(
					and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, loserIdForLeague))
				)
				.limit(1)
				.then((rows) => rows[0] ?? null);

			if (loserMember) {
				await db
					.update(leagueMembers)
					.set({ losses: (loserMember.losses ?? 0) + 1 })
					.where(eq(leagueMembers.id, loserMember.id));
			}
		}
	}

	return json({
		contestId,
		status: didWin ? 'YOU WON' : 'YOU LOST',
		xp: didWin ? 250 : 60,
		yourScore: Number(myTotal.toFixed(0)),
		opponentScore: Number(opponentTotal.toFixed(0)),
		breakdown: scoredPicks
	});
}
