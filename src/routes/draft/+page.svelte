<script lang="ts">
	import { onMount, onDestroy } from 'svelte'
	import { SECTORS } from '$lib/constants'
	import Toast from '$lib/components/Toast.svelte'
	import { toast } from '$lib/toast'

	type Token = {
		currency_id: string
		symbol?: string
		name?: string
		price: number | null
		change24h: number | null
		volume24h: number | null
		rank: number | null
	}

	type SectorInfo = { id: string; name: string; change: number | null }

	type Pick = {
		currencyId: string
		symbol: string
		name: string
		sector: string
	}

	// ── State ──────────────────────────────────────────────────────────
	let contestId = $state('')
	let tokens = $state<Token[]>([])
	let sectorChanges = $state<Map<string, number | null>>(new Map())
	let lineup = $state<Pick[]>([])
	let loading = $state(true)
	let loadError = $state('')
	let submitting = $state(false)
	let activeSector = $state(SECTORS[0].id)
	let search = $state('')
	let timeLeft = $state(45 * 60)
	let timer: ReturnType<typeof setInterval> | null = null

	// ── Sector visual config ───────────────────────────────────────────
	const SECTOR_STYLE: Record<string, { color: string; bg: string; dimBg: string }> = {
		l1: { color: '#0F6E56', bg: '#E1F5EE', dimBg: '#f0faf6' },
		l2: { color: '#2563EB', bg: '#dbeafe', dimBg: '#eff6ff' },
		defi: { color: '#534AB7', bg: '#eeedfe', dimBg: '#f5f4ff' },
		meme: { color: '#993C1D', bg: '#FAECE7', dimBg: '#fdf5f2' },
		wildcard: { color: '#D97706', bg: '#fef3c7', dimBg: '#fffbeb' }
	}

	// ── Lifecycle ──────────────────────────────────────────────────────
	onMount(() => {
		const p = new URLSearchParams(window.location.search)
		contestId = p.get('contestId') ?? ''
		loadData()
		timer = setInterval(() => {
			timeLeft = Math.max(0, timeLeft - 1)
		}, 1000)
	})

	onDestroy(() => {
		if (timer) clearInterval(timer)
	})

	async function loadData() {
		loading = true
		loadError = ''
		try {
			const [tRes, sRes] = await Promise.all([fetch('/api/tokens'), fetch('/api/sectors')])
			if (!tRes.ok) throw new Error('Failed to load tokens')
			tokens = await tRes.json()
			if (sRes.ok) {
				const secs: SectorInfo[] = await sRes.json()
				sectorChanges = new Map(secs.map((s) => [s.id, s.change]))
			}
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load data'
		} finally {
			loading = false
		}
	}

	// ── Derived ────────────────────────────────────────────────────────
	const tokenMap = $derived(new Map(tokens.map((t) => [t.currency_id, t])))

	const filteredTokens = $derived.by(() => {
		const q = search.trim().toLowerCase()
		if (!q) return tokens.slice(0, 50)
		return tokens
			.filter((t) => t.symbol?.toLowerCase().includes(q) || t.name?.toLowerCase().includes(q))
			.slice(0, 50)
	})

	const slotsFilledCount = $derived(lineup.length)

	const timerStr = $derived.by(() => {
		const m = Math.floor(timeLeft / 60).toString().padStart(2, '0')
		const s = (timeLeft % 60).toString().padStart(2, '0')
		return `${m}:${s}`
	})

	// ── Helpers ────────────────────────────────────────────────────────
	function pickForSector(id: string): Pick | undefined {
		return lineup.find((p) => p.sector === id)
	}

	function isInLineup(currencyId: string): boolean {
		return lineup.some((p) => p.currencyId === currencyId)
	}

	function selectSector(id: string) {
		activeSector = id
		document.getElementById('token-pool')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
	}

	function addToken(token: Token) {
		const sym = (token.symbol ?? token.currency_id).toUpperCase()
		if (isInLineup(token.currency_id)) {
			toast(`${sym} is already in your lineup`, 'error')
			return
		}
		lineup = [
			...lineup.filter((p) => p.sector !== activeSector),
			{
				currencyId: token.currency_id,
				symbol: token.symbol ?? token.currency_id,
				name: token.name ?? '',
				sector: activeSector
			}
		]
		toast(`${sym} added to ${SECTORS.find((s) => s.id === activeSector)?.name} slot`, 'success')
		const next = SECTORS.find((s) => !lineup.some((p) => p.sector === s.id))
		if (next) activeSector = next.id
	}

	function removePick(sectorId: string) {
		lineup = lineup.filter((p) => p.sector !== sectorId)
		activeSector = sectorId
	}

	function fmtChg(v: number | null): string {
		if (v == null) return '—'
		return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
	}

	function fmtVol(v: number | null): string {
		if (v == null) return '—'
		if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B'
		if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M'
		if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K'
		return '$' + v.toFixed(2)
	}

	function fmtPrice(v: number | null): string {
		if (v == null) return ''
		if (v >= 1000) return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 2 })
		if (v >= 1) return '$' + v.toFixed(2)
		return '$' + v.toPrecision(4)
	}

	function avatarBg(sym: string): string {
		const palette = ['#534AB7', '#0F6E56', '#2563EB', '#993C1D', '#D97706', '#6366f1', '#0891b2']
		let h = 0
		for (const c of sym) h = (h * 31 + c.charCodeAt(0)) & 0xffffff
		return palette[Math.abs(h) % palette.length]
	}

	// ── Submit ─────────────────────────────────────────────────────────
	async function submitLineup() {
		if (lineup.length !== 5) {
			toast('Select all 5 slots first — one per sector', 'error')
			return
		}
		submitting = true
		try {
			if (!contestId) {
				const r = await fetch('/api/contests', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ type: 'daily' })
				})
				if (!r.ok) throw new Error('Failed to create contest')
				contestId = (await r.json()).id
			}

			const r2 = await fetch(`/api/contest/${contestId}/lineup`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ picks: lineup })
			})
			if (!r2.ok) {
				const errData = await r2.json().catch(() => ({}))
				throw new Error((errData as { error?: string }).error ?? 'Failed to submit lineup')
			}
			window.location.href = `/contest/result?contestId=${contestId}`
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Submit failed', 'error')
		} finally {
			submitting = false
		}
	}
