<script lang="ts">
	import { page } from '$app/state'
	import { onMount } from 'svelte'

	let contests = $state([])
	let sectors = $state([])
	let alerts = $state([])
	let loading = $state(true)
	let actionError = $state('')

	let streak = $derived(contests.filter((contest) => contest.status === 'resolved').length)
	let winRate = $derived(68)

	onMount(async () => {
		await Promise.all([loadContests(), loadSectors(), loadAlerts()])
		loading = false
	})

	async function loadContests() {
		try {
			const res = await fetch('/api/contests')
			if (res.ok) contests = await res.json()
		} catch (error) {
			console.error('Failed to load contests:', error)
		}
	}

	async function loadSectors() {
		try {
			const res = await fetch('/api/sectors')
			if (res.ok) {
				const data = await res.json()
				sectors = Array.isArray(data) ? data.slice(0, 6) : []
			}
		} catch (error) {
			console.error('Failed to load sectors:', error)
		}
	}

	async function loadAlerts() {
		try {
			const res = await fetch('/api/etf')
			if (res.ok) {
				const data = await res.json()
				alerts = data.alerts ?? []
			}
		} catch (error) {
			console.error('Failed to load alerts:', error)
		}
	}

	async function createContest() {
		actionError = ''
		try {
			const res = await fetch('/api/contests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'daily' })
			})
			if (!res.ok) {
				const payload = await res.json().catch(() => ({}))
				if (res.status === 401) {
					window.location.href = '/?auth=required'
					return
				}
				throw new Error(payload?.error ?? 'Failed to create contest')
			}
			const contest = await res.json()
			window.location.href = `/draft?contestId=${contest.id}`
		} catch (error) {
			actionError = error?.message ?? 'Failed to create contest'
			console.error('Failed to create contest:', error)
		}
	}

	function formatPct(value: number) {
		const signed = value >= 0 ? `+${value.toFixed(1)}` : value.toFixed(1)
		return `${signed}%`
	}
</script>

<div class="flex flex-col gap-3">
	<section class="grid grid-cols-3 gap-3 max-[900px]:grid-cols-1">
		<div class="rounded-xl border border-black/10 bg-white px-3.5 py-3">
			<p class="text-[11px] font-medium uppercase text-[#888780]">Active Contests</p>
			<div class="mt-2 flex items-center justify-between gap-2">
				<h2 class="text-[28px] leading-none font-medium">{contests.length}</h2>
				<span class="rounded-full bg-[#e1f5ee] px-2 py-0.5 text-[11px] font-medium text-[#0f6e56]">In progress</span>
			</div>
		</div>
		<div class="rounded-xl border border-black/10 bg-white px-3.5 py-3">
			<p class="text-[11px] font-medium uppercase text-[#888780]">Current Streak</p>
			<div class="mt-2 flex items-center justify-between gap-2">
				<h2 class="text-[28px] leading-none font-medium">{streak} Days</h2>
				<span class="text-lg">🔥</span>
			</div>
		</div>
		<div class="rounded-xl border border-black/10 bg-white px-3.5 py-3">
			<p class="text-[11px] font-medium uppercase text-[#888780]">Win Rate</p>
			<div class="mt-2 flex items-center justify-between gap-2">
				<h2 class="text-[28px] leading-none font-medium">{winRate}%</h2>
				<span class="text-xs text-[#888780]">{page.data.user?.username ?? 'player'}</span>
			</div>
		</div>
	</section>

	<section class="flex items-center justify-between gap-3 rounded-xl bg-[#534ab7] p-4 text-[#eeedfe]">
		<div>
			<h1 class="text-2xl leading-[1.2] font-medium">The Weekly Gauntlet</h1>
			<p class="mt-1 text-xs opacity-90">Next lock in 04:22:15</p>
			{#if actionError}
				<p class="mt-2 text-xs text-[#faece7]">{actionError}</p>
			{/if}
		</div>
		<button class="h-10 cursor-pointer rounded-lg border-0 bg-[#eeedfe] px-4 font-medium text-[#534ab7]" onclick={createContest}>Draft Now</button>
	</section>

	<div class="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
		<section class="rounded-xl border border-black/10 bg-white px-3.5 py-3">
			<div class="mb-2.5 flex items-center justify-between">
				<h3 class="text-[11px] font-medium uppercase text-[#888780]">Sector Wars</h3>
				<small class="text-[11px] text-[#888780]">Live 15m Cache</small>
			</div>
			{#if loading}
				<p class="text-xs text-[#888780]">Loading sector data...</p>
			{:else if sectors.length === 0}
				<p class="text-xs text-[#888780]">Sector feed unavailable.</p>
			{:else}
				<div class="flex flex-col gap-2">
					{#each sectors as sector, i (sector?.sector ?? sector?.name ?? i)}
						<div class="flex flex-col gap-1">
							<div class="flex justify-between text-[13px]">
								<span>{sector.sector ?? sector.name ?? 'Sector'}</span>
								<span class:text-[#0f6e56]={Number(sector.change ?? 0) >= 0} class:text-[#993c1d]={Number(sector.change ?? 0) < 0} class="font-medium">
									{formatPct(Number(sector.change ?? 0))}
								</span>
							</div>
							<div class="h-2 overflow-hidden rounded-full bg-[#f0ecf6]">
								<div class="h-full bg-[#534ab7]" style={`width: ${Math.max(8, Math.min(100, Math.abs(Number(sector.change ?? 0)) * 8))}%`}></div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<section class="rounded-xl border border-black/10 bg-white px-3.5 py-3">
			<div class="mb-2.5 flex items-center justify-between">
				<h3 class="text-[11px] font-medium uppercase text-[#888780]">Whale Watch</h3>
				<small class="text-[11px] text-[#888780]">ETF Flow Alerts</small>
			</div>
			{#if alerts.length === 0}
				<p class="text-xs text-[#888780]">No active alerts right now.</p>
			{:else}
				<div class="flex flex-col gap-2">
					{#each alerts.slice(0, 3) as alert, i (alert?.date ?? `${alert?.type ?? 'alert'}-${i}`)}
						<div class="flex gap-2 rounded-lg bg-[#f6f2fc] p-2.5">
							<div class="mt-1.5 h-2 w-2 rounded-full bg-[#534ab7]"></div>
							<div>
								<p class="text-[13px] font-medium">{alert.type} streak detected</p>
								<small class="text-[11px] text-[#888780]">{alert.streak} days · ${Math.round(alert.amount).toLocaleString()}</small>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>

	<section class="flex items-center justify-between rounded-xl border border-black/10 bg-white px-3.5 py-3 max-[900px]:flex-col max-[900px]:items-start max-[900px]:gap-2.5">
		<div>
			<h3 class="text-[11px] font-medium uppercase text-[#888780]">Today's Gauntlet</h3>
			<p class="text-xs text-[#888780]">Make your picks and lock lineup before timer expires.</p>
		</div>
		<button class="h-10 cursor-pointer rounded-lg border-0 bg-[#eeedfe] px-4 font-medium text-[#534ab7]" onclick={createContest}>Enter Draft</button>
	</section>
</div>
