<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { toast } from '$lib/toast';
	import Toast from '$lib/components/Toast.svelte';
	import { BADGE_MAP } from '$lib/badges';

	let result = $state({
		status: 'YOU WON',
		xp: 250,
		yourScore: 1482,
		opponentScore: 1215,
		isPaper: false
	});

	let breakdown = $state([
		{ sector: 'L1', pick: 'SOL', pct: 8.4, opponent: 'ETH (+1.2%)', points: 420 },
		{ sector: 'Meme', pick: 'PEPE', pct: 15.2, opponent: 'DOGE (-2.1%)', points: 612 },
		{ sector: 'DeFi', pick: 'AAVE', pct: 3.1, opponent: 'UNI (+4.5%)', points: 180 },
		{ sector: 'L2', pick: 'ARB', pct: -1.4, opponent: 'OP (-0.8%)', points: 85 },
		{ sector: 'Wild', pick: 'RNDR', pct: 5.7, opponent: 'TAO (+2.2%)', points: 185 }
	]);
	let loading = $state(true);
	let error = $state('');
	let aiBreakdown = $state('');
	let aiLoading = $state(false);
	let contestId = $state('');

	onMount(async () => {
		const params = new URLSearchParams(window.location.search);
		contestId = params.get('contestId') ?? '';

		if (!contestId) {
			loading = false;
			return;
		}

		try {
			const res = await fetch(`/api/contest/${contestId}/result`);
			if (!res.ok) throw new Error('Failed to load contest result');
			const data = await res.json();
			result = {
				status: data.status,
				xp: data.xp,
				yourScore: data.yourScore,
				opponentScore: data.opponentScore,
				isPaper: Boolean(data.isPaper)
			};
			if (Array.isArray(data.breakdown) && data.breakdown.length > 0) {
				breakdown = data.breakdown;
			}
			// Fetch AI breakdown after picks are loaded
			fetchAiBreakdown(data.breakdown ?? breakdown, data.status ?? result.status);

			if (Array.isArray(data.newBadges)) {
				for (const code of data.newBadges) {
					const badge = BADGE_MAP.get(code);
					if (badge) toast(`${badge.emoji} Badge unlocked: ${badge.name}`, 'success');
				}
			}
		} catch (e: any) {
			error = e.message ?? 'Could not load result';
		} finally {
			loading = false;
		}
	});

	async function fetchAiBreakdown(picks: typeof breakdown, status: string) {
		aiLoading = true;
		try {
			const res = await fetch('/api/breakdown', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ picks, status })
			});
			if (res.ok) {
				const data = await res.json();
				aiBreakdown = data.breakdown ?? '';
			}
		} catch {
			// Non-fatal — fall back to static text below
		} finally {
			aiLoading = false;
		}
	}

	function pctClass(value: number) {
		return value >= 0 ? 'text-positive font-medium' : 'text-negative font-medium';
	}
</script>

