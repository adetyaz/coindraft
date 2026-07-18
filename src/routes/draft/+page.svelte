<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { SECTORS } from '$lib/constants';
	import Toast from '$lib/components/Toast.svelte';
	import { toast } from '$lib/toast';

	type Token = {
		currency_id: string;
		symbol?: string;
		name?: string;
		price: number | null;
		change24h: number | null;
		volume24h: number | null;
		rank: number | null;
	};

	type SectorInfo = { id: string; name: string; change: number | null };

	type Pick = {
		currencyId: string;
		symbol: string;
		name: string;
		sector: string;
	};

	// ── State ──────────────────────────────────────────────────────────
	let contestId = $state('');
	let lobbyId = $state('');
	let tokens = $state<Token[]>([]);
	let sectorChanges = $state<Map<string, number | null>>(new Map());
	let lineup = $state<Pick[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let submitting = $state(false);
	let activeSector = $state(SECTORS[0].id);
	let search = $state('');
	let timeLeft = $state(45 * 60);
	let timer: ReturnType<typeof setInterval> | null = null;
	let activeBoosts = $state<Map<string, boolean>>(new Map());
	let highlightId = $state('');
	let contestType = $state<'daily' | 'weekly'>('daily');
	let isPaper = $state(false);

	// ── Sector visual config ───────────────────────────────────────────
	// bg/dimBg are computed tints of the sector color so they adapt to
	// dark/light theme automatically instead of hardcoding per-theme values.
	function sectorStyle(varName: string) {
		return {
			color: `var(--color-sector-${varName})`,
			bg: `color-mix(in oklab, var(--color-sector-${varName}) 18%, transparent)`,
			dimBg: `color-mix(in oklab, var(--color-sector-${varName}) 8%, transparent)`
		};
	}
	const SECTOR_STYLE: Record<string, { color: string; bg: string; dimBg: string }> = {
		l1: sectorStyle('l1'),
		l2: sectorStyle('l2'),
		defi: sectorStyle('defi'),
		meme: sectorStyle('meme'),
		wildcard: sectorStyle('wildcard')
	};

	// ── Lifecycle ──────────────────────────────────────────────────────
	onMount(() => {
		const p = new URLSearchParams(window.location.search);
		contestId = p.get('contestId') ?? '';
		lobbyId = p.get('lobbyId') ?? '';
		highlightId = p.get('highlight') ?? '';
		contestType = p.get('type') === 'weekly' ? 'weekly' : 'daily';
		isPaper = p.get('mode') === 'paper';
		loadData();
		timer = setInterval(() => {
			timeLeft = Math.max(0, timeLeft - 1);
		}, 1000);
	});

	onDestroy(() => {
		if (timer) clearInterval(timer);
	});

	async function loadData() {
		loading = true;
		loadError = '';
		try {
			const [tRes, sRes, meRes] = await Promise.all([
				fetch('/api/tokens'),
				fetch('/api/sectors'),
				fetch('/api/me')
			]);
			if (!tRes.ok) throw new Error('Failed to load tokens');
			tokens = await tRes.json();
			if (highlightId) {
				const match = tokens.find((t) => t.currency_id === highlightId);
				if (match?.symbol) {
					search = match.symbol;
					queueMicrotask(() =>
						document.getElementById('token-pool')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
					);
				}
			}
			if (sRes.ok) {
				const secs: SectorInfo[] = await sRes.json();
				sectorChanges = new Map(secs.map((s) => [s.id, s.change]));
			}
			if (meRes.ok) {
				const me = await meRes.json();
				const boosts: Array<{ sector: string; expiresAt: string }> = me.activeBoosts || [];
				const now = new Date().toISOString();
				const validBoosts = boosts.filter((b) => b.expiresAt > now);
				activeBoosts = new Map(validBoosts.map((b) => [b.sector, true]));
			}
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load data';
		} finally {
			loading = false;
		}
	}

	// ── Derived ────────────────────────────────────────────────────────
	const tokenMap = $derived(new Map(tokens.map((t) => [t.currency_id, t])));

	const filteredTokens = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return tokens.slice(0, 50);
		return tokens
			.filter((t) => t.symbol?.toLowerCase().includes(q) || t.name?.toLowerCase().includes(q))
			.slice(0, 50);
	});

	const slotsFilledCount = $derived(lineup.length);

	const timerStr = $derived.by(() => {
		const m = Math.floor(timeLeft / 60)
			.toString()
			.padStart(2, '0');
		const s = (timeLeft % 60).toString().padStart(2, '0');
		return `${m}:${s}`;
	});

	// ── Helpers ────────────────────────────────────────────────────────
	function pickForSector(id: string): Pick | undefined {
		return lineup.find((p) => p.sector === id);
	}

	function isInLineup(currencyId: string): boolean {
		return lineup.some((p) => p.currencyId === currencyId);
	}

	function selectSector(id: string) {
		activeSector = id;
		document.getElementById('token-pool')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function addToken(token: Token) {
		const sym = (token.symbol ?? token.currency_id).toUpperCase();
		if (isInLineup(token.currency_id)) {
			toast(`${sym} is already in your lineup`, 'error');
			return;
		}
		lineup = [
			...lineup.filter((p) => p.sector !== activeSector),
			{
				currencyId: token.currency_id,
				symbol: token.symbol ?? token.currency_id,
				name: token.name ?? '',
				sector: activeSector
			}
		];
		toast(`${sym} added to ${SECTORS.find((s) => s.id === activeSector)?.name} slot`, 'success');
		const next = SECTORS.find((s) => !lineup.some((p) => p.sector === s.id));
		if (next) activeSector = next.id;
	}

	function removePick(sectorId: string) {
		lineup = lineup.filter((p) => p.sector !== sectorId);
		activeSector = sectorId;
	}

	function fmtChg(v: number | null): string {
		if (v == null) return '—';
		return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
	}

	function fmtVol(v: number | null): string {
		if (v == null) return '—';
		if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
		if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
		if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
		return '$' + v.toFixed(2);
	}

	function fmtPrice(v: number | null): string {
		if (v == null) return '';
		if (v >= 1000) return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 2 });
		if (v >= 1) return '$' + v.toFixed(2);
		return '$' + v.toPrecision(4);
	}

	function avatarBg(sym: string): string {
		const palette = [
			'var(--color-primary)',
			'var(--color-sector-l1)',
			'var(--color-sector-l2)',
			'var(--color-sector-defi)',
			'var(--color-sector-meme)',
			'var(--color-sector-wildcard)'
		];
		let h = 0;
		for (const c of sym) h = (h * 31 + c.charCodeAt(0)) & 0xffffff;
		return palette[Math.abs(h) % palette.length];
	}

	// ── Submit ─────────────────────────────────────────────────────────
	async function submitLineup() {
		if (lineup.length !== 5) {
			toast('Select all 5 slots first — one per sector', 'error');
			return;
		}
		submitting = true;
		try {
			if (lobbyId) {
				const r2 = await fetch(`/api/lobby/${lobbyId}/lineup`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ picks: lineup })
				});
				if (!r2.ok) {
					const errData = await r2.json().catch(() => ({}));
					throw new Error((errData as { error?: string }).error ?? 'Failed to submit lineup');
				}
				window.location.href = `/lobby/${lobbyId}/result`;
				return;
			}

			if (!contestId) {
				const r = await fetch('/api/contests', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ type: 'daily' })
				});
				if (!r.ok) throw new Error('Failed to create contest');
				contestId = (await r.json()).id;
			}

			const r2 = await fetch(`/api/contest/${contestId}/lineup`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ picks: lineup })
			});
			if (!r2.ok) {
				const errData = await r2.json().catch(() => ({}));
				throw new Error((errData as { error?: string }).error ?? 'Failed to submit lineup');
			}
			window.location.href = `/contest/result?contestId=${contestId}`;
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Submit failed', 'error');
		} finally {
			submitting = false;
		}
	}
