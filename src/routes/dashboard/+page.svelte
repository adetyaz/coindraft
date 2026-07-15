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

	async function createContest(type: 'daily' | 'weekly' = 'daily', mode: 'real' | 'paper' = 'real') {
		actionError = '';
		try {
			const res = await fetch('/api/contests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type, mode })
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
			const modeParam = contest.isPaper ? '&mode=paper' : '';
			window.location.href = `/draft?contestId=${contest.id}&type=${contest.type}${modeParam}`;
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
		const colors = [
			'var(--color-primary)',
			'var(--color-sector-l1)',
			'var(--color-sector-l2)',
			'var(--color-sector-defi)',
			'var(--color-sector-meme)',
			'var(--color-sector-wildcard)'
		];
		let h = 0;
		for (const c of sym) h = (h * 31 + c.charCodeAt(0)) >>> 0;
		return colors[h % colors.length];
	}
</script>

<div class="flex flex-col gap-3">
	<section class="grid grid-cols-3 gap-3 max-[900px]:grid-cols-1">
		<div class="rounded-xl border border-border bg-surface px-3.5 py-3">
			<p class="text-[11px] font-medium text-text-muted uppercase">Active Contests</p>
			<div class="mt-2 flex items-center justify-between gap-2">
				<h2 class="text-[28px] leading-none font-medium text-text">
					{contests.filter((c) => c.status !== 'resolved').length}
				</h2>
				<span class="rounded-full bg-positive/15 px-2 py-0.5 text-[11px] font-medium text-positive"
					>In progress</span
				>
			</div>
		</div>
		<div class="rounded-xl border border-border bg-surface px-3.5 py-3">
			<p class="text-[11px] font-medium text-text-muted uppercase">Resolved Contests</p>
			<div class="mt-2 flex items-center justify-between gap-2">
				<h2 class="text-[28px] leading-none font-medium text-text">{resolvedContests.length}</h2>
				<span class="text-lg">🏁</span>
			</div>
		</div>
		<div class="rounded-xl border border-border bg-surface px-3.5 py-3">
			<p class="text-[11px] font-medium text-text-muted uppercase">Win Rate</p>
			<div class="mt-2 flex items-center justify-between gap-2">
				<h2 class="text-[28px] leading-none font-medium text-text">
					{resolvedContests.length > 0 ? `${winRate}%` : '—'}
				</h2>
				<span class="text-xs text-text-muted">{user?.username ?? 'player'}</span>
			</div>
		</div>
	</section>

	{#if !loading && contests.length === 0}
		<!-- New-user nudge toward Paper Mode -->
		<section class="flex items-center justify-between gap-3 rounded-xl bg-primary-muted p-4">
			<div>
				<h1 class="text-base leading-[1.2] font-semibold text-primary">New here? Try practice mode first</h1>
				<p class="mt-1 text-xs text-text-secondary">
					Draft against a bot with zero stakes — no real XP, just a feel for how scoring works.
				</p>
			</div>
			<button
				class="h-10 shrink-0 cursor-pointer rounded-lg border-0 bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
				onclick={() => createContest('daily', 'paper')}
			>
				Try Practice Mode
			</button>
		</section>
	{/if}

	<!-- Matchmaking CTA -->
	<section class="flex items-center justify-between gap-3 rounded-xl bg-sector-l1 p-4 text-white">
		<div>
			<h1 class="text-xl leading-[1.2] font-medium">Find a Real Opponent</h1>
			<p class="mt-1 text-xs opacity-90">Match against another player in real-time</p>
		</div>
		<button
			class="h-10 cursor-pointer rounded-lg border-0 bg-white px-4 font-medium text-sector-l1 transition-colors hover:bg-white/90"
			onclick={() => goto('/matchmaking')}
		>
			Find Match
		</button>
	</section>

	<div class="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
		<section class="rounded-xl border border-border bg-surface px-3.5 py-3">
			<div class="mb-2.5 flex items-center justify-between">
				<h3 class="text-[11px] font-medium text-text-muted uppercase">Sector Wars</h3>
				<small class="text-[11px] text-text-muted">Live 15m Cache</small>
			</div>
			{#if loading}
				<p class="text-xs text-text-muted">Loading sector data...</p>
			{:else if sectors.length === 0}
				<p class="text-xs text-text-muted">Sector feed unavailable.</p>
			{:else}
				<div class="flex flex-col gap-2">
					{#each sectors as sector, i (sector?.sector ?? sector?.name ?? i)}
						<div class="flex flex-col gap-1">
							<div class="flex justify-between text-[13px] text-text">
								<span>{sector.sector ?? sector.name ?? 'Sector'}</span>
								<span
									class:text-positive={Number(sector.change ?? 0) >= 0}
									class:text-negative={Number(sector.change ?? 0) < 0}
									class="font-medium"
								>
									{formatPct(Number(sector.change ?? 0))}
								</span>
							</div>
							<div class="h-2 overflow-hidden rounded-full bg-border">
								<div
									class="h-full bg-primary"
									style={`width: ${Math.max(8, Math.min(100, Math.abs(Number(sector.change ?? 0)) * 8))}%`}
								></div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<section class="rounded-xl border border-border bg-surface px-3.5 py-3">
			<div class="mb-2.5 flex items-center justify-between">
				<h3 class="text-[11px] font-medium text-text-muted uppercase">Whale Watch</h3>
				<small class="text-[11px] text-text-muted">ETF Flow Alerts</small>
			</div>
			{#if alerts.length === 0}
				<p class="text-xs text-text-muted">No active alerts right now.</p>
			{:else}
				<div class="flex flex-col gap-2">
					{#each alerts.slice(0, 3) as alert, i (alert?.date ?? `${alert?.type ?? 'alert'}-${i}`)}
						<div class="flex gap-2 rounded-lg bg-surface-raised p-2.5">
							<div class="mt-1.5 h-2 w-2 rounded-full bg-primary"></div>
							<div>
								<p class="text-[13px] font-medium text-text">{alert.type} streak detected</p>
								<small class="text-[11px] text-text-muted"
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
	<section class="rounded-xl border border-border bg-surface px-3.5 py-3">
		<div class="mb-2.5 flex items-center justify-between">
			<h3 class="text-[11px] font-medium text-text-muted uppercase">Badges</h3>
			<small class="text-[11px] text-text-muted"
				>{badges.filter((b) => b.earned).length}/{badges.length} unlocked</small
			>
		</div>
		<div class="flex flex-wrap gap-2">
			{#each badges as badge (badge.code)}
				<div
					class="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 {badge.earned
						? 'border-primary/20 bg-primary-muted'
						: 'border-border bg-surface-raised opacity-50'}"
					title={badge.description}
				>
					<span class="text-base {badge.earned ? '' : 'grayscale'}">{badge.emoji}</span>
					<span class="text-xs font-medium {badge.earned ? 'text-primary' : 'text-text-muted'}"
						>{badge.name}</span
					>
				</div>
			{/each}
		</div>
	</section>

	<div class="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
		<!-- Hot Tokens -->
		<section class="rounded-xl border border-border bg-surface px-3.5 py-3">
			<div class="mb-2.5 flex items-center justify-between">
				<h3 class="text-[11px] font-medium text-text-muted uppercase">Hot Tokens</h3>
				<small class="text-[11px] text-text-muted">Top movers</small>
			</div>
			{#if loading}
				<p class="text-xs text-text-muted">Loading tokens...</p>
			{:else if tokens.length === 0}
				<p class="text-xs text-text-muted">Token data unavailable.</p>
			{:else}
				<div class="flex flex-col divide-y divide-border">
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
									<p class="text-[13px] font-semibold text-text">
										{(token.symbol ?? '').toUpperCase()}
									</p>
									<p class="text-[11px] text-text-muted">{token.name}</p>
								</div>
							</div>
							<div class="text-right">
								<p class="text-[13px] font-medium text-text">
									{token.price != null
										? token.price >= 1000
											? `$${token.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
											: `$${token.price.toFixed(token.price < 1 ? 4 : 2)}`
										: '—'}
								</p>
								{#if token.change24h != null}
									<span
										class="text-[11px] font-medium"
										class:text-positive={token.change24h >= 0}
										class:text-negative={token.change24h < 0}
										>{formatPct(token.change24h)}</span
									>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
			<div class="mt-2 border-t border-border pt-2">
				<a href="/draft" class="text-xs font-medium text-primary no-underline hover:underline"
					>Draft a token from this list →</a
				>
			</div>
		</section>

		<!-- Scout Report (News) -->
		<section class="rounded-xl border border-border bg-surface px-3.5 py-3">
			<div class="mb-2.5 flex items-center justify-between">
				<h3 class="text-[11px] font-medium text-text-muted uppercase">Scout Report</h3>
				<small class="text-[11px] text-text-muted">Live Feed</small>
			</div>
			{#if loading}
				<p class="text-xs text-text-muted">Loading news...</p>
			{:else if news.length === 0}
				<p class="text-xs text-text-muted">No news available.</p>
			{:else}
				<div class="flex flex-col divide-y divide-border">
					{#each news as item, i (i)}
						<div class="flex gap-2 py-2">
							<div class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"></div>
							<div>
								<p class="text-[13px] leading-snug font-medium text-text">
									{item.title ?? 'Market update'}
								</p>
								<p class="text-[11px] text-text-muted">
									{item.source ?? 'SoSoValue'}{item.date ? ` · ${item.date}` : ''}
								</p>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>

	<section class="rounded-xl border border-border bg-surface px-3.5 py-3">
		<div class="mb-3 flex items-center justify-between">
			<h3 class="text-[11px] font-medium text-text-muted uppercase">My Contests</h3>
			<div class="flex gap-1.5">
				<button
					class="h-7 cursor-pointer rounded-lg border-0 bg-primary-muted px-3 text-[12px] font-medium text-primary"
					onclick={() => createContest('daily')}>+ Daily</button
				>
				<button
					class="h-7 cursor-pointer rounded-lg border-0 bg-warning/15 px-3 text-[12px] font-medium text-warning"
					onclick={() => createContest('weekly')}>+ Weekly</button
				>
				<button
					class="h-7 cursor-pointer rounded-lg border-0 bg-positive/15 px-3 text-[12px] font-medium text-positive"
					onclick={() => createContest('daily', 'paper')}>+ Practice</button
				>
			</div>
		</div>
		{#if actionError}
			<p class="mb-2 text-[11px] text-negative">{actionError}</p>
		{/if}
		{#if loading}
			<p class="text-xs text-text-muted">Loading...</p>
		{:else if contests.length === 0}
			<p class="text-xs text-text-muted">No contests yet. Hit "New Draft" to start.</p>
		{:else}
			<div class="flex flex-col divide-y divide-border">
				{#each contests as c, i (c.id ?? i)}
					<div class="flex items-center justify-between py-2.5">
						<div class="flex items-center gap-2.5">
							{#if c.status === 'resolved'}
								<span class="rounded-full bg-hover px-2 py-0.5 text-[10px] font-medium text-text-secondary"
									>Resolved</span
								>
							{:else if c.status === 'live'}
								<span class="rounded-full bg-positive/15 px-2 py-0.5 text-[10px] font-medium text-positive"
									>Live</span
								>
							{:else}
								<span class="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning"
									>Open</span
								>
							{/if}
							<span class="text-[13px] text-text"
								>{c.type === 'weekly' ? 'Weekly' : 'Daily'} Contest</span
							>
							{#if c.isPaper}
								<span class="rounded-full bg-positive/15 px-2 py-0.5 text-[10px] font-medium text-positive"
									>Practice</span
								>
							{/if}
							<span class="text-[11px] text-text-muted">{String(c.id ?? '').slice(0, 8)}…</span>
						</div>
						{#if c.status === 'resolved'}
							<a
								href={`/contest/result?contestId=${c.id}`}
								class="h-7 rounded-lg bg-primary-muted px-3 text-[12px] leading-7 font-medium text-primary no-underline"
								>View Result</a
							>
						{:else}
							<a
								href={`/draft?contestId=${c.id}&type=${c.type ?? 'daily'}${c.isPaper ? '&mode=paper' : ''}`}
								class="h-7 rounded-lg bg-primary px-3 text-[12px] leading-7 font-medium text-white no-underline"
								>Continue Draft</a
							>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>
