<script lang="ts">
	import { page } from '$app/state';
	import { appKit } from '$lib/appkit';
	import { onMount, onDestroy } from 'svelte';

	const appkitReady = Boolean(appKit);

	let timeLeft = $state(4 * 3600 + 22 * 60 + 15);
	const timerStr = $derived.by(() => {
		const h = Math.floor(timeLeft / 3600);
		const m = Math.floor((timeLeft % 3600) / 60);
		const s = timeLeft % 60;
		return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	});
	let timer: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		timer = setInterval(() => {
			if (timeLeft > 0) timeLeft--;
		}, 1000);
	});
	onDestroy(() => {
		if (timer) clearInterval(timer);
	});

	const STEPS = [
		{
			num: '1',
			title: 'Research',
			desc: 'Leverage institutional-grade on-chain data, sector heat maps, and whale movement alerts to find under-the-radar gems before the crowd.'
		},
		{
			num: '2',
			title: 'Draft',
			desc: 'Assemble your 5-token lineup across L1, L2, DeFi, Meme, and a Wildcard slot. Balance reliability with volatility to maximise your score.'
		},
		{
			num: '3',
			title: 'Win',
			desc: 'Watch your score stack up live on the leaderboard. Top performers earn USDT, SoSoXP, and exclusive ecosystem governance rights.'
		}
	];

	const WINNERS = [
		{
			initials: 'JD',
			name: 'CryptoWhale_99',
			reward: '$12,450 USDT',
			pts: '98.4 Pts',
			contest: 'Lineup Alpha',
			time: '2 hours ago',
			color: 'var(--color-primary)'
		},
		{
			initials: 'AL',
			name: 'AlphaLegend',
			reward: '$8,100 USDT',
			pts: '95.2 Pts',
			contest: 'Daily Gauntlet',
			time: '5 hours ago',
			color: 'var(--color-sector-l1)'
		},
		{
			initials: 'SK',
			name: 'SatoshiKnight',
			reward: '$5,500 USDT',
			pts: '92.7 Pts',
			contest: 'Meme War #2',
			time: 'Yesterday',
			color: 'var(--color-sector-wildcard)'
		},
		{
			initials: 'BZ',
			name: 'BullZone_OG',
			reward: '$3,200 USDT',
			pts: '91.1 Pts',
			contest: 'Late Night Draft',
			time: 'Yesterday',
			color: 'var(--color-sector-l2)'
		}
	];
</script>

