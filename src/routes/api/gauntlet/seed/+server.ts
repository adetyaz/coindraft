import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { ensureTodaySeeded } from '$lib/server/gauntlet';

async function seed(authHeader: string | null) {
	if (env.CRON_SECRET && authHeader !== `Bearer ${env.CRON_SECRET}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const today = new Date().toISOString().split('T')[0];
	const question = await ensureTodaySeeded(today);
	return json({ message: `Question ready for ${today}`, questionId: question.id });
}

// Vercel Cron Jobs send GET requests
export async function GET({ request }) {
	return seed(request.headers.get('authorization'));
}

// Kept for manual/local triggering
export async function POST({ request }) {
	return seed(request.headers.get('authorization'));
}
