import { getNews } from '$lib/server/sosovalue';
import { json } from '@sveltejs/kit';

export async function GET() {
	try {
		const data = await getNews();
		return json(data);
	} catch (error) {
		console.error('Error fetching news:', error);
		return json({ error: 'Failed to fetch news' }, { status: 500 });
	}
}
