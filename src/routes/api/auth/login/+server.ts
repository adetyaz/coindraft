import { json } from '@sveltejs/kit';

export async function POST() {
	return json({ error: 'Login via wallet only. Use Reown AppKit.' }, { status: 400 });
}
