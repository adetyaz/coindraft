import { SESSION_SECRET } from '$env/static/private';
import { db } from './db';
import { users } from './schema';
import { eq } from 'drizzle-orm';

export interface SessionPayload {
	userId: string;
	ts: number;
}

export function createSessionToken(userId: string): string {
	const payload: SessionPayload = { userId, ts: Date.now() };
	const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64');
	const sig = Buffer.from(`${payloadStr}${SESSION_SECRET}`).toString('base64').slice(0, 16);
	return `${payloadStr}.${sig}`;
}

export function parseSessionToken(token: string): SessionPayload | null {
	try {
		const [payloadStr, sig] = token.split('.');
		const expectedSig = Buffer.from(`${payloadStr}${SESSION_SECRET}`)
			.toString('base64')
			.slice(0, 16);
		if (sig !== expectedSig) return null;
		const payload = JSON.parse(Buffer.from(payloadStr, 'base64').toString());
		return payload as SessionPayload;
	} catch {
		return null;
	}
}

export async function getUserById(id: string) {
	const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
	return user ?? null;
}

export async function getUserByWalletAddress(address: string) {
	const [user] = await db.select().from(users).where(eq(users.walletAddress, address)).limit(1);
	return user ?? null;
}
