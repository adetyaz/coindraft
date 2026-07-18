<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { appKit } from '$lib/appkit';
	import favicon from '$lib/assets/images/logo_v4_appicon.svg';
	import { SiweMessage } from 'siwe';
	import bs58 from 'bs58';

	let { children, data } = $props();
	const appkitReady = Boolean(appKit);
	let authInFlight = $state(false);
	let lastAttemptedWallet = '';
	let walletConnected = $state(false);
	let signError = $state(false);
	let isLight = $state(false);
	let openNavGroup = $state<string | null>(null);

	const NAV_GROUPS: { label: string; items: { href: string; label: string }[] }[] = [
		{
			label: 'play',
			items: [
				{ href: '/draft', label: 'draft' },
				{ href: '/matchmaking', label: 'matchmaking' },
				{ href: '/lobby', label: 'lobbies' },
				{ href: '/contest/result', label: 'result' }
			]
		},
		{
			label: 'compete',
			items: [
				{ href: '/leagues', label: 'leagues' },
				{ href: '/leaderboard', label: 'leaderboard' }
			]
		},
		{
			label: 'learn',
			items: [
				{ href: '/mentor', label: 'mentor' },
				{ href: '/research', label: 'research' }
			]
		}
	];

	function groupIsActive(group: (typeof NAV_GROUPS)[number]): boolean {
		return group.items.some((i) => page.url.pathname.startsWith(i.href));
	}

	onMount(() => {
		isLight = document.documentElement.getAttribute('data-theme') === 'light';
	});

	onMount(() => {
		function handleClickOutside(e: MouseEvent) {
			if (!(e.target as HTMLElement).closest('[data-nav-dropdown]')) {
				openNavGroup = null;
			}
		}
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});

	function toggleTheme() {
		isLight = !isLight;
		if (isLight) {
			document.documentElement.setAttribute('data-theme', 'light');
			localStorage.setItem('theme', 'light');
		} else {
			document.documentElement.removeAttribute('data-theme');
			localStorage.setItem('theme', 'dark');
		}
	}

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
		if ((account as Record<string, unknown>).type === 'solana') {
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

		let retryCount = 0;
		const MAX_RETRIES = 3;

		function tick() {
			walletConnected = !!getAppKitProvider();
			if (signError && retryCount < MAX_RETRIES) {
				retryCount++;
				console.log('[Auth] Auto-retry attempt', retryCount);
				lastAttemptedWallet = '';
				signError = false;
			}
			void ensureWalletSession();
		}

		// Listen to AppKit account changes
		const appKitAny = appKit as unknown as Record<string, unknown>;
		const unsubAccount =
			typeof appKitAny?.subscribe === 'function'
				? (appKitAny.subscribe as (...args: unknown[]) => unknown)('accountsChanged', tick)
				: undefined;
		const unsubChain =
			typeof appKitAny?.subscribe === 'function'
				? (appKitAny.subscribe as (...args: unknown[]) => unknown)('chainChanged', tick)
				: undefined;

		// Initial check with delay to let AppKit fully initialize
		const initTimer = window.setTimeout(tick, 500);

		// Fallback poll — less frequent to avoid race conditions
		const t = window.setInterval(tick, 3000);

		return () => {
			window.clearTimeout(initTimer);
			window.clearInterval(t);
			if (typeof unsubAccount === 'function') unsubAccount();
			if (typeof unsubChain === 'function') unsubChain();
		};
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<nav class="sticky top-0 z-50 flex h-11 items-center border-b border-border bg-surface px-3.5">
	<div class="mx-auto flex w-full max-w-6xl items-center justify-between">
		<a href="/" class="flex items-center gap-2 no-underline">
			<svg width="30" height="30" viewBox="0 0 40 40" aria-hidden="true">
				<rect
					x="4"
					y="6"
					width="30"
					height="30"
					rx="7"
					fill="var(--color-primary)"
					transform="rotate(-8 19 21)"
				/>
				<line
					x1="12"
					y1="16"
					x2="26"
					y2="16"
					stroke="white"
					stroke-width="2"
					stroke-linecap="round"
					opacity="0.9"
					transform="rotate(-8 19 21)"
				/>
				<line
					x1="12"
					y1="22"
					x2="22"
					y2="22"
					stroke="white"
					stroke-width="2"
					stroke-linecap="round"
					opacity="0.6"
					transform="rotate(-8 19 21)"
				/>
				<circle cx="30" cy="10" r="9" fill="var(--color-positive)" stroke="var(--color-surface)" stroke-width="2" />
				<text
					x="30"
					y="13.5"
					text-anchor="middle"
					font-family="Inter, sans-serif"
					font-weight="700"
					font-size="9"
					fill="white">$</text
				>
			</svg>
			<span class="text-lg font-semibold tracking-tight text-text">CoinDraft</span>
		</a>

		<div class="ml-8 flex min-w-0 flex-1 items-center gap-1.5 max-sm:ml-3">
			<a
				href="/"
				class="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary transition hover:bg-hover hover:text-text"
				class:bg-primary-muted={page.url.pathname === '/'}
				class:text-primary={page.url.pathname === '/'}>Home</a
			>
			<a
				href="/dashboard"
				class="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary transition hover:bg-hover hover:text-text"
				class:bg-primary-muted={page.url.pathname.startsWith('/dashboard')}
				class:text-primary={page.url.pathname.startsWith('/dashboard')}>Dashboard</a
			>
			{#each NAV_GROUPS as group (group.label)}
				<div class="relative shrink-0" data-nav-dropdown>
					<button
						type="button"
						onclick={() => (openNavGroup = openNavGroup === group.label ? null : group.label)}
						class="flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary transition hover:bg-hover hover:text-text"
						class:bg-primary-muted={groupIsActive(group)}
						class:text-primary={groupIsActive(group)}
					>
						{group.label.charAt(0).toUpperCase() + group.label.slice(1)}
						<svg
							class="h-3 w-3 transition-transform {openNavGroup === group.label ? 'rotate-180' : ''}"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2.5"
						>
							<polyline points="6 9 12 15 18 9" />
						</svg>
					</button>
					{#if openNavGroup === group.label}
						<div
							class="absolute top-full left-0 z-50 mt-1 min-w-36 rounded-lg border border-border bg-surface p-1 shadow-lg"
						>
							{#each group.items as item (item.href)}
								<a
									href={item.href}
									onclick={() => (openNavGroup = null)}
									class="block rounded-md px-3 py-1.5 text-sm font-medium text-text-secondary no-underline transition hover:bg-hover hover:text-text"
									class:bg-primary-muted={page.url.pathname.startsWith(item.href)}
									class:text-primary={page.url.pathname.startsWith(item.href)}
									>{item.label.charAt(0).toUpperCase() + item.label.slice(1)}</a
								>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<div class="flex items-center gap-3">
			<button
				onclick={toggleTheme}
				aria-label="Toggle theme"
				class="grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-border bg-transparent text-text-secondary transition hover:bg-hover"
			>
				{#if isLight}
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
						/>
					</svg>
				{:else}
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="4" />
						<path
							stroke-linecap="round"
							d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"
						/>
					</svg>
				{/if}
			</button>

			{#if data.user}
				<div class="rounded-[99px] bg-primary-muted px-3 py-1 text-xs font-medium text-primary">
					{data.user.xpTotal ?? 0} XP
				</div>
				<div
					class="grid h-8 w-8 place-items-center rounded-full bg-primary text-sm font-medium text-white"
				>
					{data.user.username?.[0]?.toUpperCase() ?? '?'}
				</div>
				<button
					onclick={logout}
					class="cursor-pointer rounded border border-border bg-transparent px-3 py-1 text-xs text-text-secondary transition hover:bg-hover hover:text-text"
					>logout</button
				>
			{:else if walletConnected}
				{#if authInFlight}
					<span class="text-xs text-text-secondary">Signing...</span>
				{:else if signError}
					<span class="text-xs text-negative">Signature failed.</span>
					<button
						onclick={retrySign}
						class="cursor-pointer rounded bg-primary px-3 py-1 text-xs font-medium text-white transition hover:bg-primary-hover"
						>Try again</button
					>
				{:else}
					<span class="text-xs text-text-secondary">Wallet connected —</span>
					<button
						onclick={retrySign}
						class="cursor-pointer rounded bg-primary px-3 py-1 text-xs font-medium text-white transition hover:bg-primary-hover"
						>Sign to verify</button
					>
				{/if}
			{:else if appkitReady}
				<appkit-button></appkit-button>
			{:else}
				<button
					class="cursor-not-allowed rounded border border-border bg-transparent px-3 py-1 text-xs text-text-secondary"
					disabled>loading wallet...</button
				>
			{/if}
		</div>
	</div>
</nav>

<main class="mx-auto max-w-6xl p-3.5">
	{@render children()}
</main>
