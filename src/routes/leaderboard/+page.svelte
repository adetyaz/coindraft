<script lang="ts">
	import { onMount } from 'svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { toast } from '$lib/toast';

	type LeaderboardRow = {
		rank: number;
		id: string;
		username: string;
		walletShort: string;
		xp: number;
		streak: number;
		isMe: boolean;
	};

	let rows = $state<LeaderboardRow[]>([]);
	let loading = $state(true);

	onMount(async () => {
		try {
			const res = await fetch('/api/leaderboard');
			if (res.ok) {
				rows = await res.json();
			}
		} catch {
			toast('Failed to load leaderboard', 'error');
		} finally {
			loading = false;
		}
	});
</script>

<div class="min-h-screen bg-bg">
	<div class="mx-auto max-w-3xl px-4 py-6">
		<div class="mb-6">
			<h1 class="text-xl font-semibold text-text">Global Leaderboard</h1>
			<p class="text-sm text-text-muted">Top players ranked by XP</p>
		</div>

		<div class="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
			{#if loading}
				<div class="p-8">
					<div class="mb-2 h-8 animate-pulse rounded bg-hover"></div>
					<div class="mb-2 h-8 animate-pulse rounded bg-hover"></div>
					<div class="h-8 animate-pulse rounded bg-hover"></div>
				</div>
			{:else if rows.length === 0}
				<p class="px-5 py-8 text-center text-sm text-text-muted">No players yet. Be the first!</p>
			{:else}
				<div class="divide-y divide-border">
					<div
						class="grid grid-cols-12 gap-2 px-5 py-2 text-[10px] font-bold tracking-wider text-text-muted uppercase"
					>
						<div class="col-span-1">#</div>
						<div class="col-span-5">Player</div>
						<div class="col-span-3 text-right">XP</div>
						<div class="col-span-3 text-right">Streak</div>
					</div>
					{#each rows as row (row.id)}
						<div
							class="grid grid-cols-12 items-center gap-2 px-5 py-3 {row.isMe
								? 'bg-primary-muted'
								: ''}"
						>
							<div
								class="col-span-1 text-sm font-bold {row.rank <= 3
									? 'text-primary'
									: 'text-text-muted'}"
							>
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
							<div class="col-span-5">
								<p class="text-sm font-medium text-text">{row.username}</p>
								<p class="text-[11px] text-text-muted">{row.walletShort}</p>
							</div>
							<div class="col-span-3 text-right text-sm font-bold text-text">
								{row.xp.toLocaleString()}
							</div>
							<div class="col-span-3 text-right text-sm text-positive">
								{row.streak > 0 ? `${row.streak} 🔥` : '—'}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<Toast />
