// Wave 1 Scoring Rules:
// - Simple % change scoring
// - 5 slots, equal weight
// - Winner: whoever has highest total score at end_at time

export interface PickScore {
	pctChange: number;
	score: number;
}

/**
 * Calculate score for a single pick based on % change
 * Wave 1: simple linear scoring
 *   -50% = 0 points
 *   0% = 50 points
 *   +100% = 150 points
 */
export function calcPickScore(entryPrice: number, currentPrice: number): number {
	const pctChange = ((currentPrice - entryPrice) / entryPrice) * 100;
	// Clamp between -100% and +200%
	const clamped = Math.max(-100, Math.min(200, pctChange));
	// 50 + (clamped / 2) = linear scale
	return Math.max(0, 50 + clamped / 2);
}

/**
 * Determine winner between two lineups
 */
export function determineWinner(scoreA: number, scoreB: number): 'a' | 'b' | 'tie' {
	if (scoreA > scoreB) return 'a';
	if (scoreB > scoreA) return 'b';
	return 'tie';
}

export function calcLineupScore(picks: { score: number | string }[]): number {
	return picks.reduce((sum, p) => sum + Number(p.score), 0);
}

export function detectEtfStreaks(
	history: Array<{ netFlow?: number; net_inflow?: number; date?: string }>
) {
	if (!Array.isArray(history) || history.length < 2) return [];

	const alerts = [];
	let streak = 1;
	let streakType = '';

	for (let i = 1; i < history.length; i++) {
		const prev = history[i - 1] ?? {};
		const curr = history[i] ?? {};

		const prevFlow = Number(prev.net_inflow);
		const currFlow = Number(curr.net_inflow);
		if (!Number.isFinite(prevFlow) || !Number.isFinite(currFlow)) {
			streak = 1;
			streakType = '';
			continue;
		}

		const bothOut = prevFlow < 0 && currFlow < 0;
		const bothIn = prevFlow > 0 && currFlow > 0;

		if (bothOut || bothIn) {
			streak++;
			streakType = currFlow < 0 ? 'outflow' : 'inflow';
		} else {
			streak = 1;
			streakType = '';
		}

		if (streak >= 3 && streakType) {
			alerts.push({
				type: streakType,
				streak,
				amount: Math.abs(currFlow),
				date: curr.date ?? null
			});
		}
	}

	return alerts.slice(-3);
}
