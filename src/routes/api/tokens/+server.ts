import { getTokensWithPrices } from '$lib/server/sosovalue';
import { json } from '@sveltejs/kit';

export async function GET() {
	try {
		const data = await getTokensWithPrices(30);
		return json(data);
	} catch (error) {
		console.error('Error fetching tokens:', error);
		return json({ error: 'Failed to fetch tokens' }, { status: 500 });
	}
}
