import { json } from '@sveltejs/kit';
import { getSodexPrice } from '$lib/server/sodex';

export async function GET({ url }) {
	const symbol = url.searchParams.get('symbol');
	if (!symbol) return json({ error: 'Symbol required' }, { status: 400 });

	const price = await getSodexPrice(symbol);
	if (price > 0) {
		return json({ source: 'sodex', symbol, price });
	}

	return json({
		source: 'sodex',
		symbol,
		price: null,
		fallback: 'Use /api/snapshot/[id] for SoSoValue fallback'
	});
}