</script>

<div class="min-h-screen bg-bg">
	<div class="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-6">
		<!-- ── Header ──────────────────────────────────────────────── -->
		<header
			class="flex items-center justify-between rounded-xl border border-border bg-surface px-5 py-4 shadow-sm"
		>
			<div>
				<div class="flex items-center gap-2">
					<h1 class="text-lg leading-tight font-semibold text-text">
						Draft — {lobbyId
							? 'Multiplayer Lobby'
							: contestType === 'weekly'
								? 'Weekly Contest'
								: 'Daily Contest'}
					</h1>
					{#if lobbyId}
						<span
							class="rounded-full bg-sector-defi/15 px-2 py-0.5 text-[10px] font-bold text-sector-defi uppercase"
							>Ranked lobby</span
						>
					{:else if contestType === 'weekly'}
						<span
							class="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning uppercase"
							>7-day · 2x XP</span
						>
					{/if}
					{#if isPaper}
						<span
							class="rounded-full bg-positive/15 px-2 py-0.5 text-[10px] font-bold text-positive uppercase"
							>Practice mode</span
						>
					{/if}
				</div>
				<p class="mt-0.5 text-[11px] font-medium tracking-wider text-text-muted uppercase">
					Strategic Selection Phase
				</p>
			</div>
			<div class="flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1.5 text-warning">
				<svg
					class="h-3.5 w-3.5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
				</svg>
				<span class="text-sm font-bold tabular-nums">{timerStr}</span>
			</div>
		</header>

		<!-- ── VS Bar ──────────────────────────────────────────────── -->
		<div
			class="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-5 py-4 shadow-sm"
		>
			<div class="flex flex-1 items-center gap-3">
				<div class="relative">
					<div
						class="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white"
					>
						YOU
					</div>
					<div
						class="absolute -right-0.5 -bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-surface bg-positive"
					>
						<svg class="h-2 w-2 text-white" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
				</div>
				<div>
					<p class="text-sm font-semibold text-text">You</p>
					<p class="text-[11px] text-text-muted">Rank #42 · 64% Win Rate</p>
				</div>
			</div>
			<span class="text-xs font-bold tracking-widest text-text-muted uppercase opacity-40">vs</span>
			<div class="flex flex-1 items-center justify-end gap-3 text-right">
				<div>
					<p class="text-sm font-semibold text-text">CryptoWhale_88</p>
					<p class="text-[11px] text-text-muted">Rank #12 · 71% Win Rate</p>
				</div>
				<div
					class="flex h-11 w-11 items-center justify-center rounded-full bg-text-secondary text-xs font-semibold text-white"
				>
					CW
				</div>
			</div>
		</div>

		{#if loading}
			<div class="flex flex-col gap-3">
				<div class="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
					{#each [0, 1, 2, 3] as i (i)}
						<div class="h-32 animate-pulse rounded-xl bg-surface shadow-sm"></div>
					{/each}
				</div>
				<div class="h-24 animate-pulse rounded-xl bg-surface shadow-sm"></div>
				<div class="h-105 animate-pulse rounded-xl bg-surface shadow-sm"></div>
			</div>
		{:else if loadError}
			<div
				class="flex items-center gap-3 rounded-xl border border-negative/20 bg-negative/10 px-4 py-3 text-sm text-negative"
			>
				<svg
					class="h-4 w-4 shrink-0"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line
						x1="12"
						y1="16"
						x2="12.01"
						y2="16"
					/>
				</svg>
				<span>{loadError}</span>
				<button onclick={loadData} class="ml-auto underline">Retry</button>
			</div>
		{:else}
			<!-- ── Lineup Slots ──────────────────────────────────── -->
			<section>
				<div class="mb-3 flex items-center justify-between px-0.5">
					<h2 class="text-sm font-semibold text-text">Your Lineup</h2>
					<span class="text-[11px] font-medium tracking-wider text-text-muted uppercase">
						{slotsFilledCount} / 5 Slots Filled
					</span>
				</div>

				<!-- 2×2 grid for first 4 sectors -->
				<div class="mb-3 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
					{#each SECTORS.slice(0, 4) as sector (sector.id)}
						{@const pick = pickForSector(sector.id)}
						{@const style = SECTOR_STYLE[sector.id]}
						{@const isActive = activeSector === sector.id && !pick}
						{@const sectorChg = sectorChanges.get(sector.id) ?? null}

						{#if pick}
							{@const tkn = tokenMap.get(pick.currencyId)}
							{@const hasBoost = activeBoosts.get(sector.id)}
							<div
								class="flex h-32 cursor-default flex-col rounded-xl border bg-surface p-4 shadow-sm"
								style="border-color: {hasBoost ? style.color : style.color + '30'}"
							>
								<div class="flex items-start justify-between">
									<span
										class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
										style="background: {style.bg}; color: {style.color}"
									>
										{sector.name} Sector
									</span>
									<div class="flex items-center gap-1">
										<svg
											class="h-4 w-4"
											style="color: {style.color}"
											fill="currentColor"
											viewBox="0 0 20 20"
										>
											{#if hasBoost}
												<span
													class="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white uppercase"
													>⚡ Boost</span
												>
											{/if}
											<path
												fill-rule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clip-rule="evenodd"
											/>
										</svg>
										<button
											type="button"
											onclick={() => removePick(sector.id)}
											class="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-xl leading-none text-text-muted hover:bg-hover"
											title="Remove pick">×</button
										>
									</div>
								</div>
								<div class="mt-auto flex items-center gap-3">
									<div
										class="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
										style="background: {avatarBg(pick.symbol)}"
									>
										{pick.symbol.charAt(0).toUpperCase()}
									</div>
									<div>
										<p class="text-sm font-semibold text-text">{pick.symbol.toUpperCase()}</p>
										{#if tkn?.change24h != null}
											<p
												class="text-xs font-medium"
												style="color: {tkn.change24h >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'}"
											>
												{fmtChg(tkn.change24h)}
											</p>
										{:else}
											<p class="text-[11px] text-text-muted">{pick.name}</p>
										{/if}
									</div>
									{#if tkn?.price != null}
										<span class="ml-auto text-xs font-medium text-text-muted"
											>{fmtPrice(tkn.price)}</span
										>
									{/if}
								</div>
							</div>
						{:else if isActive}
							<button
								type="button"
								onclick={() => selectSector(sector.id)}
								class="flex h-32 cursor-pointer flex-col rounded-xl border-2 border-dashed p-4 transition-all"
								style="border-color: {style.color}; background: {style.dimBg}"
							>
								<div class="flex items-start justify-between">
									<span
										class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
										style="background: {style.bg}; color: {style.color}"
									>
										{sector.name} Sector
									</span>
									{#if sectorChg != null}
										<span
											class="text-[11px] font-medium"
											style="color: {sectorChg >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'}"
											>{fmtChg(sectorChg)}</span
										>
									{/if}
								</div>
								<div class="mt-auto flex flex-col items-center gap-1">
									<svg
										class="h-5 w-5"
										style="color: {style.color}"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line
											x1="8"
											y1="12"
											x2="16"
											y2="12"
										/>
									</svg>
									<span class="text-xs font-semibold" style="color: {style.color}"
										>Draft {sector.name} Token ↓</span
									>
								</div>
							</button>
						{:else}
							<button
								type="button"
								onclick={() => selectSector(sector.id)}
								class="flex h-32 cursor-pointer flex-col rounded-xl border border-dashed border-border bg-surface p-4 shadow-sm transition-all hover:border-text-muted hover:bg-hover"
							>
								<div class="flex items-start justify-between">
									<span
										class="rounded-full bg-hover px-2 py-0.5 text-[10px] font-bold text-text-muted uppercase"
									>
										{sector.name} Sector
									</span>
									{#if sectorChg != null}
										<span
											class="text-[11px] font-medium"
											style="color: {sectorChg >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'}"
											>{fmtChg(sectorChg)}</span
										>
									{/if}
								</div>
								<div class="mt-auto flex flex-col items-center gap-1 text-text-muted">
									<svg
										class="h-5 w-5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="1.5"
									>
										<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line
											x1="8"
											y1="12"
											x2="16"
											y2="12"
										/>
									</svg>
									<span class="text-xs font-medium">Draft Token</span>
								</div>
							</button>
						{/if}
					{/each}
				</div>

				<!-- Wildcard — full width -->
				{#each SECTORS.slice(4) as sector (sector.id)}
					{@const pick = pickForSector(sector.id)}
					{@const style = SECTOR_STYLE[sector.id]}
					{@const isActive = activeSector === sector.id && !pick}
					{@const sectorChg = sectorChanges.get(sector.id) ?? null}

					{#if pick}
						{@const tkn = tokenMap.get(pick.currencyId)}
						{@const hasBoost = activeBoosts.get(sector.id)}
						<div
							class="flex cursor-default items-center gap-4 rounded-xl border bg-surface p-4 shadow-sm"
							style="border-color: {hasBoost ? style.color : style.color + '30'}"
						>
							<div class="flex flex-1 flex-col gap-2">
								<div class="flex items-center gap-2">
									<span
										class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
										style="background: {style.bg}; color: {style.color}">Wildcard Sector</span
									>
									<span class="text-[11px] text-text-muted">· Any Token Allowed</span>
								</div>
								<div class="flex items-center gap-3">
									<div
										class="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
										style="background: {avatarBg(pick.symbol)}"
									>
										{pick.symbol.charAt(0).toUpperCase()}
									</div>
									<div>
										<p class="text-sm font-semibold text-text">{pick.symbol.toUpperCase()}</p>
										{#if tkn?.change24h != null}
											<p
												class="text-xs font-medium"
												style="color: {tkn.change24h >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'}"
											>
												{fmtChg(tkn.change24h)}
											</p>
										{:else}
											<p class="text-[11px] text-text-muted">{pick.name}</p>
										{/if}
									</div>
									{#if tkn?.price != null}
										<span class="ml-auto text-xs font-medium text-text-muted"
											>{fmtPrice(tkn.price)}</span
										>
									{/if}
								</div>
							</div>
							<div class="flex items-center gap-2">
								<svg
									class="h-5 w-5"
									style="color: {style.color}"
									fill="currentColor"
									viewBox="0 0 20 20"
								>
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
										clip-rule="evenodd"
									/>
								</svg>
								<button
									type="button"
									onclick={() => removePick(sector.id)}
									class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-xl leading-none text-text-muted hover:bg-hover"
									title="Remove">×</button
								>
							</div>
						</div>
					{:else if isActive}
						<button
							type="button"
							onclick={() => selectSector(sector.id)}
							class="flex w-full cursor-pointer items-center justify-between rounded-xl border-2 border-dashed p-4 transition-all"
							style="border-color: {style.color}; background: {style.dimBg}"
						>
							<div class="flex flex-col gap-1 text-left">
								<div class="flex flex-wrap items-center gap-2">
									<span
										class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
										style="background: {style.bg}; color: {style.color}">Wildcard Sector</span
									>
									<span class="text-[11px]" style="color: {style.color}">· Any Token Allowed</span>
									{#if sectorChg != null}
										<span
											class="text-[11px] font-medium"
											style="color: {sectorChg >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'}"
											>{fmtChg(sectorChg)}</span
										>
									{/if}
								</div>
								<span class="text-xs font-semibold" style="color: {style.color}"
									>Draft your Wildcard pick ↓</span
								>
							</div>
							<svg
								class="h-6 w-6 shrink-0"
								style="color: {style.color}"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line
									x1="8"
									y1="12"
									x2="16"
									y2="12"
								/>
							</svg>
						</button>
					{:else}
						<button
							type="button"
							onclick={() => selectSector(sector.id)}
							class="flex w-full cursor-pointer items-center justify-between rounded-xl border border-dashed border-border bg-surface p-4 shadow-sm transition-all hover:border-text-muted"
						>
							<div class="flex flex-col gap-1 text-left">
								<div class="flex flex-wrap items-center gap-2">
									<span
										class="rounded-full bg-hover px-2 py-0.5 text-[10px] font-bold text-text-muted uppercase"
										>Wildcard Sector</span
									>
									<span class="text-[11px] text-text-muted">· Any Token Allowed</span>
									{#if sectorChg != null}
										<span
											class="text-[11px] font-medium"
											style="color: {sectorChg >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'}"
											>{fmtChg(sectorChg)}</span
										>
									{/if}
								</div>
								<span class="text-xs font-medium text-text-muted">Draft your Wildcard pick</span>
							</div>
							<svg
								class="h-5 w-5 shrink-0 text-text-muted"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="1.5"
							>
								<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line
									x1="8"
									y1="12"
									x2="16"
									y2="12"
								/>
							</svg>
						</button>
					{/if}
				{/each}
			</section>

			<!-- ── Token Pool ──────────────────────────────────────── -->
			<section
				id="token-pool"
				class="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
			>
				<!-- Pool header -->
				<div class="flex flex-col gap-3 border-b border-border p-4">
					<div class="flex items-center justify-between">
						<h2 class="text-sm font-semibold text-text">Token Pool</h2>
						<div class="flex items-center gap-1.5 text-text-muted">
							<svg
								class="h-3 w-3"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 101.5-8.79" />
							</svg>
							<span class="text-[11px] font-medium">Live prices · 2 min cache</span>
						</div>
					</div>

					<!-- Sector selector pills -->
					<div
						class="flex gap-2 overflow-x-auto pb-0.5"
						style="-ms-overflow-style:none;scrollbar-width:none"
					>
						{#each SECTORS as sector (sector.id)}
							{@const style = SECTOR_STYLE[sector.id]}
							{@const isActive = activeSector === sector.id}
							{@const filled = !!pickForSector(sector.id)}
							<button
								type="button"
								onclick={() => (activeSector = sector.id)}
								class="relative flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all"
								style={isActive
									? `background: ${style.color}; color: white`
									: `background: var(--color-hover); color: var(--color-text-secondary)`}
							>
								{sector.name}
								{#if filled}
									<span
										class="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
										style="background: {isActive ? 'rgba(255,255,255,0.3)' : style.color}">✓</span
									>
								{/if}
							</button>
						{/each}
					</div>

					<!-- Active sector label + search -->
					<div class="flex items-center gap-3">
						<div
							class="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
							style="background: {SECTOR_STYLE[activeSector].bg}; color: {SECTOR_STYLE[activeSector]
								.color}"
						>
							<span>Drafting for:</span>
							<strong
								>{SECTORS.find((s) => s.id === activeSector)?.name ?? activeSector.toUpperCase()} Slot</strong
							>
						</div>
						<div class="relative flex-1">
							<svg
								class="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
							</svg>
							<input
								type="text"
								placeholder="Search symbol or name…"
								bind:value={search}
								class="h-8 w-full rounded-lg border border-border bg-surface-raised py-1.5 pr-3 pl-8 text-xs transition-colors outline-none focus:border-primary focus:bg-surface"
							/>
						</div>
					</div>
				</div>

				<!-- Table header -->
				<div class="grid grid-cols-12 border-b border-border bg-surface-raised px-4 py-2">
					<div class="col-span-6 text-[10px] font-bold tracking-wider text-text-muted uppercase">
						Token
					</div>
					<div
						class="col-span-3 text-right text-[10px] font-bold tracking-wider text-text-muted uppercase"
					>
						24h
					</div>
					<div
						class="col-span-3 text-right text-[10px] font-bold tracking-wider text-text-muted uppercase max-sm:hidden"
					>
						Volume
					</div>
				</div>

				<!-- Token rows -->
				<div class="max-h-105 divide-y divide-black/5 overflow-y-auto">
					{#if filteredTokens.length === 0}
						<div class="px-4 py-10 text-center text-sm text-text-muted">
							No tokens match "{search}"
						</div>
					{/if}
					{#each filteredTokens as token (token.currency_id)}
						{@const inLineup = isInLineup(token.currency_id)}
						{@const isHighlighted = token.currency_id === highlightId}
						<button
							type="button"
							disabled={inLineup}
							onclick={() => addToken(token)}
							class="grid w-full cursor-pointer grid-cols-12 items-center px-4 py-3 text-left transition-colors
								{inLineup ? 'cursor-default bg-hover opacity-60' : 'bg-surface hover:bg-primary-muted'}
								{isHighlighted ? 'ring-2 ring-inset ring-primary' : ''}"
						>
							<div class="col-span-6 flex items-center gap-3">
								<div
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
									style="background: {avatarBg(token.symbol ?? '')}"
								>
									{(token.symbol ?? '?').charAt(0).toUpperCase()}
								</div>
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-1.5">
										<p class="text-sm font-semibold text-text">
											{(token.symbol ?? '').toUpperCase()}
										</p>
										{#if token.rank}
											<span
												class="rounded bg-hover px-1 py-0.5 text-[9px] font-medium text-text-muted"
												>#{token.rank}</span
											>
										{/if}
										{#if inLineup}
											<span
												class="ml-1 rounded-full bg-primary-muted px-2 py-0.5 text-[10px] font-semibold text-primary"
												>In lineup</span
											>
										{/if}
									</div>
									<p class="truncate text-[11px] text-text-muted">{token.name}</p>
								</div>
							</div>
							<div class="col-span-3 text-right">
								{#if token.change24h != null}
									<span
										class="text-xs font-semibold"
										style="color: {token.change24h >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'}"
										>{fmtChg(token.change24h)}</span
									>
								{:else}
									<span class="text-xs text-text-muted">—</span>
								{/if}
							</div>
							<div class="col-span-3 text-right max-sm:hidden">
								<span class="text-xs text-text-muted">{fmtVol(token.volume24h)}</span>
							</div>
						</button>
					{/each}
				</div>
			</section>

			<!-- ── Lock Lineup Button ──────────────────────────────── -->
			<div class="pb-4">
				{#if slotsFilledCount < 5}
					<div class="mb-2.5 flex flex-wrap items-center justify-center gap-1.5">
						{#each SECTORS as sector (sector.id)}
							{@const filled = !!pickForSector(sector.id)}
							{@const style = SECTOR_STYLE[sector.id]}
							<div
								class="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold"
								style={filled
									? `background: ${style.bg}; color: ${style.color}`
									: 'background: var(--color-hover); color: var(--color-text-muted)'}
							>
								{#if filled}
									<svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
										<path
											fill-rule="evenodd"
											d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
											clip-rule="evenodd"
										/>
									</svg>
								{:else}
									<svg
										class="h-3 w-3"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2.5"
									>
										<circle cx="12" cy="12" r="10" />
									</svg>
								{/if}
								{sector.name}
							</div>
						{/each}
					</div>
				{/if}

				<button
					type="button"
					onclick={submitLineup}
					disabled={slotsFilledCount !== 5 || submitting}
					class="flex h-14 w-full items-center justify-center gap-2.5 rounded-xl text-base font-bold tracking-wide shadow-lg transition-all active:scale-[0.98]
						{slotsFilledCount === 5
						? 'cursor-pointer bg-primary text-white hover:bg-primary-hover'
						: 'cursor-not-allowed bg-hover text-text-muted'}"
				>
					{#if submitting}
						<svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							/>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							/>
						</svg>
						Submitting…
					{:else if slotsFilledCount === 5}
						<svg
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2.5"
						>
							<rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path
								d="M7 11V7a5 5 0 0110 0v4"
							/>
						</svg>
						Lock Lineup
					{:else}
						Fill {5 - slotsFilledCount} more {5 - slotsFilledCount === 1 ? 'slot' : 'slots'} to lock
					{/if}
				</button>
			</div>
		{/if}
	</div>
</div>

<Toast />
