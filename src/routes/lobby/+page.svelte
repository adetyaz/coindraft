<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import Toast from '$lib/components/Toast.svelte';
	import { toast } from '$lib/toast';

	type OpenLobby = {
		id: string;
		contestType: string;
		size: number | null;
		status: string;
		createdBy: string;
		creatorName: string | null;
		headcount: number;
	};

	type View = 'menu' | 'quick-searching' | 'browse' | 'waiting-room';

	let view = $state<View>('menu');
	let quickSize = $state(4);
	let openLobbies = $state<OpenLobby[]>([]);
	let waitingLobbyId = $state('');
	let waitingHeadcount = $state(1);
	let waitingSize = $state<number | null>(null);
	let isCreator = $state(false);
	let elapsed = $state(0);
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let searchStart = 0;

	const elapsedStr = $derived.by(() => {
		const s = Math.floor(elapsed / 1000);
		return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
	});

	onDestroy(() => {
		if (pollTimer) clearInterval(pollTimer);
	});

	function stopPolling() {
		if (pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
	}

	async function startQuickMatch(size: number) {
		quickSize = size;
		view = 'quick-searching';
		searchStart = Date.now();
		elapsed = 0;

		const res = await fetch('/api/lobby/queue/join', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ size, type: 'daily' })
		});
		if (res.status === 401) {
			window.location.href = '/?auth=required';
			return;
		}
		const data = await res.json();
		if (data.status === 'matched') {
			toast('Lobby filled — heading to draft!', 'success');
			goto(`/draft?lobbyId=${data.lobbyId}`);
			return;
		}

		pollTimer = setInterval(async () => {
			elapsed = Date.now() - searchStart;
			const r = await fetch('/api/lobby/queue/status');
			const d = await r.json();
			if (d.status === 'matched') {
				stopPolling();
				toast('Lobby filled — heading to draft!', 'success');
				goto(`/draft?lobbyId=${d.lobbyId}`);
			}
		}, 3000);
	}

	async function cancelQuickMatch() {
		stopPolling();
		await fetch('/api/lobby/queue/leave', { method: 'POST' });
		view = 'menu';
	}

	async function loadOpenLobbies() {
		const res = await fetch('/api/lobby?status=waiting');
		if (res.ok) openLobbies = await res.json();
	}

	async function showBrowse() {
		view = 'browse';
		await loadOpenLobbies();
	}

	async function createOpenLobby() {
		const res = await fetch('/api/lobby', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ contestType: 'daily' })
		});
		if (res.status === 401) {
			window.location.href = '/?auth=required';
			return;
		}
		const data = await res.json();
		isCreator = true;
		enterWaitingRoom(data.id, data.size);
	}

	async function joinOpenLobby(lobbyId: string, size: number | null) {
		const res = await fetch(`/api/lobby/${lobbyId}/join`, { method: 'POST' });
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			toast(err.error ?? 'Failed to join lobby', 'error');
			return;
		}
		isCreator = false;
		enterWaitingRoom(lobbyId, size);
	}

	function enterWaitingRoom(lobbyId: string, size: number | null) {
		waitingLobbyId = lobbyId;
		waitingSize = size;
		view = 'waiting-room';
		pollWaitingRoom();
		pollTimer = setInterval(pollWaitingRoom, 3000);
	}

	async function pollWaitingRoom() {
		const res = await fetch('/api/lobby?status=waiting');
		if (!res.ok) return;
		const list: OpenLobby[] = await res.json();
		const mine = list.find((l) => l.id === waitingLobbyId);
		if (mine) {
			waitingHeadcount = mine.headcount;
			return;
		}
		// No longer in the "waiting" list — either it started or errored out
		stopPolling();
		toast('Lobby started — heading to draft!', 'success');
		goto(`/draft?lobbyId=${waitingLobbyId}`);
	}

	async function startLobby() {
		const res = await fetch(`/api/lobby/${waitingLobbyId}/start`, { method: 'POST' });
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			toast(err.error ?? 'Failed to start lobby', 'error');
			return;
		}
	}

	function leaveWaitingRoom() {
		stopPolling();
		view = 'menu';
	}
</script>

