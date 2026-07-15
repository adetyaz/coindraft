<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import Toast from '$lib/components/Toast.svelte';
	import { toast } from '$lib/toast';

	let status = $state<'idle' | 'searching' | 'matched'>('idle');
	let contestId = $state('');
	let _opponentId = $state('');
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let searchStartTime = $state(0);
	let elapsed = $state(0);

	const elapsedStr = $derived.by(() => {
		const s = Math.floor(elapsed / 1000);
		const m = Math.floor(s / 60);
		return `${m}:${(s % 60).toString().padStart(2, '0')}`;
	});

	onMount(() => {
		startSearch();
	});

	onDestroy(() => {
		if (pollTimer) clearInterval(pollTimer);
	});

	async function startSearch() {
		status = 'searching';
		searchStartTime = Date.now();
		elapsed = 0;

		// Poll elapsed time
		const elapsedTimer = setInterval(() => {
			elapsed = Date.now() - searchStartTime;
		}, 1000);

		// Join queue
		const res = await fetch('/api/matchmaking/join', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'daily' })
		});

		const data = await res.json();
		if (data.status === 'matched') {
			clearInterval(elapsedTimer);
			contestId = data.contestId;
			_opponentId = data.opponentId;
			status = 'matched';
			toast('Opponent found!', 'success');
			setTimeout(() => goto(`/draft?contestId=${contestId}`), 1500);
			return;
		}

		// Poll for match every 3s, with bot fallback after 30s
		pollTimer = setInterval(async () => {
			const elapsedMs = Date.now() - searchStartTime;

			// Bot fallback after 30 seconds
			if (elapsedMs > 30_000) {
				clearInterval(elapsedTimer);
				if (pollTimer) clearInterval(pollTimer);
				pollTimer = null;

				// Create a contest with bot opponent
				const botRes = await fetch('/api/contests', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ type: 'daily' })
				});
				const botData = await botRes.json();
				if (botData.id) {
					contestId = botData.id;
					status = 'matched';
					toast('No opponents online. Matched with bot.', 'success');
					setTimeout(() => goto(`/draft?contestId=${contestId}`), 1500);
				}
				return;
			}

			const pollRes = await fetch('/api/matchmaking/status');
			const pollData = await pollRes.json();
			if (pollData.status === 'matched') {
				clearInterval(elapsedTimer);
				if (pollTimer) clearInterval(pollTimer);
				pollTimer = null;
				contestId = pollData.contestId;
				_opponentId = pollData.opponentId;
				status = 'matched';
				toast('Opponent found!', 'success');
				setTimeout(() => goto(`/draft?contestId=${contestId}`), 1500);
			}
		}, 3000);
	}

	async function cancelSearch() {
		if (pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
		await fetch('/api/matchmaking/leave', { method: 'POST' });
		goto('/dashboard');
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-bg px-4">
	<div class="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
		{#if status === 'searching'}
			<div class="mb-6 flex justify-center">
				<div
					class="h-16 w-16 animate-spin rounded-full border-4 border-primary-muted border-t-primary"
				></div>
			</div>
			<h1 class="mb-2 text-xl font-semibold text-text">Finding your opponent...</h1>
			<p class="mb-6 text-sm text-text-muted">Searching for a player with a similar skill level</p>
			<div
				class="mb-6 inline-flex items-center gap-2 rounded-full bg-hover px-4 py-2 text-sm font-medium text-text-secondary"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
				</svg>
				{elapsedStr}
			</div>
			<p class="mb-6 text-xs text-text-muted">After 30s, you'll be matched with a bot opponent</p>
			<button
				onclick={cancelSearch}
				class="w-full rounded-xl border border-border py-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-hover"
			>
				Cancel
			</button>
		{:else if status === 'matched'}
			<div class="mb-6 flex justify-center">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-positive/15">
					<svg
						class="h-8 w-8 text-positive"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2.5"
					>
						<polyline points="20 6 9 17 4 12" />
					</svg>
				</div>
			</div>
			<h1 class="mb-2 text-xl font-semibold text-text">Opponent found!</h1>
			<p class="mb-6 text-sm text-text-muted">Redirecting to draft...</p>
		{/if}
	</div>
</div>

<Toast />