</script>

<div class="min-h-screen bg-[#F8F8F7]">
	<div class="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-6">

		<!-- ── Header ──────────────────────────────────────────────── -->
		<header class="flex items-center justify-between rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm">
			<div>
				<h1 class="text-lg font-semibold leading-tight text-[#1c1b22]">Draft — Daily Contest</h1>
				<p class="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-[#888780]">
					Strategic Selection Phase
				</p>
			</div>
			<div class="flex items-center gap-1.5 rounded-full bg-[#FAECE7] px-3 py-1.5 text-[#993C1D]">
				<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
				</svg>
				<span class="text-sm font-bold tabular-nums">{timerStr}</span>
			</div>
		</header>

		<!-- ── VS Bar ──────────────────────────────────────────────── -->
		<div class="flex items-center justify-between gap-4 rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm">
			<div class="flex flex-1 items-center gap-3">
				<div class="relative">
					<div class="flex h-11 w-11 items-center justify-center rounded-full bg-[#534AB7] text-sm font-semibold text-white">YOU</div>
					<div class="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-[#0F6E56]">
						<svg class="h-2 w-2 text-white" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
						</svg>
					</div>
				</div>
				<div>
					<p class="text-sm font-semibold text-[#1c1b22]">You</p>
					<p class="text-[11px] text-[#888780]">Rank #42 · 64% Win Rate</p>
				</div>
			</div>
			<span class="text-xs font-bold uppercase tracking-widest text-[#888780] opacity-40">vs</span>
			<div class="flex flex-1 items-center justify-end gap-3 text-right">
				<div>
					<p class="text-sm font-semibold text-[#1c1b22]">CryptoWhale_88</p>
					<p class="text-[11px] text-[#888780]">Rank #12 · 71% Win Rate</p>
				</div>
				<div class="flex h-11 w-11 items-center justify-center rounded-full bg-[#5d5d6b] text-xs font-semibold text-white">CW</div>
			</div>
		</div>

		{#if loading}
			<div class="flex flex-col gap-3">
				<div class="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
					{#each [0,1,2,3] as i (i)}
						<div class="h-32 animate-pulse rounded-xl bg-white shadow-sm"></div>
					{/each}
				</div>
				<div class="h-24 animate-pulse rounded-xl bg-white shadow-sm"></div>
				<div class="h-105 animate-pulse rounded-xl bg-white shadow-sm"></div>
			</div>

		{:else if loadError}
			<div class="flex items-center gap-3 rounded-xl border border-[#993C1D]/20 bg-[#FAECE7] px-4 py-3 text-sm text-[#993C1D]">
				<svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
				</svg>
				<span>{loadError}</span>
				<button onclick={loadData} class="ml-auto underline">Retry</button>
			</div>

		{:else}
			<!-- ── Lineup Slots ──────────────────────────────────── -->
			<section>
				<div class="mb-3 flex items-center justify-between px-0.5">
					<h2 class="text-sm font-semibold text-[#1c1b22]">Your Lineup</h2>
					<span class="text-[11px] font-medium uppercase tracking-wider text-[#888780]">
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
							<div
								class="flex h-32 cursor-default flex-col rounded-xl border bg-white p-4 shadow-sm"
								style="border-color: {style.color}30"
							>
								<div class="flex items-start justify-between">
									<span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style="background: {style.bg}; color: {style.color}">
										{sector.name} Sector
									</span>
									<div class="flex items-center gap-1">
										<svg class="h-4 w-4" style="color: {style.color}" fill="currentColor" viewBox="0 0 20 20">
											<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
										</svg>
										<button
											type="button"
											onclick={() => removePick(sector.id)}
											class="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-xl leading-none text-[#888780] hover:bg-[#f0f0f0]"
											title="Remove pick"
										>×</button>
									</div>
								</div>
								<div class="mt-auto flex items-center gap-3">
									<div class="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white" style="background: {avatarBg(pick.symbol)}">
										{pick.symbol.charAt(0).toUpperCase()}
									</div>
									<div>
										<p class="text-sm font-semibold text-[#1c1b22]">{pick.symbol.toUpperCase()}</p>
										{#if tkn?.change24h != null}
											<p class="text-xs font-medium" style="color: {tkn.change24h >= 0 ? '#0F6E56' : '#993C1D'}">{fmtChg(tkn.change24h)}</p>
										{:else}
											<p class="text-[11px] text-[#888780]">{pick.name}</p>
										{/if}
									</div>
									{#if tkn?.price != null}
										<span class="ml-auto text-xs font-medium text-[#888780]">{fmtPrice(tkn.price)}</span>
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
									<span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style="background: {style.bg}; color: {style.color}">
										{sector.name} Sector
									</span>
									{#if sectorChg != null}
										<span class="text-[11px] font-medium" style="color: {sectorChg >= 0 ? '#0F6E56' : '#993C1D'}">{fmtChg(sectorChg)}</span>
									{/if}
								</div>
								<div class="mt-auto flex flex-col items-center gap-1">
									<svg class="h-5 w-5" style="color: {style.color}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
									</svg>
									<span class="text-xs font-semibold" style="color: {style.color}">Draft {sector.name} Token ↓</span>
								</div>
							</button>

						{:else}
							<button
								type="button"
								onclick={() => selectSector(sector.id)}
								class="flex h-32 cursor-pointer flex-col rounded-xl border border-dashed border-black/10 bg-white p-4 transition-all hover:border-black/20 hover:bg-[#fafafa] shadow-sm"
							>
								<div class="flex items-start justify-between">
									<span class="rounded-full bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-bold uppercase text-[#888780]">
										{sector.name} Sector
									</span>
									{#if sectorChg != null}
										<span class="text-[11px] font-medium" style="color: {sectorChg >= 0 ? '#0F6E56' : '#993C1D'}">{fmtChg(sectorChg)}</span>
									{/if}
								</div>
								<div class="mt-auto flex flex-col items-center gap-1 text-[#aaa]">
									<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
										<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
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
						<div class="flex cursor-default items-center gap-4 rounded-xl border bg-white p-4 shadow-sm" style="border-color: {style.color}30">
							<div class="flex flex-1 flex-col gap-2">
								<div class="flex items-center gap-2">
									<span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style="background: {style.bg}; color: {style.color}">Wildcard Sector</span>
									<span class="text-[11px] text-[#888780]">· Any Token Allowed</span>
								</div>
								<div class="flex items-center gap-3">
									<div class="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style="background: {avatarBg(pick.symbol)}">
										{pick.symbol.charAt(0).toUpperCase()}
									</div>
									<div>
										<p class="text-sm font-semibold text-[#1c1b22]">{pick.symbol.toUpperCase()}</p>
										{#if tkn?.change24h != null}
											<p class="text-xs font-medium" style="color: {tkn.change24h >= 0 ? '#0F6E56' : '#993C1D'}">{fmtChg(tkn.change24h)}</p>
										{:else}
											<p class="text-[11px] text-[#888780]">{pick.name}</p>
										{/if}
									</div>
									{#if tkn?.price != null}
										<span class="ml-auto text-xs font-medium text-[#888780]">{fmtPrice(tkn.price)}</span>
									{/if}
								</div>
							</div>
							<div class="flex items-center gap-2">
								<svg class="h-5 w-5" style="color: {style.color}" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
								</svg>
								<button
									type="button"
									onclick={() => removePick(sector.id)}
									class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-xl leading-none text-[#888780] hover:bg-[#f0f0f0]"
									title="Remove"
								>×</button>
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
									<span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style="background: {style.bg}; color: {style.color}">Wildcard Sector</span>
									<span class="text-[11px]" style="color: {style.color}">· Any Token Allowed</span>
									{#if sectorChg != null}
										<span class="text-[11px] font-medium" style="color: {sectorChg >= 0 ? '#0F6E56' : '#993C1D'}">{fmtChg(sectorChg)}</span>
									{/if}
								</div>
								<span class="text-xs font-semibold" style="color: {style.color}">Draft your Wildcard pick ↓</span>
							</div>
							<svg class="h-6 w-6 shrink-0" style="color: {style.color}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
							</svg>
						</button>

					{:else}
						<button
							type="button"
							onclick={() => selectSector(sector.id)}
							class="flex w-full cursor-pointer items-center justify-between rounded-xl border border-dashed border-black/10 bg-white p-4 shadow-sm transition-all hover:border-black/20"
						>
							<div class="flex flex-col gap-1 text-left">
								<div class="flex flex-wrap items-center gap-2">
									<span class="rounded-full bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-bold uppercase text-[#888780]">Wildcard Sector</span>
									<span class="text-[11px] text-[#888780]">· Any Token Allowed</span>
									{#if sectorChg != null}
										<span class="text-[11px] font-medium" style="color: {sectorChg >= 0 ? '#0F6E56' : '#993C1D'}">{fmtChg(sectorChg)}</span>
									{/if}
								</div>
								<span class="text-xs font-medium text-[#888780]">Draft your Wildcard pick</span>
							</div>
							<svg class="h-5 w-5 shrink-0 text-[#ccc]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
							</svg>
						</button>
					{/if}
				{/each}
			</section>

			<!-- ── Token Pool ──────────────────────────────────────── -->
			<section id="token-pool" class="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">

				<!-- Pool header -->
				<div class="flex flex-col gap-3 border-b border-black/5 p-4">
					<div class="flex items-center justify-between">
						<h2 class="text-sm font-semibold text-[#1c1b22]">Token Pool</h2>
						<div class="flex items-center gap-1.5 text-[#888780]">
							<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 101.5-8.79"/>
							</svg>
							<span class="text-[11px] font-medium">Live prices · 2 min cache</span>
						</div>
					</div>

					<!-- Sector selector pills -->
					<div class="flex gap-2 overflow-x-auto pb-0.5" style="-ms-overflow-style:none;scrollbar-width:none">
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
									: `background: #f0efef; color: #5d5d6b`}
							>
								{sector.name}
								{#if filled}
									<span
										class="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
										style="background: {isActive ? 'rgba(255,255,255,0.3)' : style.color}"
									>✓</span>
								{/if}
							</button>
						{/each}
					</div>

					<!-- Active sector label + search -->
					<div class="flex items-center gap-3">
					<div class="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium" style="background: {SECTOR_STYLE[activeSector].bg}; color: {SECTOR_STYLE[activeSector].color}">
							<span>Drafting for:</span>
							<strong>{SECTORS.find((s) => s.id === activeSector)?.name ?? activeSector.toUpperCase()} Slot</strong>
						</div>
						<div class="relative flex-1">
							<svg class="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#888780]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
							</svg>
							<input
								type="text"
								placeholder="Search symbol or name…"
								bind:value={search}
								class="h-8 w-full rounded-lg border border-black/10 bg-[#fafafa] py-1.5 pr-3 pl-8 text-xs outline-none transition-colors focus:border-[#534AB7] focus:bg-white"
							/>
						</div>
					</div>
				</div>

				<!-- Table header -->
				<div class="grid grid-cols-12 border-b border-black/5 bg-[#fafafa] px-4 py-2">
					<div class="col-span-6 text-[10px] font-bold uppercase tracking-wider text-[#888780]">Token</div>
					<div class="col-span-3 text-right text-[10px] font-bold uppercase tracking-wider text-[#888780]">24h</div>
					<div class="col-span-3 text-right text-[10px] font-bold uppercase tracking-wider text-[#888780] max-sm:hidden">Volume</div>
				</div>

				<!-- Token rows -->
				<div class="max-h-105 divide-y divide-black/5 overflow-y-auto">
					{#if filteredTokens.length === 0}
						<div class="px-4 py-10 text-center text-sm text-[#888780]">No tokens match "{search}"</div>
					{/if}
					{#each filteredTokens as token (token.currency_id)}
						{@const inLineup = isInLineup(token.currency_id)}
						<button
							type="button"
							disabled={inLineup}
							onclick={() => addToken(token)}
							class="grid w-full cursor-pointer grid-cols-12 items-center px-4 py-3 text-left transition-colors
								{inLineup ? 'cursor-default bg-[#f8f8f8] opacity-60' : 'bg-white hover:bg-[#f8f6ff]'}"
						>
							<div class="col-span-6 flex items-center gap-3">
								<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style="background: {avatarBg(token.symbol ?? '')}">
									{(token.symbol ?? '?').charAt(0).toUpperCase()}
								</div>
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-1.5">
										<p class="text-sm font-semibold text-[#1c1b22]">{(token.symbol ?? '').toUpperCase()}</p>
										{#if token.rank}
											<span class="rounded bg-[#f0f0f0] px-1 py-0.5 text-[9px] font-medium text-[#888780]">#{token.rank}</span>
										{/if}
										{#if inLineup}
											<span class="ml-1 rounded-full bg-[#eeedfe] px-2 py-0.5 text-[10px] font-semibold text-[#534AB7]">In lineup</span>
										{/if}
									</div>
									<p class="truncate text-[11px] text-[#888780]">{token.name}</p>
								</div>
							</div>
							<div class="col-span-3 text-right">
								{#if token.change24h != null}
									<span class="text-xs font-semibold" style="color: {token.change24h >= 0 ? '#0F6E56' : '#993C1D'}">{fmtChg(token.change24h)}</span>
								{:else}
									<span class="text-xs text-[#888780]">—</span>
								{/if}
							</div>
							<div class="col-span-3 text-right max-sm:hidden">
								<span class="text-xs text-[#888780]">{fmtVol(token.volume24h)}</span>
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
									: 'background: #f0f0f0; color: #bbb'}
							>
								{#if filled}
									<svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
										<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
									</svg>
								{:else}
									<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
										<circle cx="12" cy="12" r="10"/>
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
							? 'cursor-pointer bg-[#534AB7] text-white hover:bg-[#453fa0]'
							: 'cursor-not-allowed bg-[#e0e0e0] text-[#aaa]'}"
				>
					{#if submitting}
						<svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
						</svg>
						Submitting…
					{:else if slotsFilledCount === 5}
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
							<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
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

