import { db } from '$lib/server/db';
import { gauntletQuestions } from '$lib/server/schema';
import { eq, sql } from 'drizzle-orm';

const SEED_QUESTIONS = [
	{
		question: 'Which sector is typically considered the "blue chip" layer of crypto?',
		options: [
			{ label: 'Layer 1 (L1)', value: 'l1' },
			{ label: 'Layer 2 (L2)', value: 'l2' },
			{ label: 'DeFi', value: 'defi' },
			{ label: 'Meme', value: 'meme' }
		],
		correctAnswer: 'l1',
		sector: 'l1',
		xpReward: 50,
		boostSector: 'l1'
	},
	{
		question: 'What does TVL stand for in DeFi?',
		options: [
			{ label: 'Total Volume Locked', value: 'total_volume_locked' },
			{ label: 'Total Value Locked', value: 'total_value_locked' },
			{ label: 'Token Velocity Level', value: 'token_velocity_level' },
			{ label: 'Transaction Volume Limit', value: 'transaction_volume_limit' }
		],
		correctAnswer: 'total_value_locked',
		sector: 'defi',
		xpReward: 50,
		boostSector: 'defi'
	},
	{
		question: 'Which of these is a Layer 2 scaling solution for Ethereum?',
		options: [
			{ label: 'Bitcoin', value: 'bitcoin' },
			{ label: 'Solana', value: 'solana' },
			{ label: 'Base', value: 'base' },
			{ label: 'Cardano', value: 'cardano' }
		],
		correctAnswer: 'base',
		sector: 'l2',
		xpReward: 50,
		boostSector: 'l2'
	},
	{
		question: 'What metric best measures short-term market sentiment for a token?',
		options: [
			{ label: 'Market Cap', value: 'market_cap' },
			{ label: '24h Price Change %', value: '24h_change' },
			{ label: 'Total Supply', value: 'total_supply' },
			{ label: 'Founder Twitter Followers', value: 'twitter_followers' }
		],
		correctAnswer: '24h_change',
		sector: 'wildcard',
		xpReward: 50,
		boostSector: 'wildcard'
	},
	{
		question: 'In CoinDraft scoring, what determines your pick score?',
		options: [
			{ label: "The token's market cap rank", value: 'mcap_rank' },
			{ label: 'Price change from entry to exit', value: 'price_change' },
			{ label: 'How many people picked the same token', value: 'popularity' },
			{ label: 'Random dice roll', value: 'random' }
		],
		correctAnswer: 'price_change',
		sector: 'wildcard',
		xpReward: 75,
		boostSector: 'wildcard'
	}
];

// Deterministic per-day pick so every instance seeds the same question for a given date
function pickForDate(dateStr: string) {
	let hash = 0;
	for (let i = 0; i < dateStr.length; i++) {
		hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
	}
	return SEED_QUESTIONS[hash % SEED_QUESTIONS.length];
}

/** Ensures today's Gauntlet question exists. Safe to call repeatedly (idempotent per day). */
export async function ensureTodaySeeded(today = new Date().toISOString().split('T')[0]) {
	const existing = await db
		.select()
		.from(gauntletQuestions)
		.where(eq(gauntletQuestions.activeDate, sql`${today}::date`))
		.limit(1);

	if (existing.length > 0) return existing[0];

	const q = pickForDate(today);
	const [inserted] = await db
		.insert(gauntletQuestions)
		.values({
			...q,
			activeDate: sql`${today}::date`,
			options: JSON.stringify(q.options)
		})
		.returning();

	return inserted;
}
