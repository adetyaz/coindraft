// Heuristic sector classifier for news/content that only has a token symbol,
// not an intrinsic sector (CoinDraft's sectors are draft-slot labels, not a
// property tokens carry — there's no canonical token->sector mapping anywhere
// else in the app, so this is a best-effort bucket for browsing, not scoring).

const SECTOR_SYMBOLS: Record<string, string[]> = {
	l1: ['BTC', 'ETH', 'SOL', 'ADA', 'AVAX', 'DOT', 'ATOM', 'NEAR', 'APT', 'SUI', 'TON', 'BNB'],
	l2: ['ARB', 'OP', 'MATIC', 'POL', 'BASE', 'STRK', 'ZK', 'MNT', 'METIS'],
	defi: ['UNI', 'AAVE', 'LDO', 'MKR', 'CRV', 'COMP', 'SNX', 'GMX', 'PENDLE', 'STETH'],
	meme: ['DOGE', 'SHIB', 'PEPE', 'WIF', 'BONK', 'FLOKI', 'MEME']
};

const SYMBOL_TO_SECTOR = new Map<string, string>();
for (const [sector, symbols] of Object.entries(SECTOR_SYMBOLS)) {
	for (const s of symbols) SYMBOL_TO_SECTOR.set(s, sector);
}

/** Classifies a set of token symbols into one of the 5 draft sectors, wildcard if unrecognized. */
export function classifySector(symbols: string[]): string {
	for (const s of symbols) {
		const hit = SYMBOL_TO_SECTOR.get(s.toUpperCase());
		if (hit) return hit;
	}
	return 'wildcard';
}