<!-- Break out of the layout's max-w-6xl container -->
<div class="-mx-3.5 -mt-3.5">
	<!-- ── Hero ──────────────────────────────────────────────────────── -->
	<section class="relative overflow-hidden bg-bg px-6 py-20 text-text max-md:py-14">
		<!-- background grid pattern -->
		<div
			class="pointer-events-none absolute inset-0 opacity-[0.04]"
			style="background-image: linear-gradient(#fff 1px, transparent 1px), linear-gradient(to right, #fff 1px, transparent 1px); background-size: 48px 48px;"
		></div>
		<!-- brand glow -->
		<div
			class="pointer-events-none absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary opacity-20 blur-3xl"
		></div>

		<div class="relative mx-auto max-w-5xl text-center">
			<!-- Live badge -->
			<div
				class="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/50 px-4 py-1.5 text-xs font-medium text-text-secondary"
			>
				<span class="h-2 w-2 animate-pulse rounded-full bg-positive"></span>
				Live Now: Season 4
			</div>

			<h1 class="text-6xl leading-[1.05] font-black tracking-tight max-md:text-4xl">
				The Arena<br /><span class="text-primary">of Alpha</span>
			</h1>
			<p class="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-text-secondary max-md:text-base">
				Where degenerate energy meets institutional intelligence. Draft your winning token lineup
				and claim your share of the massive USDT prize pools.
			</p>

			<!-- Stats bar -->
			<div
				class="mx-auto mt-10 grid max-w-lg grid-cols-3 divide-x divide-border overflow-hidden rounded-2xl border border-border bg-surface"
			>
				<div class="flex flex-col gap-1 px-6 py-4 text-center">
					<span class="text-2xl font-black text-text">$150k</span>
					<span class="text-[11px] font-medium tracking-wider text-text-muted uppercase"
						>Daily Pool</span
					>
				</div>
				<div class="flex flex-col gap-1 px-6 py-4 text-center">
					<span class="text-2xl font-black text-text">12,405</span>
					<span class="text-[11px] font-medium tracking-wider text-text-muted uppercase"
						>Active Players</span
					>
				</div>
				<div class="flex flex-col gap-1 px-6 py-4 text-center">
					<span class="text-2xl font-black text-primary tabular-nums">{timerStr}</span>
					<span class="text-[11px] font-medium tracking-wider text-text-muted uppercase"
						>Next Lock In</span
					>
				</div>
			</div>

			<!-- CTA buttons -->
			<div class="mt-8 flex flex-wrap items-center justify-center gap-4">
				{#if page.data.user}
					<a
						href="/dashboard"
						class="inline-flex h-12 cursor-pointer items-center gap-2 rounded-xl bg-primary px-8 text-sm font-bold text-white no-underline shadow-lg shadow-primary/30 transition hover:bg-primary-hover"
					>
						Go to Dashboard →
					</a>
				{:else if appkitReady}
					<div class="*:h-12 *:rounded-xl *:px-8">
						<appkit-button></appkit-button>
					</div>
					<a
						href="/dashboard"
						class="inline-flex h-12 cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface/50 px-8 text-sm font-medium text-text-secondary no-underline transition hover:bg-hover"
					>
						View Dashboard
					</a>
				{:else}
					<button
						class="inline-flex h-12 cursor-not-allowed items-center rounded-xl bg-primary/50 px-8 text-sm font-bold text-white/50"
						disabled>Loading Wallet…</button
					>
				{/if}
			</div>

			{#if page.url.searchParams.get('auth') === 'required'}
				<p class="mt-4 text-xs text-negative">
					Sign in with your wallet to access draft and contest routes.
				</p>
			{/if}
		</div>
	</section>

	<!-- ── Playbook ───────────────────────────────────────────────────── -->
	<section class="bg-bg px-6 py-16">
		<div class="mx-auto max-w-5xl">
			<p class="mb-2 text-center text-[11px] font-bold tracking-widest text-primary uppercase">
				Playbook
			</p>
			<h2 class="mb-2 text-center text-3xl font-black text-text max-md:text-2xl">
				Master the Market Arena
			</h2>
			<p class="mb-12 text-center text-text-secondary">
				Step into the arena and turn your market insights into victory with our three-step cycle.
			</p>

			<div class="grid grid-cols-3 gap-6 max-md:grid-cols-1">
				{#each STEPS as step, i (i)}
					<div class="relative rounded-2xl border border-border bg-surface p-6 shadow-sm">
						<div
							class="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-muted text-lg font-black text-primary"
						>
							{step.num}
						</div>
						<h3 class="mb-2 text-base font-bold text-text">{step.title}</h3>
						<p class="text-sm leading-relaxed text-text-secondary">{step.desc}</p>
						<!-- connector line -->
						{#if i < STEPS.length - 1}
							<div class="absolute top-10 -right-3 hidden h-px w-6 bg-border md:block"></div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- ── Winner's Circle ───────────────────────────────────────────── -->
	<section class="bg-bg px-6 py-16">
		<div class="mx-auto max-w-5xl">
			<p class="mb-2 text-center text-[11px] font-bold tracking-widest text-sector-wildcard uppercase">
				Hall of Fame
			</p>
			<h2 class="mb-10 text-center text-3xl font-black text-text max-md:text-2xl">
				The Winner's Circle
			</h2>

			<div class="grid grid-cols-2 gap-4 max-md:grid-cols-1">
				{#each WINNERS as w (w.name)}
					<div class="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
						<div
							class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-black text-white"
							style="background: {w.color}"
						>
							{w.initials}
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-bold text-text">{w.name}</p>
							<div class="mt-0.5 flex items-center gap-2">
								<span class="rounded-full bg-positive/15 px-2 py-0.5 text-[10px] font-semibold text-positive"
									>{w.pts}</span
								>
								<span class="text-[11px] text-text-muted">{w.contest} · {w.time}</span>
							</div>
						</div>
						<div class="text-right">
							<p class="text-sm font-black text-text">{w.reward}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- ── CTA Banner ─────────────────────────────────────────────────── -->
	<section class="bg-surface px-6 py-16 text-center text-text">
		<div class="mx-auto max-w-2xl">
			<h2 class="mb-3 text-3xl font-black max-md:text-2xl">
				Ready to Dominate the<br /><span class="text-primary">Digital Arena?</span>
			</h2>
			<p class="mb-8 text-text-secondary">
				Join over 50,000 traders competing for the most prestigious prize pools in crypto fantasy.
				Your research is your cheat code.
			</p>
			<div class="flex flex-wrap justify-center gap-4">
				<a
					href="/dashboard"
					class="inline-flex h-12 items-center rounded-xl bg-primary px-8 text-sm font-bold text-white no-underline shadow-lg shadow-primary/30 transition hover:bg-primary-hover"
					>Start Your Draft</a
				>
				<a
					href="/leaderboard"
					class="inline-flex h-12 items-center rounded-xl border border-border bg-transparent px-8 text-sm font-medium text-text-secondary no-underline transition hover:bg-hover"
					>View Leaderboard</a
				>
			</div>
			<p class="mt-6 text-[11px] text-text-muted">Secure. Transparent. Audited smart-contracts.</p>
		</div>
	</section>

	<!-- ── Footer ─────────────────────────────────────────────────────── -->
	<footer
		class="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-bg px-6 py-5 text-[11px] text-text-muted"
	>
		<span>© 2026 CoinDraft / SoSoValue. All rights reserved.</span>
		<div class="flex gap-5">
			<a href="/dashboard" class="text-text-muted no-underline hover:text-text-secondary">Dashboard</a>
			<a href="/draft" class="text-text-muted no-underline hover:text-text-secondary">Draft</a>
			<a href="/leaderboard" class="text-text-muted no-underline hover:text-text-secondary">Leaderboard</a>
		</div>
	</footer>
</div>
