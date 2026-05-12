<script lang="ts">
	import { page } from '$app/state';
	import { onMount, onDestroy } from 'svelte';

	// ── State ────────────────────────────────────────────────────────────
	let contests = $state<{ id: string; status: string; type: string; createdAt: string }[]>([]);
	let sectors = $state<{ id: string; name: string; change: number | null }[]>([]);
	let tokens = $state<
		{
			currency_id: string;
			symbol?: string;
			name?: string;
			price: number | null;
			change24h: number | null;
			volume24h: number | null;
			rank: number | null;
		}[]
	>([]);
	let news = $state<{ title?: string; date?: string; source?: string; url?: string }[]>([]);
	let loading = $state(true);
	let actionError = $state('');

	// ── Derived ──────────────────────────────────────────────────────────
	const user = $derived(page.data.user);
	const totalPoints = $derived(
		contests.filter((c) => c.status === 'resolved').length * 87 // placeholder score per resolved
	);
	const resolvedCount = $derived(contests.filter((c) => c.status === 'resolved').length);
	const activeContest = $derived(
		contests.find((c) => c.status === 'open' || c.status === 'live') ?? null
	);

	// ── Countdown ────────────────────────────────────────────────────────
	let timeLeft = $state(4 * 3600 + 22 * 60 + 15);
	const timerStr = $derived.by(() => {
		const h = Math.floor(timeLeft / 3600);
		const m = Math.floor((timeLeft % 3600) / 60);
		const s = timeLeft % 60;
		return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	});
	let timer: ReturnType<typeof setInterval> | null = null;

	// ── Lifecycle ────────────────────────────────────────────────────────
	onMount(async () => {
		timer = setInterval(() => {
			if (timeLeft > 0) timeLeft--;
		}, 1000);
		await Promise.all([loadContests(), loadSectors(), loadTokens(), loadNews()]);
		loading = false;
	});
	onDestroy(() => {
		if (timer) clearInterval(timer);
	});

	// ── Data Loaders ─────────────────────────────────────────────────────
	async function loadContests() {
		try {
			const res = await fetch('/api/contests');
			if (res.ok) contests = await res.json();
		} catch {
			/* silent */
		}
	}

	async function loadSectors() {
		try {
			const res = await fetch('/api/sectors');
			if (res.ok) {
				const data = await res.json();
				sectors = Array.isArray(data) ? data : [];
			}
		} catch {
			/* silent */
		}
	}

	async function loadTokens() {
		try {
			const res = await fetch('/api/tokens');
			if (res.ok) tokens = await res.json();
		} catch {
			/* silent */
		}
	}

	async function loadNews() {
		try {
			const res = await fetch('/api/news');
			if (res.ok) {
				const data = await res.json();
				news = Array.isArray(data) ? data.slice(0, 5) : [];
			}
		} catch {
			/* silent */
		}
	}

	async function createContest() {
		actionError = '';
		try {
			const res = await fetch('/api/contests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'daily' })
			});
			if (!res.ok) {
				if (res.status === 401) {
					window.location.href = '/?auth=required';
					return;
				}
				const p = await res.json().catch(() => ({}));
				throw new Error(p?.error ?? 'Failed to create contest');
			}
			const contest = await res.json();
			window.location.href = `/draft?contestId=${contest.id}`;
		} catch (e: unknown) {
			actionError = e instanceof Error ? e.message : 'Failed to create contest';
		}
	}

	// ── Helpers ──────────────────────────────────────────────────────────
	function fmtChg(v: number | null): string {
		if (v == null) return '—';
		return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
	}

	function fmtVol(v: number | null): string {
		if (v == null) return '—';
		if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
		if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
		return `$${v.toLocaleString()}`;
	}

	function avatarBg(sym: string): string {
		const colors = ['#534AB7', '#0F6E56', '#3B82F6', '#D97706', '#993C1D', '#7C3AED'];
		let h = 0;
		for (const c of sym) h = (h * 31 + c.charCodeAt(0)) >>> 0;
		return colors[h % colors.length];
	}

	const SECTOR_COLORS: Record<string, string> = {
		l1: '#0F6E56',
		l2: '#3B82F6',
		defi: '#534AB7',
		meme: '#993C1D',
		wildcard: '#D97706'
	};
	const SECTOR_BG: Record<string, string> = {
		l1: '#e1f5ee',
		l2: '#eff6ff',
		defi: '#eeedfe',
		meme: '#faece7',
		wildcard: '#fef3c7'
	};
</script>

