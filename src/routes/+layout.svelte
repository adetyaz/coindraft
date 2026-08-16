<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { appKit } from '$lib/appkit';
	import favicon from '$lib/assets/images/logo_v4_appicon.svg';
	import { SiweMessage } from 'siwe';
	import bs58 from 'bs58';
	import Ticker from '$lib/components/ui/Ticker.svelte';

	let { children, data } = $props();
	const appkitReady = Boolean(appKit);
	let authInFlight = $state(false);
	let lastAttemptedWallet = '';
	let walletConnected = $state(false);
	let signError = $state(false);
	let openNavGroup = $state<string | null>(null);
	let tickerItems = $state<string[]>([]);

	onMount(async () => {
		try {
			const res = await fetch('/api/tokens');
			if (res.ok) {
				const tokens: { symbol?: string; change24h: number | null }[] = await res.json();
				tickerItems = tokens
					.filter((t) => t.change24h != null)
					.slice(0, 14)
					.map(
						(t) =>
							`${(t.symbol ?? '').toUpperCase()} ${t.change24h! >= 0 ? '+' : ''}${t.change24h!.toFixed(1)}%`
					);
			}
		} catch {
			// Ticker is decorative — a failed fetch just leaves it empty.
		}
	});

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
		},
		{
			label: 'help',
			items: [
				{ href: '/guide', label: 'how to use' },
				{ href: '/docs', label: 'documentation' }
			]
		}
	];

	function groupIsActive(group: (typeof NAV_GROUPS)[number]): boolean {
		return group.items.some((i) => page.url.pathname.startsWith(i.href));
	}

	onMount(() => {
		function handleClickOutside(e: MouseEvent) {
			if (!(e.target as HTMLElement).closest('[data-nav-dropdown]')) {
				openNavGroup = null;
			}
		}
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});

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

<div class="min-h-screen bg-bg text-text">
	<nav class="sticky top-0 z-50 flex items-center justify-between gap-6 border-b border-border bg-surface px-7 py-3.5">
		<a href="/" class="flex shrink-0 items-center gap-2.5 no-underline">
			<span class="relative h-6 w-6 shrink-0">
				<span
					class="absolute inset-0 rounded-md bg-primary shadow-[0_0_22px_rgba(247,142,121,0.55)]"
					style="transform:rotate(45deg)"
				></span>
				<span class="absolute top-2 left-2 h-2 w-2 rounded-[2px] bg-text" style="transform:rotate(45deg)"
				></span>
			</span>
			<span class="text-[19px] font-black tracking-[-0.03em] text-text">CoinDraft</span>
		</a>

		<div class="frost-panel flex min-w-0 flex-wrap items-center justify-center gap-0.5 rounded-full p-1">
			<a
				href="/"
				class="shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium text-text-muted no-underline transition"
				class:bg-surface-alt={page.url.pathname === '/'}
				class:font-bold={page.url.pathname === '/'}
				class:text-text={page.url.pathname === '/'}>Home</a
			>
			<a
				href="/dashboard"
				class="shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium text-text-muted no-underline transition"
				class:bg-surface-alt={page.url.pathname.startsWith('/dashboard')}
				class:font-bold={page.url.pathname.startsWith('/dashboard')}
				class:text-text={page.url.pathname.startsWith('/dashboard')}>Dashboard</a
			>
			{#each NAV_GROUPS as group (group.label)}
				<div class="relative shrink-0" data-nav-dropdown>
					<button
						type="button"
						onclick={() => (openNavGroup = openNavGroup === group.label ? null : group.label)}
						class="flex cursor-pointer items-center gap-1 rounded-full px-3.5 py-1.5 text-[13px] font-medium text-text-muted transition"
						class:bg-surface-alt={groupIsActive(group)}
						class:font-bold={groupIsActive(group)}
						class:text-text={groupIsActive(group)}
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
							class="absolute top-full left-0 z-50 mt-2 min-w-36 rounded-xl border border-border bg-surface p-1 shadow-[0_12px_34px_rgba(26,36,33,0.14)]"
						>
							{#each group.items as item (item.href)}
								<a
									href={item.href}
									onclick={() => (openNavGroup = null)}
									class="block rounded-lg px-3 py-1.5 text-[13px] font-medium text-text-muted no-underline transition hover:bg-hover hover:text-text"
									class:bg-primary-muted={page.url.pathname.startsWith(item.href)}
									class:text-primary-ink={page.url.pathname.startsWith(item.href)}
									>{item.label.charAt(0).toUpperCase() + item.label.slice(1)}</a
								>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<div class="flex shrink-0 items-center gap-2.5">
			{#if data.user}
				<span class="font-mono text-xs whitespace-nowrap text-text-muted">{data.user.xpTotal ?? 0} XP</span>
				<a
					href="/profile"
					class="grid h-8 w-8 place-items-center rounded-full border border-border bg-surface-alt no-underline transition hover:border-primary"
				>
					{data.user.username?.[0]?.toUpperCase() ?? '?'}
				</a>
				<button
					onclick={logout}
					class="cursor-pointer rounded-full border border-border bg-transparent px-3 py-1.5 text-xs font-bold whitespace-nowrap text-text-muted transition hover:bg-hover hover:text-text"
					>Log out</button
				>
			{:else if walletConnected}
				{#if authInFlight}
					<span class="text-xs whitespace-nowrap text-text-muted">Signing...</span>
				{:else if signError}
					<span class="text-xs whitespace-nowrap text-negative-ink">Signature failed.</span>
					<button
						onclick={retrySign}
						class="cursor-pointer rounded-full border-none bg-primary px-3.5 py-1.5 text-xs font-bold whitespace-nowrap text-text transition hover:bg-primary-hover"
						>Try again</button
					>
				{:else}
					<span class="text-xs whitespace-nowrap text-text-muted">Wallet connected —</span>
					<button
						onclick={retrySign}
						class="cursor-pointer rounded-full border-none bg-primary px-3.5 py-1.5 text-xs font-bold whitespace-nowrap text-text transition hover:bg-primary-hover"
						>Sign to verify</button
					>
				{/if}
			{:else if appkitReady}
				<appkit-button></appkit-button>
			{:else}
				<button
					class="cursor-not-allowed rounded-full border border-border bg-transparent px-3.5 py-1.5 text-xs whitespace-nowrap text-text-muted"
					disabled>loading wallet...</button
				>
			{/if}
		</div>
	</nav>

	{#if tickerItems.length > 0}
		<Ticker items={tickerItems} />
	{/if}

	<main>
		{@render children()}
	</main>
</div>
