<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Toast from '$lib/components/Toast.svelte';
	import { toast } from '$lib/toast';
	import { BADGE_MAP } from '$lib/badges';

	type League = {
		id: string;
		name: string;
		type: string;
		memberCount: number;
		seasonEnd: string;
	};

	let tab = $state<'mine' | 'public'>('mine');
	let myLeagues = $state<League[]>([]);
	let publicLeagues = $state<League[]>([]);
	let loading = $state(true);
	let showCreate = $state(false);
	let showJoin = $state(false);
	let newLeagueName = $state('');
	let newLeagueType = $state<'public' | 'private'>('public');
	let inviteCode = $state('');

	onMount(loadLeagues);

	async function loadLeagues() {
		loading = true;
		try {
			const res = await fetch('/api/leagues');
			if (res.ok) {
				const data = await res.json();
				myLeagues = data.mine || [];
				publicLeagues = data.public || [];
			}
		} catch {
			toast('Failed to load leagues', 'error');
		} finally {
			loading = false;
		}
	}

	async function createLeague() {
		if (!newLeagueName.trim()) return;
		try {
			const res = await fetch('/api/leagues', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newLeagueName.trim(), type: newLeagueType })
			});
			if (res.ok) {
				const data = await res.json();
				showCreate = false;
				newLeagueName = '';
				await loadLeagues();
				if (Array.isArray(data.newBadges)) {
					for (const code of data.newBadges) {
						const badge = BADGE_MAP.get(code);
						if (badge) toast(`${badge.emoji} Badge unlocked: ${badge.name}`, 'success');
					}
				}
				goto(`/leagues/${data.id}`);
			} else {
				const err = await res.json();
				toast(err.error || 'Failed to create league', 'error');
			}
		} catch {
			toast('Failed to create league', 'error');
		}
	}

	async function joinLeague() {
		if (!inviteCode.trim()) return;
		try {
			const res = await fetch('/api/leagues/join', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ inviteCode: inviteCode.trim() })
			});
			if (res.ok) {
				const data = await res.json();
				showJoin = false;
				inviteCode = '';
				await loadLeagues();
				goto(`/leagues/${data.leagueId}`);
			} else {
				const err = await res.json();
				toast(err.error || 'Failed to join league', 'error');
			}
		} catch {
			toast('Failed to join league', 'error');
		}
	}
</script>

