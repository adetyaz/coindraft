<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Toast from '$lib/components/Toast.svelte';
	import { toast } from '$lib/toast';

	type Member = {
		id: string;
		userId: string;
		username: string;
		wins: number;
		losses: number;
		points: number;
		joinedAt: string;
	};

	type League = {
		id: string;
		name: string;
		type: string;
		inviteCode: string | null;
		seasonStart: string;
		seasonEnd: string;
	};

	let league = $state<League | null>(null);
	let members = $state<Member[]>([]);
	let loading = $state(true);

	onMount(async () => {
		const id = page.params.id;
		try {
			const res = await fetch(`/api/leagues/${id}`);
			if (res.ok) {
				const data = await res.json();
				league = data.league;
				members = data.members;
			} else {
				toast('League not found', 'error');
				goto('/leagues');
			}
		} catch {
			toast('Failed to load league', 'error');
		} finally {
			loading = false;
		}
	});

	function copyInviteCode() {
		if (league?.inviteCode) {
			navigator.clipboard.writeText(league.inviteCode);
			toast('Invite code copied!', 'success');
		}
	}
</script>

<div class="min-h-screen bg-[#F8F8F7]">
	<div class="mx-auto max-w-4xl px-4 py-6">
		{#if loading}
			<div class="h-32 animate-pulse rounded-xl bg-white shadow-sm"></div>
		{:else if league}
			<!-- Header -->
			<div class="mb-6 rounded-xl border border-black/5 bg-white p-5 shadow-sm">
				<div class="flex items-start justify-between">
					<div>
						<h1 class="text-xl font-semibold text-[#1c1b22]">{league.name}</h1>
						<p class="text-sm text-[#888780]">
							{league.type} · {members.length} members · Season ends {new Date(
								league.seasonEnd
							).toLocaleDateString()}
						</p>
					</div>
					{#if league.inviteCode}
						<button
							onclick={copyInviteCode}
							class="rounded-lg bg-[#EEEDFE] px-3 py-1.5 text-xs font-bold tracking-wider text-[#534AB7] uppercase transition-colors hover:bg-[#dddaf8]"
						>
							Copy Code: {league.inviteCode}
						</button>
					{/if}
				</div>
			</div>

			<!-- Standings -->
			<div class="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
				<div class="border-b border-black/5 px-5 py-3">
					<h2 class="text-sm font-semibold text-[#1c1b22]">Standings</h2>
				</div>
				{#if members.length === 0}
					<p class="px-5 py-8 text-center text-sm text-[#888780]">No members yet</p>
				{:else}
					<div class="divide-y divide-black/5">
						<div
							class="grid grid-cols-12 gap-2 px-5 py-2 text-[10px] font-bold tracking-wider text-[#888780] uppercase"
						>
							<div class="col-span-1">#</div>
							<div class="col-span-5">Player</div>
							<div class="col-span-2 text-right">W</div>
							<div class="col-span-2 text-right">L</div>
							<div class="col-span-2 text-right">PTS</div>
						</div>
						{#each members as member, i (member.id)}
							<div
								class="grid grid-cols-12 items-center gap-2 px-5 py-3 {i === 0
									? 'bg-[#EEEDFE]/50'
									: ''}"
							>
								<div class="col-span-1 text-sm font-bold text-[#534AB7]">{i + 1}</div>
								<div class="col-span-5 text-sm font-medium text-[#1c1b22]">{member.username}</div>
								<div class="col-span-2 text-right text-sm text-[#0F6E56]">{member.wins}</div>
								<div class="col-span-2 text-right text-sm text-[#993C1D]">{member.losses}</div>
								<div class="col-span-2 text-right text-sm font-bold text-[#1c1b22]">
									{member.points}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<Toast />
