import { env } from '$env/dynamic/private';
import { getSnapshot } from './sosovalue';

// SoDEX is built by SoSoValue and likely uses the same API key
const SODEX_BASE_URL = 'https://openapi.sosovalue.com/openapi/v1';

async function fetchSodexPrice(symbol: string): Promise<number | null> {
	try {
		const res = await fetch(`${SODEX_BASE_URL}/sodex/price?symbol=${encodeURIComponent(symbol)}`, {
			headers: { 'x-soso-api-key': env.SOSOVALUE_API_KEY || '' }
		});
		if (!res.ok) return null;
		const data = await res.json();
		const price = Number(data?.price ?? data?.data?.price ?? null);
		return Number.isFinite(price) && price > 0 ? price : null;
	} catch {
		return null;
	}
}

export async function getSodexPrice(symbol: string, currencyId?: string): Promise<number> {
	const sodexPrice = await fetchSodexPrice(symbol);
	if (sodexPrice) return sodexPrice;

	if (currencyId) {
		const snapshot = await getSnapshot(currencyId).catch(() => null);
		if (snapshot && typeof snapshot === 'object') {
			const s = snapshot as Record<string, unknown>;
			const candidates = [
				s?.price,
				s?.current_price,
				s?.close,
				s?.last_price,
				s?.usd_price,
				s?.priceUsd,
				s?.price_usd,
				s?.latestPrice
			];
			for (const value of candidates) {
				const n = Number(value);
				if (Number.isFinite(n) && n > 0) return n;
			}
		}
	}

	return 0;
}