<div class="flex flex-col gap-3">
	<header class="rounded-xl border border-border bg-surface px-3 py-2.5">
		<a class="text-[13px] text-text-secondary no-underline" href="/dashboard">← Exit Result</a>
	</header>

	{#if loading}
		<section class="rounded-xl border border-border bg-surface px-3.5 py-3">
			<p class="mt-1 text-xs opacity-90">Resolving contest and computing scores...</p>
		</section>
	{:else if error}
		<section class="rounded-xl border border-border bg-surface px-3.5 py-3">
			<p class="mt-1 text-xs opacity-90">{error}</p>
		</section>
	{/if}

	<section
		class="flex flex-col gap-3.5 rounded-xl bg-positive p-4 text-white"
		class:bg-negative={result.status === 'YOU LOST'}
	>
		<div>
			<div class="flex items-center gap-2">
				<p class="text-[11px] uppercase opacity-85">Match Result</p>
				{#if result.isPaper}
					<span class="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase"
						>Practice mode</span
					>
				{/if}
			</div>
			<h1 class="text-[40px] leading-none font-medium max-[760px]:text-[30px]">{result.status}</h1>
			{#if !result.isPaper}
				<p class="mt-1 text-xs opacity-90">League Record: 12-4-0</p>
			{/if}
		</div>
		<div class="w-fit rounded-lg bg-white/15 px-3 py-2 text-base font-medium">
			+{result.xp} {result.isPaper ? 'practice XP (not counted toward real XP)' : 'XP earned'}
		</div>
		<div class="flex items-center gap-6 max-[760px]:gap-3.5">
			<div>
				<small class="text-[11px] uppercase opacity-80">Your Score</small>
				<h2 class="text-[36px] leading-[1.1] font-medium max-[760px]:text-[28px]">
					{result.yourScore.toLocaleString()}
				</h2>
			</div>
			<p>VS</p>
			<div>
				<small class="text-[11px] uppercase opacity-80">Opponent</small>
				<h2 class="text-[36px] leading-[1.1] font-medium max-[760px]:text-[28px]">
					{result.opponentScore.toLocaleString()}
				</h2>
			</div>
		</div>
	</section>

	<section class="rounded-xl border border-border bg-surface px-3.5 py-3">
		<div class="mb-2 flex items-center justify-between">
			<h3 class="text-[11px] font-medium text-text-muted uppercase">Picks Breakdown</h3>
			<small class="text-[11px] text-text-muted">Daily Contest</small>
		</div>
		<table class="w-full border-collapse text-xs max-[760px]:block">
			<thead>
				<tr>
					<th
						class="border-b border-border px-1.5 py-2.5 text-left text-[10px] text-text-muted uppercase max-[760px]:hidden"
						>Sector</th
					>
					<th
						class="border-b border-border px-1.5 py-2.5 text-left text-[10px] text-text-muted uppercase max-[760px]:hidden"
						>Your Pick</th
					>
					<th
						class="border-b border-border px-1.5 py-2.5 text-left text-[10px] text-text-muted uppercase max-[760px]:hidden"
						>24h %</th
					>
					<th
						class="border-b border-border px-1.5 py-2.5 text-left text-[10px] text-text-muted uppercase max-[760px]:hidden"
						>vs Opponent</th
					>
					<th
						class="border-b border-border px-1.5 py-2.5 text-left text-[10px] text-text-muted uppercase max-[760px]:hidden"
						>Pts</th
					>
				</tr>
			</thead>
			<tbody class="max-[760px]:block">
				{#each breakdown as row, i (`${row.sector}-${row.pick}-${i}`)}
					<tr
						class="max-[760px]:mb-2 max-[760px]:block max-[760px]:rounded-lg max-[760px]:border max-[760px]:border-border max-[760px]:p-2"
					>
						<td
							class="border-b border-border px-1.5 py-2.5 text-left max-[760px]:block max-[760px]:border-none max-[760px]:px-0 max-[760px]:py-0.5"
							><span
								class="rounded-full bg-primary-muted px-2 py-0.5 text-[10px] font-medium text-primary"
								>{row.sector}</span
							></td
						>
						<td
							class="border-b border-border px-1.5 py-2.5 text-left max-[760px]:block max-[760px]:border-none max-[760px]:px-0 max-[760px]:py-0.5"
							>{row.pick}</td
						>
						<td
							class={`border-b border-border px-1.5 py-2.5 text-left max-[760px]:block max-[760px]:border-none max-[760px]:px-0 max-[760px]:py-0.5 ${pctClass(row.pct)}`}
							>{row.pct >= 0 ? '+' : ''}{row.pct}%</td
						>
						<td
							class="border-b border-border px-1.5 py-2.5 text-left max-[760px]:block max-[760px]:border-none max-[760px]:px-0 max-[760px]:py-0.5"
							>{row.opponent}</td
						>
						<td
							class="border-b border-border px-1.5 py-2.5 text-left max-[760px]:block max-[760px]:border-none max-[760px]:px-0 max-[760px]:py-0.5"
							>+{row.points}</td
						>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

	<section class="rounded-xl border border-border bg-surface px-3.5 py-3">
		<div class="mb-2 flex items-center justify-between">
			<h3 class="text-[11px] font-medium text-text-muted uppercase">AI Match Breakdown</h3>
			<small class="text-[10px] text-text-muted">Powered by SoSoValue + Groq</small>
		</div>
		{#if aiLoading}
			<div class="mt-2 h-4 w-3/4 animate-pulse rounded bg-surface-raised"></div>
			<div class="mt-1.5 h-4 w-full animate-pulse rounded bg-surface-raised"></div>
			<div class="mt-1.5 h-4 w-2/3 animate-pulse rounded bg-surface-raised"></div>
		{:else}
			<p class="mt-2 text-sm leading-[1.6] text-text-secondary">
				{aiBreakdown ||
					'Sector momentum and price performance drove your result. Review your picks above to refine your next draft strategy.'}
			</p>
		{/if}
	</section>

	{#if !result.isPaper && contestId && page.data.user?.id}
		<a
			href={`/share/${contestId}?u=${page.data.user.id}`}
			target="_blank"
			rel="noopener noreferrer"
			class="grid h-11 place-items-center rounded-lg border border-border bg-surface text-[13px] font-medium text-primary no-underline"
			>Share Result</a
		>
	{/if}

	<section class="grid grid-cols-2 gap-2.5 max-[760px]:grid-cols-1">
		<a
			href="/dashboard"
			class="grid h-11 place-items-center rounded-lg border border-border bg-surface text-[13px] font-medium text-text-secondary no-underline"
			>View League Standings</a
		>
		<a
			href="/draft"
			class="grid h-11 place-items-center rounded-lg bg-primary text-[13px] font-medium text-white no-underline"
			>Draft Again</a
		>
	</section>
</div>

<Toast />
