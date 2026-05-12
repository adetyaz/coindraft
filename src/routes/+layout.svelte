<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { appKit } from '$lib/appkit';
	import favicon from '$lib/assets/images/logo_v4_appicon.svg';
	import navLogo from '$lib/assets/images/logo_v5_navbar.svg';
	import { SiweMessage } from 'siwe';
	import bs58 from 'bs58';

	let { children, data } = $props();
	const appkitReady = Boolean(appKit);
	let authInFlight = $state(false);
	let lastAttemptedWallet = '';
	let walletConnected = $state(false);
	let signError = $state(false);

	type MaybeEthereum = {
		request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
	};

	type MaybeSolana = {
		isConnected?: boolean;
		publicKey?: { toBase58: () => string };
		signMessage?: (
			message: Uint8Array,
			display?: string
		) => Promise<{ signature: Uint8Array } | Uint8Array>;
	};

	type WalletCandidate =
		| { type: 'evm'; address: string; provider: MaybeEthereum }
		| { type: 'solana'; address: string; provider: MaybeSolana };

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		window.location.href = '/';
	}

	function getAppKitProvider(): WalletCandidate | null {
		if (!appKit) return null;

		const account = appKit.getAccount?.();
		if (!account?.address) return null;

		// Use AppKit's own authorized provider — not window.ethereum/window.solana
		const walletProvider = appKit.getWalletProvider?.() as unknown;

		const w = window as Window & {
			ethereum?: MaybeEthereum;
			solana?: MaybeSolana;
		};

		// Solana
		if (account.type === 'solana') {
			const sol = (walletProvider as MaybeSolana)?.signMessage
				? (walletProvider as MaybeSolana)
				: w.solana;
			if (sol?.signMessage) {
				console.log('[Auth] Found Solana wallet (AppKit):', account.address);
				return { type: 'solana', address: account.address, provider: sol };
			}
			return null;
		}

		// EVM — prefer AppKit's authorized provider, fall back to window.ethereum
		const evm = (walletProvider as MaybeEthereum)?.request
			? (walletProvider as MaybeEthereum)
			: w.ethereum;
		if (evm?.request) {
			console.log('[Auth] Found EVM wallet (AppKit):', account.address);
			return { type: 'evm', address: account.address, provider: evm };
		}

		return null;
	}

	async function signAndVerifyEvm(address: string, provider: MaybeEthereum): Promise<boolean> {
		const nonceRes = await fetch('/api/auth/nonce');
		if (!nonceRes.ok) return false;
		const { nonce } = await nonceRes.json();

		// Get chain ID from AppKit — avoids needing eth_chainId authorization on window.ethereum
		const appKitChain = appKit?.getChainId?.();
		const chainId = typeof appKitChain === 'number' ? appKitChain : 1;

		const siwe = new SiweMessage({
			domain: window.location.host,
			address,
			statement: 'Sign in to CoinDraft',
			uri: window.location.origin,
			version: '1',
			chainId,
			nonce
		});

		const message = siwe.prepareMessage();
		const signature = (await provider.request({
			method: 'personal_sign',
			params: [message, address]
		})) as string;

		const verifyRes = await fetch('/api/auth/verify', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'evm', address, message, signature })
		});

		return verifyRes.ok;
	}

	async function signAndVerifySolana(address: string, provider: MaybeSolana): Promise<boolean> {
		if (!provider.signMessage) return false;

		const nonceRes = await fetch('/api/auth/nonce');
		if (!nonceRes.ok) return false;
		const { nonce } = await nonceRes.json();

		const message = `CoinDraft Sign-In\nAddress: ${address}\nNonce: ${nonce}\nURI: ${window.location.origin}`;
		const encoded = new TextEncoder().encode(message);
		const signed = await provider.signMessage(encoded, 'utf8');
		const signatureBytes = signed instanceof Uint8Array ? signed : signed.signature;
		const signature = bs58.encode(signatureBytes);

		const verifyRes = await fetch('/api/auth/verify', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'solana', address, message, signature })
		});

		return verifyRes.ok;
	}

	async function ensureWalletSession() {
		if (data.user || authInFlight) return;

		const wallet = getAppKitProvider();
		if (!wallet) {
			console.log('[Auth] No wallet detected');
			return;
		}

		const walletKey = `${wallet.type}:${wallet.address}`;
		if (lastAttemptedWallet === walletKey) {
			console.log('[Auth] Already attempted wallet:', walletKey);
			return;
		}

		authInFlight = true;
		lastAttemptedWallet = walletKey;
		console.log('[Auth] Starting sign for:', walletKey);
		try {
			const ok =
				wallet.type === 'evm'
					? await signAndVerifyEvm(wallet.address, wallet.provider)
					: await signAndVerifySolana(wallet.address, wallet.provider);

			console.log('[Auth] Sign+verify result:', ok);
			if (ok) {
				console.log('[Auth] Success! Reloading page');
				signError = false;
				await invalidateAll();
				window.location.reload();
			} else {
				signError = true;
			}
		} catch (e) {
			console.error('[Auth] Error during sign/verify:', e);
			signError = true;
		} finally {
			authInFlight = false;
		}
	}

	function retrySign() {
		signError = false;
		lastAttemptedWallet = '';
		void ensureWalletSession();
	}

	onMount(() => {
		if (data.user) return;

		function tick() {
			walletConnected = !!getAppKitProvider();
			void ensureWalletSession();
		}

		// Listen to AppKit account changes
		const unsubAccount = appKit?.subscribe?.('accountsChanged', tick);
		const unsubChain = appKit?.subscribe?.('chainChanged', tick);

		// Initial check
		tick();

		// Fallback poll
		const t = window.setInterval(tick, 1500);

		return () => {
			window.clearInterval(t);
			unsubAccount?.();
			unsubChain?.();
		};
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<nav class="sticky top-0 z-50 flex h-11 items-center border-b border-black/10 bg-white px-3.5">
	<div class="mx-auto flex w-full max-w-6xl items-center justify-between">
		<a href="/" class="flex items-center no-underline">
			<img src={navLogo} alt="CoinDraft" class="h-7 w-auto" />
		</a>

		<div class="ml-8 flex flex-1 gap-6">
			<a
				href="/"
				class="rounded px-2 py-1 text-sm text-[#666] transition hover:bg-[#f0f0f0] hover:text-[#333]"
				class:bg-[#eeedfe]={page.url.pathname === '/'}
				class:text-[#534ab7]={page.url.pathname === '/'}>home</a
			>
			<a
				href="/dashboard"
				class="rounded px-2 py-1 text-sm text-[#666] transition hover:bg-[#f0f0f0] hover:text-[#333]"
				class:bg-[#eeedfe]={page.url.pathname.startsWith('/dashboard')}
				class:text-[#534ab7]={page.url.pathname.startsWith('/dashboard')}>dashboard</a
			>
			<a
				href="/manager"
				class="rounded px-2 py-1 text-sm text-[#666] transition hover:bg-[#f0f0f0] hover:text-[#333]"
				class:bg-[#eeedfe]={page.url.pathname.startsWith('/manager')}
				class:text-[#534ab7]={page.url.pathname.startsWith('/manager')}>manager</a
			>
			<a
				href="/draft"
				class="rounded px-2 py-1 text-sm text-[#666] transition hover:bg-[#f0f0f0] hover:text-[#333]"
				class:bg-[#eeedfe]={page.url.pathname.startsWith('/draft')}
				class:text-[#534ab7]={page.url.pathname.startsWith('/draft')}>draft</a
			>
			<a
				href="/contest/result"
				class="rounded px-2 py-1 text-sm text-[#666] transition hover:bg-[#f0f0f0] hover:text-[#333]"
				class:bg-[#eeedfe]={page.url.pathname.startsWith('/contest')}
				class:text-[#534ab7]={page.url.pathname.startsWith('/contest')}>result</a
			>
		</div>

		{#if data.user}
			<div class="flex items-center gap-3">
				<div class="rounded-[99px] bg-[#eeedfe] px-3 py-1 text-xs font-medium text-[#534ab7]">
					{data.user.xpTotal ?? 0} XP
				</div>
				<div
					class="grid h-8 w-8 place-items-center rounded-full bg-[#534ab7] text-sm font-medium text-white"
				>
					{data.user.username?.[0]?.toUpperCase() ?? '?'}
				</div>
				<button
					onclick={logout}
					class="cursor-pointer rounded border border-[#ddd] bg-transparent px-3 py-1 text-xs text-[#666] transition hover:bg-[#f5f5f5] hover:text-[#333]"
					>logout</button
				>
			</div>
		{:else}
			<div class="flex items-center gap-3">
				{#if walletConnected}
					{#if authInFlight}
						<span class="text-xs text-[#666]">Signing...</span>
					{:else if signError}
						<span class="text-xs text-red-500">Signature failed.</span>
						<button
							onclick={retrySign}
							class="cursor-pointer rounded bg-[#534ab7] px-3 py-1 text-xs font-medium text-white transition hover:bg-[#4239a0]"
							>Try again</button
						>
					{:else}
						<span class="text-xs text-[#666]">Wallet connected —</span>
						<button
							onclick={retrySign}
							class="cursor-pointer rounded bg-[#534ab7] px-3 py-1 text-xs font-medium text-white transition hover:bg-[#4239a0]"
							>Sign to verify</button
						>
					{/if}
				{:else if appkitReady}
					<appkit-button></appkit-button>
				{:else}
					<button
						class="cursor-not-allowed rounded border border-[#ddd] bg-transparent px-3 py-1 text-xs text-[#666]"
						disabled>loading wallet...</button
					>
				{/if}
			</div>
		{/if}
	</div>
</nav>

<main class="mx-auto max-w-6xl p-3.5">
	{@render children()}
</main>
