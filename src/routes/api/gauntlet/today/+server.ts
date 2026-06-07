import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { gauntletQuestions, gauntletAttempts } from '$lib/server/schema';
import { eq, and, sql } from 'drizzle-orm';
import { parseSessionToken } from '$lib/server/auth';

export async function GET({ cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const today = new Date().toISOString().split('T')[0];

	const question = await db
		.select()
		.from(gauntletQuestions)
		.where(eq(gauntletQuestions.activeDate, sql`${today}::date`))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (!question) {
		return json({ error: 'No question for today' }, { status: 404 });
	}

	const attempt = await db
		.select()
		.from(gauntletAttempts)
		.where(
			and(eq(gauntletAttempts.userId, parsed.userId), eq(gauntletAttempts.questionId, question.id))
		)
		.limit(1)
		.then((rows) => rows[0] ?? null);

	return json({
		id: question.id,
		question: question.question,
		options: question.options,
		sector: question.sector,
		xpReward: question.xpReward,
		boostSector: question.boostSector,
		alreadyAnswered: !!attempt,
		previousAnswer: attempt?.answer ?? null,
		wasCorrect: attempt?.correct ?? null
	});
}