<div class="min-h-screen bg-bg">
	<div class="mx-auto max-w-4xl px-4 py-6">
		<!-- Header -->
		<div class="mb-6 flex items-center justify-between">
			<div>
				<h1 class="text-xl font-semibold text-text">Leagues</h1>
				<p class="text-sm text-text-muted">Create or join a league and compete all season</p>
			</div>
			<div class="flex gap-2">
				<button
					onclick={() => (showJoin = true)}
					class="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface"
				>
					Join
				</button>
				<button
					onclick={() => (showCreate = true)}
					class="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
				>
					Create League
				</button>
			</div>
		</div>

		<!-- Tabs -->
		<div class="mb-4 flex gap-1 rounded-xl bg-surface p-1 shadow-sm">
			<button
				onclick={() => (tab = 'mine')}
				class="flex-1 rounded-lg py-2 text-sm font-semibold transition-all {tab === 'mine'
					? 'bg-primary text-white'
					: 'text-text-muted hover:text-text'}"
			>
				My Leagues ({myLeagues.length})
			</button>
			<button
				onclick={() => (tab = 'public')}
				class="flex-1 rounded-lg py-2 text-sm font-semibold transition-all {tab === 'public'
					? 'bg-primary text-white'
					: 'text-text-muted hover:text-text'}"
			>
				Browse Public
			</button>
		</div>

		<!-- League List -->
		{#if loading}
			<div class="flex flex-col gap-3">
				{#each [0, 1, 2] as i (i)}
					<div class="h-24 animate-pulse rounded-xl bg-surface shadow-sm"></div>
				{/each}
			</div>
		{:else}
			{@const list = tab === 'mine' ? myLeagues : publicLeagues}
			{#if list.length === 0}
				<div class="rounded-xl border border-border bg-surface p-10 text-center shadow-sm">
					<p class="text-sm text-text-muted">
						{tab === 'mine'
							? "You haven't joined any leagues yet."
							: 'No public leagues available.'}
					</p>
				</div>
			{:else}
				<div class="flex flex-col gap-3">
					{#each list as league (league.id)}
						<button
							onclick={() => goto(`/leagues/${league.id}`)}
							class="flex items-center justify-between rounded-xl border border-border bg-surface p-4 text-left shadow-sm transition-all hover:shadow-md"
						>
							<div>
								<h3 class="text-sm font-semibold text-text">{league.name}</h3>
								<p class="text-[11px] text-text-muted">
									{league.memberCount} members · Season ends {new Date(
										league.seasonEnd
									).toLocaleDateString()}
								</p>
							</div>
							<span
								class="rounded-full bg-primary-muted px-2.5 py-1 text-[10px] font-bold text-primary uppercase"
							>
								{league.type}
							</span>
						</button>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>

<!-- Create Modal -->
{#if showCreate}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
		<div class="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl">
			<h2 class="mb-4 text-lg font-semibold text-text">Create League</h2>
			<div class="mb-4">
				<label for="league-name" class="mb-1 block text-xs font-medium text-text-muted"
					>League Name</label
				>
				<input
					id="league-name"
					type="text"
					bind:value={newLeagueName}
					placeholder="e.g. Solana Maxis"
					class="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
				/>
			</div>
			<div class="mb-6">
				<label for="league-type" class="mb-1 block text-xs font-medium text-text-muted">Type</label>
				<div class="flex gap-2">
					<button
						onclick={() => (newLeagueType = 'public')}
						class="flex-1 rounded-lg border py-2 text-sm font-medium transition-all {newLeagueType ===
						'public'
							? 'border-primary bg-primary-muted text-primary'
							: 'border-border text-text-secondary'}"
					>
						Public
					</button>
					<button
						onclick={() => (newLeagueType = 'private')}
						class="flex-1 rounded-lg border py-2 text-sm font-medium transition-all {newLeagueType ===
						'private'
							? 'border-primary bg-primary-muted text-primary'
							: 'border-border text-text-secondary'}"
					>
						Private
					</button>
				</div>
			</div>
			<div class="flex gap-2">
				<button
					onclick={() => (showCreate = false)}
					class="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-text-secondary hover:bg-hover"
				>
					Cancel
				</button>
				<button
					onclick={createLeague}
					disabled={!newLeagueName.trim()}
					class="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all {newLeagueName.trim()
						? 'bg-primary hover:bg-primary-hover'
						: 'cursor-not-allowed bg-hover'}"
				>
					Create
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Join Modal -->
{#if showJoin}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
		<div class="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl">
			<h2 class="mb-4 text-lg font-semibold text-text">Join League</h2>
			<div class="mb-6">
				<label for="invite-code" class="mb-1 block text-xs font-medium text-text-muted"
					>Invite Code</label
				>
				<input
					id="invite-code"
					type="text"
					bind:value={inviteCode}
					placeholder="Enter 6-character code"
					class="w-full rounded-lg border border-border px-3 py-2 text-sm uppercase outline-none focus:border-primary"
				/>
			</div>
			<div class="flex gap-2">
				<button
					onclick={() => (showJoin = false)}
					class="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-text-secondary hover:bg-hover"
				>
					Cancel
				</button>
				<button
					onclick={joinLeague}
					disabled={!inviteCode.trim()}
					class="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all {inviteCode.trim()
						? 'bg-primary hover:bg-primary-hover'
						: 'cursor-not-allowed bg-hover'}"
				>
					Join
				</button>
			</div>
		</div>
	</div>
{/if}

<Toast />
