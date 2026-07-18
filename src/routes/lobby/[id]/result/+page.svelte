<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { toast } from '$lib/toast';
	import Toast from '$lib/components/Toast.svelte';
	import { BADGE_MAP } from '$lib/badges';

	type Row = { rank: number; username: string; score: number; xpEarned: number; isMe: boolean };
	type PickRow = { sector: string; pick: string; pct: number; points: number };

	let leaderboard = $state<Row[]>([]);
	let breakdown = $state<PickRow[]>([]);
	let myRank = $state<number | null>(null);
	let myXp = $state(0);
	let loading = $state(true);
	let error = $state('');

	onMount(async () => {
		const lobbyId = page.params.id;
		try {
			const res = await fetch(`/api/lobby/${lobbyId}/result`);
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.error ?? 'Failed to load lobby result');
			}
			const data = await res.json();
			leaderboard = data.leaderboard ?? [];
			breakdown = data.breakdown ?? [];
			myRank = data.myRank ?? null;
			myXp = data.myXp ?? 0;

			if (Array.isArray(data.newBadges)) {
				for (const code of data.newBadges) {
					const badge = BADGE_MAP.get(code);
					if (badge) toast(`${badge.emoji} Badge unlocked: ${badge.name}`, 'success');
				}
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not load result';
		} finally {
			loading = false;
		}
	});

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
			<p class="mt-1 text-xs opacity-90">Resolving lobby and computing scores...</p>
		</section>
	{:else if error}
		<section class="rounded-xl border border-border bg-surface px-3.5 py-3">
			<p class="mt-1 text-xs opacity-90">{error}</p>
		</section>
	{:else}
		<section class="flex flex-col gap-3.5 rounded-xl bg-sector-defi p-4 text-white">
			<div>
				<p class="text-[11px] uppercase opacity-85">Lobby Result</p>
				<h1 class="text-[40px] leading-none font-medium max-[760px]:text-[30px]">
					{myRank === 1 ? 'YOU WON' : `#${myRank ?? '—'} PLACE`}
				</h1>
			</div>
			<div class="w-fit rounded-lg bg-white/15 px-3 py-2 text-base font-medium">
				+{myXp} XP earned
			</div>
		</section>

		<section class="rounded-xl border border-border bg-surface px-3.5 py-3">
			<div class="mb-2 flex items-center justify-between">
				<h3 class="text-[11px] font-medium text-text-muted uppercase">Standings</h3>
				<small class="text-[11px] text-text-muted">{leaderboard.length} players</small>
			</div>
			<div class="flex flex-col divide-y divide-border">
				{#each leaderboard as row (row.username + row.rank)}
					<div
						class="grid grid-cols-12 items-center gap-2 py-2.5 {row.isMe ? 'bg-primary-muted' : ''}"
					>
						<div class="col-span-1 text-sm font-bold {row.rank <= 3 ? 'text-primary' : 'text-text-muted'}">
							{#if row.rank === 1}
								🥇
							{:else if row.rank === 2}
								🥈
							{:else if row.rank === 3}
								🥉
							{:else}
								{row.rank}
							{/if}
						</div>
						<div class="col-span-6 text-sm font-medium text-text">
							{row.username}{row.isMe ? ' (you)' : ''}
						</div>
						<div class="col-span-2 text-right text-sm text-text">{row.score.toLocaleString()}</div>
						<div class="col-span-3 text-right text-sm font-bold text-text">+{row.xpEarned} XP</div>
					</div>
				{/each}
			</div>
		</section>

		<section class="rounded-xl border border-border bg-surface px-3.5 py-3">
			<h3 class="mb-2 text-[11px] font-medium text-text-muted uppercase">Your Picks Breakdown</h3>
			<table class="w-full border-collapse text-xs">
				<thead>
					<tr>
						<th class="border-b border-border px-1.5 py-2.5 text-left text-[10px] text-text-muted uppercase"
							>Sector</th
						>
						<th class="border-b border-border px-1.5 py-2.5 text-left text-[10px] text-text-muted uppercase"
							>Your Pick</th
						>
						<th class="border-b border-border px-1.5 py-2.5 text-left text-[10px] text-text-muted uppercase"
							>24h %</th
						>
						<th class="border-b border-border px-1.5 py-2.5 text-left text-[10px] text-text-muted uppercase"
							>Pts</th
						>
					</tr>
				</thead>
				<tbody>
					{#each breakdown as row, i (`${row.sector}-${row.pick}-${i}`)}
						<tr>
							<td class="border-b border-border px-1.5 py-2.5"
								><span class="rounded-full bg-primary-muted px-2 py-0.5 text-[10px] font-medium text-primary"
									>{row.sector}</span
								></td
							>
							<td class="border-b border-border px-1.5 py-2.5">{row.pick}</td>
							<td class={`border-b border-border px-1.5 py-2.5 ${pctClass(row.pct)}`}
								>{row.pct >= 0 ? '+' : ''}{row.pct}%</td
							>
							<td class="border-b border-border px-1.5 py-2.5">+{row.points}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

		<section class="grid grid-cols-2 gap-2.5 max-[760px]:grid-cols-1">
			<a
				href="/dashboard"
				class="grid h-11 place-items-center rounded-lg border border-border bg-surface text-[13px] font-medium text-text-secondary no-underline"
				>Back to Dashboard</a
			>
			<a
				href="/lobby"
				class="grid h-11 place-items-center rounded-lg bg-primary text-[13px] font-medium text-white no-underline"
				>Join Another Lobby</a
			>
		</section>
	{/if}
</div>

<Toast />