<div class="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
	<div>
		<h1 class="text-lg font-semibold text-text">Multiplayer Lobbies</h1>
		<p class="mt-0.5 text-xs text-text-muted">Compete against 3 or more players in one ranked contest.</p>
	</div>

	{#if view === 'menu'}
		<section class="rounded-xl border border-border bg-surface px-4 py-3.5">
			<h3 class="mb-2 text-[11px] font-medium text-text-muted uppercase">Quick Match</h3>
			<p class="mb-3 text-xs text-text-muted">Pick a lobby size — we'll auto-match you once it fills.</p>
			<div class="flex gap-2">
				{#each [4, 6, 8] as size (size)}
					<button
						class="flex-1 cursor-pointer rounded-lg border border-border bg-surface-raised py-3 text-sm font-semibold text-text transition hover:border-primary hover:text-primary"
						onclick={() => startQuickMatch(size)}
					>
						{size} Players
					</button>
				{/each}
			</div>
		</section>

		<section class="rounded-xl border border-border bg-surface px-4 py-3.5">
			<h3 class="mb-2 text-[11px] font-medium text-text-muted uppercase">Open Lobbies</h3>
			<p class="mb-3 text-xs text-text-muted">
				Create a lobby and invite friends, or join one that's still filling up.
			</p>
			<div class="flex gap-2">
				<button
					class="flex-1 cursor-pointer rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
					onclick={createOpenLobby}
				>
					Create Lobby
				</button>
				<button
					class="flex-1 cursor-pointer rounded-lg border border-border bg-transparent py-2.5 text-sm font-semibold text-text-secondary transition hover:bg-hover"
					onclick={showBrowse}
				>
					Browse Open Lobbies
				</button>
			</div>
		</section>
	{:else if view === 'quick-searching'}
		<section class="rounded-xl border border-border bg-surface px-8 py-10 text-center">
			<div class="mb-6 flex justify-center">
				<div class="h-16 w-16 animate-spin rounded-full border-4 border-primary-muted border-t-primary"></div>
			</div>
			<h2 class="mb-2 text-lg font-semibold text-text">Filling a {quickSize}-player lobby...</h2>
			<p class="mb-6 text-sm text-text-muted">{elapsedStr} elapsed</p>
			<button
				onclick={cancelQuickMatch}
				class="w-full cursor-pointer rounded-xl border border-border py-3 text-sm font-semibold text-text-secondary transition hover:bg-hover"
			>
				Cancel
			</button>
		</section>
	{:else if view === 'browse'}
		<section class="rounded-xl border border-border bg-surface px-4 py-3.5">
			<div class="mb-3 flex items-center justify-between">
				<h3 class="text-[11px] font-medium text-text-muted uppercase">Open Lobbies</h3>
				<button class="text-xs font-medium text-primary" onclick={() => (view = 'menu')}>← Back</button>
			</div>
			{#if openLobbies.length === 0}
				<p class="py-6 text-center text-sm text-text-muted">No open lobbies right now — create one.</p>
			{:else}
				<div class="flex flex-col divide-y divide-border">
					{#each openLobbies as lobby (lobby.id)}
						<div class="flex items-center justify-between py-2.5">
							<div>
								<p class="text-sm font-medium text-text">{lobby.creatorName ?? 'Player'}'s lobby</p>
								<p class="text-[11px] text-text-muted">
									{lobby.headcount}{lobby.size ? `/${lobby.size}` : ''} players · {lobby.contestType}
								</p>
							</div>
							<button
								class="cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white"
								onclick={() => joinOpenLobby(lobby.id, lobby.size)}
							>
								Join
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	{:else if view === 'waiting-room'}
		<section class="rounded-xl border border-border bg-surface px-8 py-10 text-center">
			<h2 class="mb-2 text-lg font-semibold text-text">Waiting Room</h2>
			<p class="mb-6 text-sm text-text-muted">
				{waitingHeadcount}{waitingSize ? `/${waitingSize}` : ''} players joined
			</p>
			{#if isCreator}
				<button
					onclick={startLobby}
					disabled={waitingHeadcount < 2}
					class="mb-2.5 w-full cursor-pointer rounded-xl bg-primary py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
				>
					{waitingHeadcount < 2 ? 'Need at least 2 players' : 'Start Lobby'}
				</button>
			{:else}
				<p class="mb-2.5 text-xs text-text-muted">Waiting for the host to start...</p>
			{/if}
			<button
				onclick={leaveWaitingRoom}
				class="w-full cursor-pointer rounded-xl border border-border py-3 text-sm font-semibold text-text-secondary transition hover:bg-hover"
			>
				Leave
			</button>
		</section>
	{/if}
</div>

<Toast />