<!-- Break out of layout container for full-width sidebar layout -->
<div class="-mx-3.5 -mt-3.5 flex min-h-screen bg-[#F8F8F7]">
	<!-- ── Sidebar ──────────────────────────────────────────────────────── -->
	<aside
		class="sticky top-11 flex h-[calc(100vh-44px)] w-64 shrink-0 flex-col border-r border-black/8 bg-white max-lg:hidden"
	>
		<!-- Team header -->
		<div class="border-b border-black/5 px-5 py-5">
			<div class="flex items-center gap-3">
				<div
					class="flex h-11 w-11 items-center justify-center rounded-full bg-[#534AB7] text-sm font-black text-white"
				>
					{user?.username?.[0]?.toUpperCase() ?? '?'}
				</div>
				<div>
					<p class="text-sm font-bold text-[#1c1b22]">{user?.username ?? 'Manager'}</p>
					<p class="text-[11px] font-medium text-[#888780]">Elite Manager · Season 4</p>
				</div>
			</div>
			<!-- quick stats -->
			<div class="mt-4 grid grid-cols-2 gap-2">
				<div class="rounded-lg bg-[#f8f8f7] p-2.5 text-center">
					<p class="text-base font-black text-[#1c1b22]">{resolvedCount}</p>
					<p class="text-[10px] font-medium tracking-wide text-[#888780] uppercase">Contests</p>
				</div>
				<div class="rounded-lg bg-[#f8f8f7] p-2.5 text-center">
					<p class="text-base font-black text-[#1c1b22]">{user?.xpTotal ?? 0}</p>
					<p class="text-[10px] font-medium tracking-wide text-[#888780] uppercase">XP Total</p>
				</div>
			</div>
		</div>

		<!-- Nav -->
		<nav class="flex-1 px-3 py-4">
			<p class="mb-2 px-2 text-[10px] font-bold tracking-widest text-[#bbb] uppercase">
				Navigation
			</p>
			{#each [{ href: '/manager', label: 'Home', icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' }, { href: '/dashboard', label: 'Dashboard', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' }, { href: '/draft', label: 'Draft', icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6' }, { href: '/contest/result', label: 'Results', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' }] as nav (nav.href)}
				<a
					href={nav.href}
					class="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
						{nav.href === '/manager'
						? 'bg-[#eeedfe] text-[#534AB7]'
						: 'text-[#5d5d6b] hover:bg-[#f5f5f5] hover:text-[#1c1b22]'}"
				>
					<svg
						class="h-4 w-4 shrink-0"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d={nav.icon} />
					</svg>
					{nav.label}
				</a>
			{/each}
		</nav>

		<!-- Draft CTA -->
		<div class="border-t border-black/5 p-4">
			<button
				onclick={createContest}
				class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#534AB7] py-3 text-sm font-bold text-white transition hover:bg-[#453fa0]"
			>
				<svg
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2.5"
				>
					<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
				</svg>
				Draft Now
			</button>
			{#if actionError}
				<p class="mt-2 text-center text-[11px] text-[#993C1D]">{actionError}</p>
			{/if}
		</div>
	</aside>

	<!-- ── Main Content ──────────────────────────────────────────────── -->
	<div class="flex-1 overflow-y-auto">
		<div class="mx-auto max-w-3xl space-y-5 px-5 py-6">
			<!-- Mobile header -->
			<div class="flex items-center justify-between lg:hidden">
				<div>
					<h1 class="text-lg font-bold text-[#1c1b22]">{user?.username ?? 'Manager'}</h1>
					<p class="text-[11px] text-[#888780]">Elite Manager · Season 4</p>
				</div>
				<button
					onclick={createContest}
					class="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#534AB7] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#453fa0]"
					>Draft Now</button
				>
			</div>

			<!-- ── Stats Cards ─────────────────────────────────────── -->
			<div class="grid grid-cols-3 gap-3 max-sm:grid-cols-2">
				<div class="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
					<p class="text-[10px] font-bold tracking-wider text-[#888780] uppercase">Overall Rank</p>
					<p class="mt-2 text-2xl font-black text-[#1c1b22]">#12,450</p>
					<p class="mt-1 text-[11px] font-medium text-[#0F6E56]">↑ 1.2%</p>
				</div>
				<div class="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
					<p class="text-[10px] font-bold tracking-wider text-[#888780] uppercase">Total Points</p>
					<p class="mt-2 text-2xl font-black text-[#1c1b22]">{totalPoints}</p>
					<p class="mt-1 text-[11px] text-[#888780]">Active GW</p>
				</div>
				<div class="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
					<p class="text-[10px] font-bold tracking-wider text-[#888780] uppercase">XP Total</p>
					<p class="mt-2 text-2xl font-black text-[#1c1b22]">{user?.xpTotal ?? 0}</p>
					<p class="mt-1 text-[11px] text-[#888780]">All-time</p>
				</div>
				<div class="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
					<p class="text-[10px] font-bold tracking-wider text-[#888780] uppercase">Contests</p>
					<p class="mt-2 text-2xl font-black text-[#1c1b22]">{resolvedCount}</p>
					<p class="mt-1 text-[11px] text-[#888780]">Resolved</p>
				</div>
				<div class="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
					<p class="text-[10px] font-bold tracking-wider text-[#888780] uppercase">Active Draft</p>
					{#if activeContest}
						<p class="mt-2 text-sm font-bold text-[#0F6E56]">In Progress</p>
						<a
							href={`/draft?contestId=${activeContest.id}`}
							class="mt-1 block text-[11px] text-[#534AB7] no-underline hover:underline"
							>Continue →</a
						>
					{:else}
						<p class="mt-2 text-sm font-bold text-[#888780]">None</p>
						<button
							onclick={createContest}
							class="mt-1 cursor-pointer border-none bg-transparent p-0 text-[11px] text-[#534AB7] hover:underline"
							>Start one →</button
						>
					{/if}
				</div>
				<div class="rounded-xl border border-[#D97706]/30 bg-[#fef3c7] p-4 shadow-sm">
					<p class="text-[10px] font-bold tracking-wider text-[#D97706] uppercase">Wildcard</p>
					<p class="mt-2 text-sm font-bold text-[#92400e]">Available</p>
					<p class="mt-1 text-[11px] text-[#92400e]/70">Use on next draft</p>
				</div>
			</div>

			<!-- ── Deadline Banner ────────────────────────────────── -->
			<div class="flex items-center justify-between rounded-2xl bg-[#0d0c18] px-5 py-4 text-white">
				<div>
					<p class="text-[11px] font-bold tracking-widest text-white/40 uppercase">Next Lock In</p>
					<p class="mt-1 text-2xl font-black text-white tabular-nums">{timerStr}</p>
					<p class="mt-0.5 text-xs text-white/40">Daily Gauntlet · Season 4</p>
				</div>
				<button
					onclick={createContest}
					class="flex cursor-pointer items-center gap-2 rounded-xl bg-[#534AB7] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#6b60cc]"
				>
					<svg
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2.5"
					>
						<polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" />
					</svg>
					Draft Now
				</button>
			</div>

			<div class="grid grid-cols-2 gap-4 max-md:grid-cols-1">
				<!-- ── Sector Performance ──────────────────────────── -->
				<section class="rounded-xl border border-black/5 bg-white shadow-sm">
					<div class="flex items-center justify-between border-b border-black/5 px-4 py-3">
						<h3 class="text-xs font-bold tracking-widest text-[#888780] uppercase">Sector Wars</h3>
						<span class="text-[10px] text-[#888780]">Live · 5 min cache</span>
					</div>
					<div class="divide-y divide-black/5">
						{#if loading}
							{#each [0, 1, 2, 3, 4] as i (i)}
								<div class="flex items-center gap-3 px-4 py-3">
									<div class="h-3 w-16 animate-pulse rounded bg-[#f0f0f0]"></div>
									<div class="ml-auto h-3 w-10 animate-pulse rounded bg-[#f0f0f0]"></div>
								</div>
							{/each}
						{:else if sectors.length === 0}
							<p class="px-4 py-6 text-center text-sm text-[#888780]">Sector feed unavailable</p>
						{:else}
							{#each sectors as sec (sec.id ?? sec.name)}
								{@const clr = SECTOR_COLORS[sec.id] ?? '#534AB7'}
								{@const bg = SECTOR_BG[sec.id] ?? '#eeedfe'}
								{@const chg = sec.change ?? 0}
								<div class="flex items-center gap-3 px-4 py-3">
									<span
										class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
										style="background: {bg}; color: {clr}">{sec.name}</span
									>
									<div class="flex-1 overflow-hidden rounded-full bg-[#f0f0f0]" style="height: 4px">
										<div
											class="h-full rounded-full"
											style="width: {Math.max(
												4,
												Math.min(100, Math.abs(chg) * 8)
											)}%; background: {clr}"
										></div>
									</div>
									<span
										class="shrink-0 text-xs font-semibold tabular-nums"
										style="color: {chg >= 0 ? '#0F6E56' : '#993C1D'}">{fmtChg(chg)}</span
									>
								</div>
							{/each}
						{/if}
					</div>
				</section>

				<!-- ── Scout Report (News) ─────────────────────────── -->
				<section class="rounded-xl border border-black/5 bg-white shadow-sm">
					<div class="flex items-center justify-between border-b border-black/5 px-4 py-3">
						<h3 class="text-xs font-bold tracking-widest text-[#888780] uppercase">Scout Report</h3>
						<span class="text-[10px] text-[#888780]">Live Feed</span>
					</div>
					<div class="divide-y divide-black/5">
						{#if loading}
							{#each [0, 1, 2] as i (i)}
								<div class="px-4 py-3">
									<div class="h-3 w-4/5 animate-pulse rounded bg-[#f0f0f0]"></div>
									<div class="mt-1.5 h-2.5 w-1/2 animate-pulse rounded bg-[#f0f0f0]"></div>
								</div>
							{/each}
						{:else if news.length === 0}
							<p class="px-4 py-6 text-center text-sm text-[#888780]">No news available</p>
						{:else}
							{#each news as item, i (i)}
								<div class="flex gap-3 px-4 py-3">
									<div class="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#534AB7]"></div>
									<div>
										<p class="text-[13px] leading-snug font-medium text-[#1c1b22]">
											{item.title ?? 'Market update'}
										</p>
										<p class="mt-0.5 text-[11px] text-[#888780]">
											{item.source ?? 'SoSoValue'}{item.date ? ` · ${item.date}` : ''}
										</p>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</section>
			</div>

			<!-- ── Hot Tokens ──────────────────────────────────────── -->
			<section class="rounded-xl border border-black/5 bg-white shadow-sm">
				<div class="flex items-center justify-between border-b border-black/5 px-4 py-3">
					<h3 class="text-xs font-bold tracking-widest text-[#888780] uppercase">Hot Tokens</h3>
					<span class="text-[10px] text-[#888780]">Top movers · 2 min cache</span>
				</div>
				<div class="grid grid-cols-12 border-b border-black/5 bg-[#fafafa] px-4 py-2">
					<div class="col-span-5 text-[10px] font-bold tracking-wider text-[#888780] uppercase">
						Token
					</div>
					<div
						class="col-span-4 text-right text-[10px] font-bold tracking-wider text-[#888780] uppercase"
					>
						Price
					</div>
					<div
						class="col-span-3 text-right text-[10px] font-bold tracking-wider text-[#888780] uppercase"
					>
						24h
					</div>
				</div>
				<div class="divide-y divide-black/5">
					{#if loading}
						{#each [0, 1, 2, 3, 4] as i (i)}
							<div class="grid grid-cols-12 items-center px-4 py-3">
								<div class="col-span-5 flex items-center gap-3">
									<div class="h-8 w-8 animate-pulse rounded-full bg-[#f0f0f0]"></div>
									<div class="h-3 w-16 animate-pulse rounded bg-[#f0f0f0]"></div>
								</div>
								<div class="col-span-4 flex justify-end">
									<div class="h-3 w-14 animate-pulse rounded bg-[#f0f0f0]"></div>
								</div>
								<div class="col-span-3 flex justify-end">
									<div class="h-3 w-12 animate-pulse rounded bg-[#f0f0f0]"></div>
								</div>
							</div>
						{/each}
					{:else if tokens.length === 0}
						<p class="px-4 py-8 text-center text-sm text-[#888780]">Token data unavailable</p>
					{:else}
						{#each tokens.slice(0, 8) as token (token.currency_id)}
							<div class="grid grid-cols-12 items-center px-4 py-3">
								<div class="col-span-5 flex items-center gap-3">
									<div
										class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
										style="background: {avatarBg(token.symbol ?? '')}"
									>
										{(token.symbol ?? '?').charAt(0).toUpperCase()}
									</div>
									<div>
										<div class="flex items-center gap-1.5">
											<p class="text-sm font-semibold text-[#1c1b22]">
												{(token.symbol ?? '').toUpperCase()}
											</p>
											{#if token.rank}
												<span class="rounded bg-[#f0f0f0] px-1 py-0.5 text-[9px] text-[#888780]"
													>#{token.rank}</span
												>
											{/if}
										</div>
										<p class="truncate text-[11px] text-[#888780]">{token.name}</p>
									</div>
								</div>
								<div class="col-span-4 text-right">
									<p class="text-sm font-medium text-[#1c1b22]">
										{token.price != null
											? token.price >= 1000
												? `$${token.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
												: `$${token.price.toFixed(token.price < 1 ? 4 : 2)}`
											: '—'}
									</p>
								</div>
								<div class="col-span-3 text-right">
									{#if token.change24h != null}
										<span
											class="text-xs font-semibold"
											style="color: {token.change24h >= 0 ? '#0F6E56' : '#993C1D'}"
											>{fmtChg(token.change24h)}</span
										>
									{:else}
										<span class="text-xs text-[#888780]">—</span>
									{/if}
								</div>
							</div>
						{/each}
					{/if}
				</div>
				<div class="border-t border-black/5 px-4 py-3">
					<a href="/draft" class="text-xs font-semibold text-[#534AB7] no-underline hover:underline"
						>Draft a token from this list →</a
					>
				</div>
			</section>

			<!-- ── AI Scouting Agent ───────────────────────────────── -->
			<section
				class="overflow-hidden rounded-xl border border-[#534AB7]/20 bg-linear-to-br from-[#f5f4ff] to-[#eeedfe] shadow-sm"
			>
				<div class="flex items-center gap-3 border-b border-[#534AB7]/10 px-4 py-3">
					<div class="flex h-7 w-7 items-center justify-center rounded-lg bg-[#534AB7]">
						<svg
							class="h-4 w-4 text-white"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
							/>
						</svg>
					</div>
					<h3 class="text-xs font-bold tracking-widest text-[#534AB7] uppercase">
						AI Scouting Agent
					</h3>
					<span
						class="ml-auto rounded-full bg-[#534AB7]/10 px-2 py-0.5 text-[10px] font-semibold text-[#534AB7]"
						>Beta</span
					>
				</div>
				<div class="px-4 py-4">
					{#if sectors.length > 0}
						{@const topSec = [...sectors].sort((a, b) => (b.change ?? 0) - (a.change ?? 0))[0]}
						{@const topTok = tokens
							.filter((t) => t.change24h != null)
							.sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0))[0]}
						<p class="text-sm leading-relaxed text-[#534AB7]">
							"Data indicates <strong>{topSec?.name ?? 'L1'}</strong> is the top-performing sector
							at <strong>{fmtChg(topSec?.change ?? null)}</strong> today.
							{#if topTok}
								Consider including <strong>{(topTok.symbol ?? '').toUpperCase()}</strong> ({fmtChg(
									topTok.change24h
								)}) in your lineup for maximum upside.
							{/if}
							Monitor volume spikes — high turnover often precedes breakout moves."
						</p>
					{:else}
						<p class="text-sm leading-relaxed text-[#534AB7]">
							"Analyzing market conditions... Connect to live data for personalized sector insights
							and lineup recommendations."
						</p>
					{/if}
				</div>
			</section>

			<!-- ── Recent Contests ────────────────────────────────── -->
			{#if contests.length > 0}
				<section class="rounded-xl border border-black/5 bg-white shadow-sm">
					<div class="border-b border-black/5 px-4 py-3">
						<h3 class="text-xs font-bold tracking-widest text-[#888780] uppercase">
							Recent Contests
						</h3>
					</div>
					<div class="divide-y divide-black/5">
						{#each contests.slice(0, 5) as c (c.id)}
							<div class="flex items-center justify-between px-4 py-3">
								<div>
									<p class="text-sm font-medium text-[#1c1b22]">{c.type ?? 'Daily'} Contest</p>
									<p class="text-[11px] text-[#888780]">
										{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''}
									</p>
								</div>
								<div class="flex items-center gap-3">
									<span
										class="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase
										{c.status === 'resolved'
											? 'bg-[#e1f5ee] text-[#0F6E56]'
											: c.status === 'live'
												? 'bg-[#eff6ff] text-[#3B82F6]'
												: 'bg-[#f0f0f0] text-[#888780]'}">{c.status}</span
									>
									{#if c.status === 'open' || c.status === 'live'}
										<a
											href={`/draft?contestId=${c.id}`}
											class="text-[11px] text-[#534AB7] no-underline hover:underline">Continue →</a
										>
									{:else if c.status === 'resolved'}
										<a
											href={`/contest/result?contestId=${c.id}`}
											class="text-[11px] text-[#534AB7] no-underline hover:underline"
											>View Result →</a
										>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}
		</div>
	</div>
</div>
