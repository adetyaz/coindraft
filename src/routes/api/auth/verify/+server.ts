import { json } from '@sveltejs/kit';
import { SiweMessage } from 'siwe';
import { db } from '$lib/server/db';
import { users } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { SESSION_SECRET } from '$env/static/private';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { createSessionToken } from '$lib/server/auth';

export async function POST({ request, cookies }) {
	const body = await request.json();
	const { type, message, signature, address } = body;
	// type: 'evm' | 'solana'

	const nonce = cookies.get('siwe_nonce');
	if (!nonce) return json({ error: 'Nonce expired — try again' }, { status: 400 });

	let verifiedAddress: string | null = null;

	if (type === 'evm') {
		// ── EVM: verify SIWE message ──────────────────────────────────────────
		try {
			const siweMessage = new SiweMessage(message);
			const result = await siweMessage.verify({ signature, nonce });
			if (!result.success) throw new Error('Invalid signature');
			verifiedAddress = siweMessage.address.toLowerCase();
		} catch {
			return json({ error: 'EVM signature verification failed' }, { status: 401 });
		}
	} else if (type === 'solana') {
		// ── Solana: verify ed25519 signature ─────────────────────────────────
		try {
			const messageBytes = new TextEncoder().encode(message);
			const signatureBytes = bs58.decode(signature);
			const publicKeyBytes = bs58.decode(address);
			const valid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
			if (!valid) throw new Error('Invalid signature');
			verifiedAddress = address;
		} catch {
			return json({ error: 'Solana signature verification failed' }, { status: 401 });
		}
	} else {
		return json({ error: 'Unknown chain type' }, { status: 400 });
	}

	// Ensure we have a verified address
	if (!verifiedAddress) {
		return json({ error: 'Verification failed' }, { status: 401 });
	}

	// ── Upsert user by wallet address ──────────────────────────────────────
	let user = await db
		.select()
		.from(users)
		.where(eq(users.walletAddress, verifiedAddress))
		.limit(1)
		.then((r) => r[0] ?? null);

	if (!user) {
		// First time — create user record
		const [newUser] = await db
			.insert(users)
			.values({
				walletAddress: verifiedAddress,
				username: `player_${verifiedAddress.slice(2, 8)}`, // default username
				chainType: type
			})
			.returning();
		user = newUser;
	}

	// ── Create session cookie ───────────────────────────────────────────────
	const token = createSessionToken(user.id);
	cookies.delete('siwe_nonce', { path: '/' });
	cookies.set('session', token, {
		path: '/',
		httpOnly: true,
		maxAge: 60 * 60 * 24 * 7, // 7 days
		sameSite: 'strict'
	});

	return json({
		ok: true,
		user: { id: user.id, username: user.username, walletAddress: user.walletAddress }
	});
}
