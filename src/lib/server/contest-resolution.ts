import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { contests, lineups, lineupPicks, users, leagueMembers } from '$lib/server/schema';
import { getSnapshot, extractPrice } from '$lib/server/sosovalue';
import { calcPickScore } from '$lib/server/scoring';

async function scoreLineupPicks(lineupId: string) {
	const picks = await db.select().from(lineupPicks).where(eq(lineupPicks.lineupId, lineupId));
	const snapshots = await Promise.all(picks.map((p) => getSnapshot(p.currencyId).catch(() => null)));

	let total = 0;
	for (let i = 0; i < picks.length; i++) {
		const pick = picks[i];
		const exitPrice = extractPrice(snapshots[i]);
		const entry = Number(pick.entryPrice ?? 0);
		const pct = entry > 0 ? ((exitPrice - entry) / entry) * 100 : 0;
		const score = calcPickScore(entry || 1, exitPrice || entry || 1);

		await db
			.update(lineupPicks)
			.set({ exitPrice: String(exitPrice), pctChange: String(pct), score: String(score) })
			.where(eq(lineupPicks.id, pick.id));

		total += score;
	}
	return total;
}

/**
 * Resolves a live contest: scores both lineups, picks a winner, awards XP,
 * updates league standings, and marks the contest resolved. Idempotent —
 * no-ops if the contest isn't live or the userB lineup hasn't been submitted yet.
 * Independent of any requesting user, so it can run from a cron sweep.
 */
export async function resolveContest(
	contestId: string
): Promise<{ resolved: boolean; reason?: string }> {
	const contest = await db
		.select()
		.from(contests)
		.where(eq(contests.id, contestId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (!contest) return { resolved: false, reason: 'not_found' };
	if (contest.status !== 'live') return { resolved: false, reason: `status_${contest.status}` };
	if (!contest.userAId) return { resolved: false, reason: 'missing_user_a' };

	const lineupA = await db
		.select()
		.from(lineups)
		.where(and(eq(lineups.contestId, contestId), eq(lineups.userId, contest.userAId)))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (!lineupA) return { resolved: false, reason: 'missing_lineup_a' };

	const scoreA = await scoreLineupPicks(lineupA.id);
	await db.update(lineups).set({ finalScore: String(scoreA) }).where(eq(lineups.id, lineupA.id));

	let scoreB = 0;
	let didAWin = false;

	if (contest.userBId) {
		const lineupB = await db
			.select()
			.from(lineups)
			.where(and(eq(lineups.contestId, contestId), eq(lineups.userId, contest.userBId)))
			.limit(1)
			.then((rows) => rows[0] ?? null);

		if (!lineupB) return { resolved: false, reason: 'missing_lineup_b' };

		scoreB = await scoreLineupPicks(lineupB.id);
		await db.update(lineups).set({ finalScore: String(scoreB) }).where(eq(lineups.id, lineupB.id));

		didAWin = scoreA >= scoreB;
	} else {
		// Bot opponent
		scoreB = Math.max(0, scoreA - 120 + Math.random() * 220);
		didAWin = scoreA >= scoreB;
	}

	const winnerId = didAWin ? contest.userAId : contest.userBId || null;
	const loserId = didAWin ? contest.userBId : contest.userAId;
	const xpMultiplier = contest.type === 'weekly' ? 2 : 1;

	await db
		.update(contests)
		.set({ status: 'resolved', winnerId, endAt: new Date() })
		.where(eq(contests.id, contestId));

	if (winnerId) {
		const winner = await db
			.select()
			.from(users)
			.where(eq(users.id, winnerId))
			.limit(1)
			.then((rows) => rows[0] ?? null);
		if (winner) {
			// Paper (practice) contests earn practice XP only — no real XP, no streak impact
			await db
				.update(users)
				.set(
					contest.isPaper
						? { paperXpTotal: (winner.paperXpTotal ?? 0) + 250 * xpMultiplier }
						: {
								xpTotal: (winner.xpTotal ?? 0) + 250 * xpMultiplier,
								streak: (winner.streak ?? 0) + 1
							}
				)
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
				.set(
					contest.isPaper
						? { paperXpTotal: (loser.paperXpTotal ?? 0) + 60 * xpMultiplier }
						: { xpTotal: (loser.xpTotal ?? 0) + 60 * xpMultiplier, streak: 0 }
				)
				.where(eq(users.id, loserId));
		}
	}

	if (contest.userBId) {
		await db
			.update(users)
			.set({ matchmakingStatus: 'idle' })
			.where(eq(users.id, contest.userAId));
		await db
			.update(users)
			.set({ matchmakingStatus: 'idle' })
			.where(eq(users.id, contest.userBId));

		if (loserId) {
			const winnerLeagues = await db
				.select({ leagueId: leagueMembers.leagueId })
				.from(leagueMembers)
				.where(eq(leagueMembers.userId, winnerId!));

			for (const { leagueId } of winnerLeagues) {
				if (!leagueId) continue;

				const winnerMember = await db
					.select()
					.from(leagueMembers)
					.where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, winnerId!)))
					.limit(1)
					.then((rows) => rows[0] ?? null);

				if (winnerMember) {
					await db
						.update(leagueMembers)
						.set({ wins: (winnerMember.wins ?? 0) + 1, points: (winnerMember.points ?? 0) + 3 })
						.where(eq(leagueMembers.id, winnerMember.id));
				}

				const loserMember = await db
					.select()
					.from(leagueMembers)
					.where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, loserId)))
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
	}

	return { resolved: true };
}
