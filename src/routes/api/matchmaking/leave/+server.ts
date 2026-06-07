import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { parseSessionToken } from '$lib/server/auth';

import { queue } from '$lib/server/matchmaking';

export async function POST({ cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	queue.delete(parsed.userId);
	await db.update(users).set({ matchmakingStatus: 'idle' }).where(eq(users.id, parsed.userId));

	return json({ ok: true });
}
