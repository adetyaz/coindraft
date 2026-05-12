import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { contests } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { parseSessionToken } from '$lib/server/auth';

export async function GET({ cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) {
		return json([]);
	}

	const userContests = await db.select().from(contests).where(eq(contests.userAId, parsed.userId));

	return json(userContests);
}

export async function POST({ request, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const { type } = body;

	// Option A: reuse any open or live contest the user already has
	const existing = await db
		.select()
		.from(contests)
		.where(eq(contests.userAId, parsed.userId))
		.then((rows) => rows.find((c) => c.status === 'open' || c.status === 'live') ?? null);

	if (existing) {
		return json(existing);
	}

	// No active contest — create one
	const [newContest] = await db
		.insert(contests)
		.values({
			userAId: parsed.userId,
			userBId: null,
			type: type || 'daily',
			status: 'open'
		})
		.returning();

	return json(newContest);
}
