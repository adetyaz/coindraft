import { SOSOVALUE_API_KEY, SOSOVALUE_BASE_URL } from '$env/static/private';

// Simple in-memory cache (replace with Redis if scaling)
const cache = new Map<string, { data: unknown; expires: number }>();

export async function ssv<T>(
	path: string,
	ttlSeconds: number,
	params?: Record<string, string>
): Promise<T> {
	const url = new URL(SOSOVALUE_BASE_URL + path);
	if (params) {
		Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
	}
	const cacheKey = url.toString();

	// Cache hit
	const hit = cache.get(cacheKey);
	if (hit && hit.expires > Date.now()) {
		return hit.data as T;
	}

	// Fetch with retry on 429
	let attempts = 0;
	while (attempts < 3) {
		const res = await fetch(url.toString(), {
			headers: {
				'x-soso-api-key': SOSOVALUE_API_KEY,
				'Content-Type': 'application/json'
			}
		});

		if (res.status === 429) {
			const body = await res.json();
			const wait = (body.details?.retry_after ?? 60) * 1000;
			await new Promise((r) => setTimeout(r, wait));
			attempts++;
			continue;
		}

		if (!res.ok) {
			const errorBody = await res.text().catch(() => '');
			console.error(`SSV API Error ${res.status} on ${url}:`, errorBody);
			throw new Error(`SSV ${res.status}: ${path} (${errorBody})`);
		}

		const json = await res.json();
		if (json.code !== 0) {
			throw new Error(`SSV error: ${json.message}`);
		}

		// Store in cache
		cache.set(cacheKey, { data: json.data, expires: Date.now() + ttlSeconds * 1000 });
		return json.data as T;
	}

	throw new Error(`SSV rate limit: giving up after 3 attempts on ${path}`);
}

// Named helpers — import these everywhere
export const getTokens = () => ssv('/currencies', 86400); // 24h
export const getSectors = () => ssv('/currencies/sector-spotlight', 300); // 5min
export const getEtfHistory = (symbol: string) => ssv('/etfs/summary-history', 300, { symbol }); // 5min
export const getNews = () => ssv('/news/featured', 900); // 15min
export const getSnapshot = (id: string) => ssv(`/currencies/${id}/market-snapshot`, 60); // 60s

// Merged token list with live price/change data
// Cached separately for 2 minutes so we don't re-merge on every request
export type TokenWithPrice = {
	currency_id: string;
	symbol?: string;
	name?: string;
	price: number | null;
	change24h: number | null;
	volume24h: number | null;
	rank: number | null;
};

type RawToken = { currency_id: string; symbol?: string; name?: string };
type RawSnapshot = {
	price?: number;
	change_pct_24h?: number;
	turnover_24h?: number;
	marketcap_rank?: number;
};

export async function getTokensWithPrices(limit = 30): Promise<TokenWithPrice[]> {
	const cacheKey = `__tokens_prices_${limit}`;
	const hit = cache.get(cacheKey);
	if (hit && hit.expires > Date.now()) return hit.data as TokenWithPrice[];

	const rawTokens = (await getTokens()) as RawToken[];
	const top = rawTokens.slice(0, limit);

	// Fetch all snapshots in parallel — failures are graceful (null price data)
	const results = await Promise.allSettled(
		top.map((t) => getSnapshot(t.currency_id) as Promise<RawSnapshot>)
	);

	const merged: TokenWithPrice[] = top.map((t, i) => {
		const r = results[i];
		const snap: RawSnapshot | null = r.status === 'fulfilled' ? r.value : null;
		return {
			currency_id: t.currency_id,
			symbol: t.symbol,
			name: t.name,
			price: snap?.price ?? null,
			change24h:
				snap?.change_pct_24h != null ? Number((snap.change_pct_24h * 100).toFixed(2)) : null,
			volume24h: snap?.turnover_24h ?? null,
			rank: snap?.marketcap_rank ?? null
		};
	});

	// Cache merged result for 2 minutes
	cache.set(cacheKey, { data: merged, expires: Date.now() + 120_000 });
	return merged;
}
