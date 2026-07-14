import { db } from '$lib/server/db';
import { gauntletQuestions } from '$lib/server/schema';
import { eq, sql } from 'drizzle-orm';

// Fallback bank — used only if live data is unavailable when a day needs seeding
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

type QuestionInput = {
	question: string;
	options: { label: string; value: string }[];
	correctAnswer: string;
	sector: string;
	xpReward: number;
	boostSector: string;
};

function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

// Deterministic per-day fallback pick so every instance seeds the same question
// for a given date if live-data generation isn't available.
function pickForDate(dateStr: string) {
	let hash = 0;
	for (let i = 0; i < dateStr.length; i++) {
		hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
	}
	return SEED_QUESTIONS[hash % SEED_QUESTIONS.length];
}

type SvelteFetch = (input: string) => Promise<Response>;

/**
 * Generates a question from today's real market data instead of a static
 * bank — picks a random template, fills it with live token/sector numbers,
 * and derives the correct answer procedurally (no LLM), so there's no
 * hallucination or parsing-failure risk. Returns null if live data isn't
 * available, so the caller can fall back to the static bank.
 */
async function generateLiveQuestion(fetchFn: SvelteFetch): Promise<QuestionInput | null> {
	try {
		const [tokensRes, sectorsRes] = await Promise.all([
			fetchFn('/api/tokens'),
			fetchFn('/api/sectors')
		]);
		if (!tokensRes.ok) return null;

		const tokens: Array<{ symbol?: string; change24h: number | null; price: number | null }> =
			await tokensRes.json();
		const validTokens = tokens.filter((t) => t.symbol && t.change24h != null);
		if (validTokens.length < 4) return null;

		const sectors: Array<{ id: string; name: string; change: number | null }> = sectorsRes.ok
			? await sectorsRes.json()
			: [];
		const validSectors = sectors.filter((s) => s.change != null);

		const templates: Array<() => QuestionInput | null> = [
			() => {
				const sample = shuffle(validTokens).slice(0, 4);
				const best = sample.reduce((a, b) => ((a.change24h ?? -Infinity) >= (b.change24h ?? -Infinity) ? a : b));
				return {
					question: "Which of these tokens has the best 24h performance right now?",
					options: sample.map((t) => ({
						label: (t.symbol ?? '').toUpperCase(),
						value: (t.symbol ?? '').toUpperCase()
					})),
					correctAnswer: (best.symbol ?? '').toUpperCase(),
					sector: 'wildcard',
					xpReward: 50,
					boostSector: 'wildcard'
				};
			},
			() => {
				const sample = shuffle(validTokens).slice(0, 4);
				const highest = sample.reduce((a, b) => ((a.price ?? -Infinity) >= (b.price ?? -Infinity) ? a : b));
				return {
					question: 'Which of these tokens is trading at the highest price right now?',
					options: sample.map((t) => ({
						label: (t.symbol ?? '').toUpperCase(),
						value: (t.symbol ?? '').toUpperCase()
					})),
					correctAnswer: (highest.symbol ?? '').toUpperCase(),
					sector: 'wildcard',
					xpReward: 50,
					boostSector: 'wildcard'
				};
			},
			() => {
				if (validSectors.length < 4) return null;
				const sample = shuffle(validSectors).slice(0, 4);
				const leader = sample.reduce((a, b) => ((a.change ?? -Infinity) >= (b.change ?? -Infinity) ? a : b));
				return {
					question: 'Which sector is leading today by 24h performance?',
					options: sample.map((s) => ({ label: s.name, value: s.id })),
					correctAnswer: leader.id,
					sector: leader.id,
					xpReward: 50,
					boostSector: leader.id
				};
			}
		];

		for (const t of shuffle(templates)) {
			const q = t();
			if (q) return q;
		}
		return null;
	} catch {
		return null;
	}
}

/** Ensures today's Gauntlet question exists. Safe to call repeatedly (idempotent per day). */
export async function ensureTodaySeeded(
	today = new Date().toISOString().split('T')[0],
	fetchFn?: SvelteFetch
) {
	const existing = await db
		.select()
		.from(gauntletQuestions)
		.where(eq(gauntletQuestions.activeDate, sql`${today}::date`))
		.limit(1);

	if (existing.length > 0) return existing[0];

	const q = (fetchFn ? await generateLiveQuestion(fetchFn) : null) ?? pickForDate(today);
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
