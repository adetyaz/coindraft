import { json } from '@sveltejs/kit';

export async function POST() {
	return json({ error: 'Signup via wallet only. Use Reown AppKit.' }, { status: 400 });
}
