<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Gauntlet from '$lib/components/Gauntlet.svelte';
	import type { BadgeDef } from '$lib/badges';

	let contests = $state<Array<Record<string, unknown>>>([]);
	let badges = $state<(BadgeDef & { earned: boolean; earnedAt: string | null })[]>([]);
	let sectors = $state<Array<Record<string, unknown>>>([]);
	let alerts = $state<Array<Record<string, unknown>>>([]);
	let tokens = $state<
		{
			currency_id: string;
			symbol?: string;
			name?: string;
			price: number | null;
			change24h: number | null;
			rank: number | null;
		}[]
	>([]);
	let news = $state<{ title?: string; date?: string; source?: string; url?: string }[]>([]);
	let loading = $state(true);
	let actionError = $state('');

	const user = $derived(page.data.user);
	const resolvedContests = $derived(contests.filter((c) => c.status === 'resolved'));
	const winCount = $derived(resolvedContests.filter((c) => c.winnerId === user?.id).length);
	const winRate = $derived(
		resolvedContests.length > 0 ? Math.round((winCount / resolvedContests.length) * 100) : 0
	);

	onMount(async () => {
		await Promise.all([
			loadContests(),
			loadSectors(),
			loadAlerts(),
			loadTokens(),
			loadNews(),
			loadBadges()
		]);
		loading = false;
	});

	async function loadBadges() {
		try {
			const res = await fetch('/api/badges');
			if (res.ok) badges = await res.json();
		} catch (error) {
			console.error('Failed to load badges:', error);
		}
	}

	async function loadContests() {
		try {
			const res = await fetch('/api/contests');
			if (res.ok) contests = await res.json();
		} catch (error) {
			console.error('Failed to load contests:', error);
		}
	}

	async function loadSectors() {
		try {
			const res = await fetch('/api/sectors');
			if (res.ok) {
				const data = await res.json();
				sectors = Array.isArray(data) ? data.slice(0, 6) : [];
			}
		} catch (error) {
			console.error('Failed to load sectors:', error);
		}
	}

	async function loadAlerts() {
		try {
			const res = await fetch('/api/etf');
			if (res.ok) {
				const data = await res.json();
				alerts = data.alerts ?? [];
			}
		} catch (error) {
			console.error('Failed to load alerts:', error);
		}
	}

	async function loadTokens() {
		try {
			const res = await fetch('/api/tokens');
			if (res.ok) tokens = await res.json();
		} catch (error) {
			console.error('Failed to load tokens:', error);
		}
	}

	async function loadNews() {
		try {
			const res = await fetch('/api/news');
			if (res.ok) {
				const data = await res.json();
				news = Array.isArray(data) ? data.slice(0, 5) : [];
			}
		} catch (error) {
			console.error('Failed to load news:', error);
		}
	}

	async function createContest(type: 'daily' | 'weekly' = 'daily') {
		actionError = '';
		try {
			const res = await fetch('/api/contests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type })
			});
			if (!res.ok) {
				const payload = await res.json().catch(() => ({}));
				if (res.status === 401) {
					window.location.href = '/?auth=required';
					return;
				}
				throw new Error(payload?.error ?? 'Failed to create contest');
			}
			const contest = await res.json();
			window.location.href = `/draft?contestId=${contest.id}&type=${contest.type}`;
		} catch (error) {
			actionError = (error as Error)?.message ?? 'Failed to create contest';
			console.error('Failed to create contest:', error);
		}
	}

	function formatPct(value: number) {
		const signed = value >= 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
		return `${signed}%`;
	}

	function avatarBg(sym: string): string {
		const colors = ['#534AB7', '#0F6E56', '#3B82F6', '#D97706', '#993C1D', '#7C3AED'];
		let h = 0;
		for (const c of sym) h = (h * 31 + c.charCodeAt(0)) >>> 0;
		return colors[h % colors.length];
	}
</script>

