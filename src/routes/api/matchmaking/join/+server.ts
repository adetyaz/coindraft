import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, contests } from '$lib/server/schema';
import { eq, and, or } from 'drizzle-orm';
import { parseSessionToken } from '$lib/server/auth';

import { queue } from '$lib/server/matchmaking';

const QUEUE_TIMEOUT_MS = 30_000; // 30s timeout -> fallback to bot

export async function POST({ request, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json().catch(() => ({}));
	const contestType = body.type || 'daily';

	// Check if user already in a live contest
	const existing = await db
		.select()
		.from(contests)
		.where(
			and(
				eq(contests.status, 'live'),
				or(eq(contests.userAId, parsed.userId), eq(contests.userBId, parsed.userId))
			)
		)
		.then((rows) => rows[0] ?? null);

	if (existing) {
		return json({
			status: 'matched',
			contestId: existing.id,
			opponentId: existing.userAId === parsed.userId ? existing.userBId : existing.userAId
		});
	}

	// Try to find an opponent in the queue
	const now = Date.now();
	let opponentId: string | null = null;

	for (const [queuedUserId, data] of queue.entries()) {
		if (queuedUserId === parsed.userId) continue;
		if (data.contestType !== contestType) continue;
		if (now - data.queuedAt > QUEUE_TIMEOUT_MS) {
			queue.delete(queuedUserId);
			continue;
		}
		opponentId = queuedUserId;
		break;
	}

	if (opponentId) {
		queue.delete(opponentId);

		const [newContest] = await db
			.insert(contests)
			.values({
				userAId: parsed.userId,
				userBId: opponentId,
				type: contestType,
				status: 'open'
			})
			.returning();

		await db
			.update(users)
			.set({ matchmakingStatus: 'in_contest' })
			.where(eq(users.id, parsed.userId));
		await db.update(users).set({ matchmakingStatus: 'in_contest' }).where(eq(users.id, opponentId));

		return json({ status: 'matched', contestId: newContest.id, opponentId });
	}

	queue.set(parsed.userId, { queuedAt: now, contestType });
	await db.update(users).set({ matchmakingStatus: 'queued' }).where(eq(users.id, parsed.userId));

	return json({ status: 'waiting', message: 'Looking for an opponent...' });
}