<div class="flex flex-col gap-3">
	<section class="grid grid-cols-3 gap-3 max-[900px]:grid-cols-1">
		<div class="rounded-xl border border-black/10 bg-white px-3.5 py-3">
			<p class="text-[11px] font-medium text-[#888780] uppercase">Active Contests</p>
			<div class="mt-2 flex items-center justify-between gap-2">
				<h2 class="text-[28px] leading-none font-medium">
					{contests.filter((c) => c.status !== 'resolved').length}
				</h2>
				<span class="rounded-full bg-[#e1f5ee] px-2 py-0.5 text-[11px] font-medium text-[#0f6e56]"
					>In progress</span
				>
			</div>
		</div>
		<div class="rounded-xl border border-black/10 bg-white px-3.5 py-3">
			<p class="text-[11px] font-medium text-[#888780] uppercase">Resolved Contests</p>
			<div class="mt-2 flex items-center justify-between gap-2">
				<h2 class="text-[28px] leading-none font-medium">{resolvedContests.length}</h2>
				<span class="text-lg">🏁</span>
			</div>
		</div>
		<div class="rounded-xl border border-black/10 bg-white px-3.5 py-3">
			<p class="text-[11px] font-medium text-[#888780] uppercase">Win Rate</p>
			<div class="mt-2 flex items-center justify-between gap-2">
				<h2 class="text-[28px] leading-none font-medium">
					{resolvedContests.length > 0 ? `${winRate}%` : '—'}
				</h2>
				<span class="text-xs text-[#888780]">{user?.username ?? 'player'}</span>
			</div>
		</div>
	</section>

	<!-- Matchmaking CTA -->
	<section class="flex items-center justify-between gap-3 rounded-xl bg-[#0F6E56] p-4 text-white">
		<div>
			<h1 class="text-xl leading-[1.2] font-medium">Find a Real Opponent</h1>
			<p class="mt-1 text-xs opacity-90">Match against another player in real-time</p>
		</div>
		<button
			class="h-10 cursor-pointer rounded-lg border-0 bg-white px-4 font-medium text-[#0F6E56] transition-colors hover:bg-[#f0f0f0]"
			onclick={() => goto('/matchmaking')}
		>
			Find Match
		</button>
	</section>

	<div class="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
		<section class="rounded-xl border border-black/10 bg-white px-3.5 py-3">
			<div class="mb-2.5 flex items-center justify-between">
				<h3 class="text-[11px] font-medium text-[#888780] uppercase">Sector Wars</h3>
				<small class="text-[11px] text-[#888780]">Live 15m Cache</small>
			</div>
			{#if loading}
				<p class="text-xs text-[#888780]">Loading sector data...</p>
			{:else if sectors.length === 0}
				<p class="text-xs text-[#888780]">Sector feed unavailable.</p>
			{:else}
				<div class="flex flex-col gap-2">
					{#each sectors as sector, i (sector?.sector ?? sector?.name ?? i)}
						<div class="flex flex-col gap-1">
							<div class="flex justify-between text-[13px]">
								<span>{sector.sector ?? sector.name ?? 'Sector'}</span>
								<span
									class:text-[#0f6e56]={Number(sector.change ?? 0) >= 0}
									class:text-[#993c1d]={Number(sector.change ?? 0) < 0}
									class="font-medium"
								>
									{formatPct(Number(sector.change ?? 0))}
								</span>
							</div>
							<div class="h-2 overflow-hidden rounded-full bg-[#f0ecf6]">
								<div
									class="h-full bg-[#534ab7]"
									style={`width: ${Math.max(8, Math.min(100, Math.abs(Number(sector.change ?? 0)) * 8))}%`}
								></div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<section class="rounded-xl border border-black/10 bg-white px-3.5 py-3">
			<div class="mb-2.5 flex items-center justify-between">
				<h3 class="text-[11px] font-medium text-[#888780] uppercase">Whale Watch</h3>
				<small class="text-[11px] text-[#888780]">ETF Flow Alerts</small>
			</div>
			{#if alerts.length === 0}
				<p class="text-xs text-[#888780]">No active alerts right now.</p>
			{:else}
				<div class="flex flex-col gap-2">
					{#each alerts.slice(0, 3) as alert, i (alert?.date ?? `${alert?.type ?? 'alert'}-${i}`)}
						<div class="flex gap-2 rounded-lg bg-[#f6f2fc] p-2.5">
							<div class="mt-1.5 h-2 w-2 rounded-full bg-[#534ab7]"></div>
							<div>
								<p class="text-[13px] font-medium">{alert.type} streak detected</p>
								<small class="text-[11px] text-[#888780]"
									>{alert.streak} days · ${Math.round(Number(alert.amount)).toLocaleString()}</small
								>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>

	<!-- Gauntlet -->
	<Gauntlet />

	<!-- Badges -->
	<section class="rounded-xl border border-black/10 bg-white px-3.5 py-3">
		<div class="mb-2.5 flex items-center justify-between">
			<h3 class="text-[11px] font-medium text-[#888780] uppercase">Badges</h3>
			<small class="text-[11px] text-[#888780]"
				>{badges.filter((b) => b.earned).length}/{badges.length} unlocked</small
			>
		</div>
		<div class="flex flex-wrap gap-2">
			{#each badges as badge (badge.code)}
				<div
					class="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 {badge.earned
						? 'border-[#534ab7]/20 bg-[#f5f4ff]'
						: 'border-black/5 bg-[#fafafa] opacity-50'}"
					title={badge.description}
				>
					<span class="text-base {badge.earned ? '' : 'grayscale'}">{badge.emoji}</span>
					<span class="text-xs font-medium {badge.earned ? 'text-[#534ab7]' : 'text-[#888780]'}"
						>{badge.name}</span
					>
				</div>
			{/each}
		</div>
	</section>

	<div class="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
		<!-- Hot Tokens -->
		<section class="rounded-xl border border-black/10 bg-white px-3.5 py-3">
			<div class="mb-2.5 flex items-center justify-between">
				<h3 class="text-[11px] font-medium text-[#888780] uppercase">Hot Tokens</h3>
				<small class="text-[11px] text-[#888780]">Top movers</small>
			</div>
			{#if loading}
				<p class="text-xs text-[#888780]">Loading tokens...</p>
			{:else if tokens.length === 0}
				<p class="text-xs text-[#888780]">Token data unavailable.</p>
			{:else}
				<div class="flex flex-col divide-y divide-[#f0f0f0]">
					{#each tokens.slice(0, 5) as token (token.currency_id)}
						<div class="flex items-center justify-between py-2">
							<div class="flex items-center gap-2.5">
								<div
									class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
									style="background: {avatarBg(token.symbol ?? '')}"
								>
									{(token.symbol ?? '?').charAt(0).toUpperCase()}
								</div>
								<div>
									<p class="text-[13px] font-semibold text-[#1c1b22]">
										{(token.symbol ?? '').toUpperCase()}
									</p>
									<p class="text-[11px] text-[#888780]">{token.name}</p>
								</div>
							</div>
							<div class="text-right">
								<p class="text-[13px] font-medium text-[#1c1b22]">
									{token.price != null
										? token.price >= 1000
											? `$${token.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
											: `$${token.price.toFixed(token.price < 1 ? 4 : 2)}`
										: '—'}
								</p>
								{#if token.change24h != null}
									<span
										class="text-[11px] font-medium"
										style="color: {token.change24h >= 0 ? '#0F6E56' : '#993C1D'}"
										>{formatPct(token.change24h)}</span
									>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
			<div class="mt-2 border-t border-[#f0f0f0] pt-2">
				<a href="/draft" class="text-xs font-medium text-[#534ab7] no-underline hover:underline"
					>Draft a token from this list →</a
				>
			</div>
		</section>

		<!-- Scout Report (News) -->
		<section class="rounded-xl border border-black/10 bg-white px-3.5 py-3">
			<div class="mb-2.5 flex items-center justify-between">
				<h3 class="text-[11px] font-medium text-[#888780] uppercase">Scout Report</h3>
				<small class="text-[11px] text-[#888780]">Live Feed</small>
			</div>
			{#if loading}
				<p class="text-xs text-[#888780]">Loading news...</p>
			{:else if news.length === 0}
				<p class="text-xs text-[#888780]">No news available.</p>
			{:else}
				<div class="flex flex-col divide-y divide-[#f0f0f0]">
					{#each news as item, i (i)}
						<div class="flex gap-2 py-2">
							<div class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#534ab7]"></div>
							<div>
								<p class="text-[13px] leading-snug font-medium text-[#1c1b22]">
									{item.title ?? 'Market update'}
								</p>
								<p class="text-[11px] text-[#888780]">
									{item.source ?? 'SoSoValue'}{item.date ? ` · ${item.date}` : ''}
								</p>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>

	<section class="rounded-xl border border-black/10 bg-white px-3.5 py-3">
		<div class="mb-3 flex items-center justify-between">
			<h3 class="text-[11px] font-medium text-[#888780] uppercase">My Contests</h3>
			<div class="flex gap-1.5">
				<button
					class="h-7 cursor-pointer rounded-lg border-0 bg-[#eeedfe] px-3 text-[12px] font-medium text-[#534ab7]"
					onclick={() => createContest('daily')}>+ Daily</button
				>
				<button
					class="h-7 cursor-pointer rounded-lg border-0 bg-[#fef3c7] px-3 text-[12px] font-medium text-[#d97706]"
					onclick={() => createContest('weekly')}>+ Weekly</button
				>
			</div>
		</div>
		{#if actionError}
			<p class="mb-2 text-[11px] text-[#993c1d]">{actionError}</p>
		{/if}
		{#if loading}
			<p class="text-xs text-[#888780]">Loading...</p>
		{:else if contests.length === 0}
			<p class="text-xs text-[#888780]">No contests yet. Hit "New Draft" to start.</p>
		{:else}
			<div class="flex flex-col divide-y divide-[#f0f0f0]">
				{#each contests as c, i (c.id ?? i)}
					<div class="flex items-center justify-between py-2.5">
						<div class="flex items-center gap-2.5">
							{#if c.status === 'resolved'}
								<span
									class="rounded-full bg-[#ececec] px-2 py-0.5 text-[10px] font-medium text-[#666]"
									>Resolved</span
								>
							{:else if c.status === 'live'}
								<span
									class="rounded-full bg-[#e1f5ee] px-2 py-0.5 text-[10px] font-medium text-[#0f6e56]"
									>Live</span
								>
							{:else}
								<span
									class="rounded-full bg-[#fef3c7] px-2 py-0.5 text-[10px] font-medium text-[#d97706]"
									>Open</span
								>
							{/if}
							<span class="text-[13px] text-[#333]"
								>{c.type === 'weekly' ? 'Weekly' : 'Daily'} Contest</span
							>
							<span class="text-[11px] text-[#888780]">{String(c.id ?? '').slice(0, 8)}…</span>
						</div>
						{#if c.status === 'resolved'}
							<a
								href={`/contest/result?contestId=${c.id}`}
								class="h-7 rounded-lg bg-[#f0eff8] px-3 text-[12px] leading-7 font-medium text-[#534ab7] no-underline"
								>View Result</a
							>
						{:else}
							<a
								href={`/draft?contestId=${c.id}&type=${c.type ?? 'daily'}`}
								class="h-7 rounded-lg bg-[#534ab7] px-3 text-[12px] leading-7 font-medium text-[#eeedfe] no-underline"
								>Continue Draft</a
							>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>
