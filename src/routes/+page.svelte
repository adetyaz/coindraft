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
			color: '#534AB7'
		},
		{
			initials: 'AL',
			name: 'AlphaLegend',
			reward: '$8,100 USDT',
			pts: '95.2 Pts',
			contest: 'Daily Gauntlet',
			time: '5 hours ago',
			color: '#0F6E56'
		},
		{
			initials: 'SK',
			name: 'SatoshiKnight',
			reward: '$5,500 USDT',
			pts: '92.7 Pts',
			contest: 'Meme War #2',
			time: 'Yesterday',
			color: '#D97706'
		},
		{
			initials: 'BZ',
			name: 'BullZone_OG',
			reward: '$3,200 USDT',
			pts: '91.1 Pts',
			contest: 'Late Night Draft',
			time: 'Yesterday',
			color: '#3B82F6'
		}
	];
</script>

<!-- Break out of the layout's max-w-6xl container -->
<div class="-mx-3.5 -mt-3.5">
	<!-- ── Hero ──────────────────────────────────────────────────────── -->
	<section class="relative overflow-hidden bg-[#0d0c18] px-6 py-20 text-white max-md:py-14">
		<!-- background grid pattern -->
		<div
			class="pointer-events-none absolute inset-0 opacity-[0.04]"
			style="background-image: linear-gradient(#fff 1px, transparent 1px), linear-gradient(to right, #fff 1px, transparent 1px); background-size: 48px 48px;"
		></div>
		<!-- purple glow -->
		<div
			class="pointer-events-none absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#534AB7] opacity-20 blur-3xl"
		></div>

		<div class="relative mx-auto max-w-5xl text-center">
			<!-- Live badge -->
			<div
				class="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-[#a09ecc]"
			>
				<span class="h-2 w-2 animate-pulse rounded-full bg-[#0F6E56]"></span>
				Live Now: Season 4
			</div>

			<h1 class="text-6xl leading-[1.05] font-black tracking-tight max-md:text-4xl">
				The Arena<br /><span class="text-[#7c6ff7]">of Alpha</span>
			</h1>
			<p class="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/60 max-md:text-base">
				Where degenerate energy meets institutional intelligence. Draft your winning token lineup
				and claim your share of the massive USDT prize pools.
			</p>

			<!-- Stats bar -->
			<div
				class="mx-auto mt-10 grid max-w-lg grid-cols-3 divide-x divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/5"
			>
				<div class="flex flex-col gap-1 px-6 py-4 text-center">
					<span class="text-2xl font-black text-white">$150k</span>
					<span class="text-[11px] font-medium tracking-wider text-white/40 uppercase"
						>Daily Pool</span
					>
				</div>
				<div class="flex flex-col gap-1 px-6 py-4 text-center">
					<span class="text-2xl font-black text-white">12,405</span>
					<span class="text-[11px] font-medium tracking-wider text-white/40 uppercase"
						>Active Players</span
					>
				</div>
				<div class="flex flex-col gap-1 px-6 py-4 text-center">
					<span class="text-2xl font-black text-[#7c6ff7] tabular-nums">{timerStr}</span>
					<span class="text-[11px] font-medium tracking-wider text-white/40 uppercase"
						>Next Lock In</span
					>
				</div>
			</div>

			<!-- CTA buttons -->
			<div class="mt-8 flex flex-wrap items-center justify-center gap-4">
				{#if page.data.user}
					<a
						href="/dashboard"
						class="inline-flex h-12 cursor-pointer items-center gap-2 rounded-xl bg-[#534AB7] px-8 text-sm font-bold text-white no-underline shadow-lg shadow-[#534AB7]/30 transition hover:bg-[#453fa0]"
					>
						Go to Dashboard →
					</a>
				{:else if appkitReady}
					<div class="*:h-12 *:rounded-xl *:px-8">
						<appkit-button></appkit-button>
					</div>
					<a
						href="/dashboard"
						class="inline-flex h-12 cursor-pointer items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-8 text-sm font-medium text-white/80 no-underline transition hover:bg-white/10"
					>
						View Dashboard
					</a>
				{:else}
					<button
						class="inline-flex h-12 cursor-not-allowed items-center rounded-xl bg-[#534AB7]/50 px-8 text-sm font-bold text-white/50"
						disabled>Loading Wallet…</button
					>
				{/if}
			</div>

			{#if page.url.searchParams.get('auth') === 'required'}
				<p class="mt-4 text-xs text-red-400/80">
					Sign in with your wallet to access draft and contest routes.
				</p>
			{/if}
		</div>
	</section>

	<!-- ── Playbook ───────────────────────────────────────────────────── -->
	<section class="bg-[#F8F8F7] px-6 py-16">
		<div class="mx-auto max-w-5xl">
			<p class="mb-2 text-center text-[11px] font-bold tracking-widest text-[#534AB7] uppercase">
				Playbook
			</p>
			<h2 class="mb-2 text-center text-3xl font-black text-[#1c1b22] max-md:text-2xl">
				Master the Market Arena
			</h2>
			<p class="mb-12 text-center text-[#888780]">
				Step into the arena and turn your market insights into victory with our three-step cycle.
			</p>

			<div class="grid grid-cols-3 gap-6 max-md:grid-cols-1">
				{#each STEPS as step, i (i)}
					<div class="relative rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
						<div
							class="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#eeedfe] text-lg font-black text-[#534AB7]"
						>
							{step.num}
						</div>
						<h3 class="mb-2 text-base font-bold text-[#1c1b22]">{step.title}</h3>
						<p class="text-sm leading-relaxed text-[#888780]">{step.desc}</p>
						<!-- connector line -->
						{#if i < STEPS.length - 1}
							<div class="absolute top-10 -right-3 hidden h-px w-6 bg-[#e0e0e0] md:block"></div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- ── Winner's Circle ───────────────────────────────────────────── -->
	<section class="bg-white px-6 py-16">
		<div class="mx-auto max-w-5xl">
			<p class="mb-2 text-center text-[11px] font-bold tracking-widest text-[#D97706] uppercase">
				Hall of Fame
			</p>
			<h2 class="mb-10 text-center text-3xl font-black text-[#1c1b22] max-md:text-2xl">
				The Winner's Circle
			</h2>

			<div class="grid grid-cols-2 gap-4 max-md:grid-cols-1">
				{#each WINNERS as w (w.name)}
					<div class="flex items-center gap-4 rounded-2xl border border-black/5 bg-[#fafafa] p-4">
						<div
							class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-black text-white"
							style="background: {w.color}"
						>
							{w.initials}
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-bold text-[#1c1b22]">{w.name}</p>
							<div class="mt-0.5 flex items-center gap-2">
								<span
									class="rounded-full bg-[#e1f5ee] px-2 py-0.5 text-[10px] font-semibold text-[#0F6E56]"
									>{w.pts}</span
								>
								<span class="text-[11px] text-[#888780]">{w.contest} · {w.time}</span>
							</div>
						</div>
						<div class="text-right">
							<p class="text-sm font-black text-[#1c1b22]">{w.reward}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- ── CTA Banner ─────────────────────────────────────────────────── -->
	<section class="bg-[#0d0c18] px-6 py-16 text-center text-white">
		<div class="mx-auto max-w-2xl">
			<h2 class="mb-3 text-3xl font-black max-md:text-2xl">
				Ready to Dominate the<br /><span class="text-[#7c6ff7]">Digital Arena?</span>
			</h2>
			<p class="mb-8 text-white/60">
				Join over 50,000 traders competing for the most prestigious prize pools in crypto fantasy.
				Your research is your cheat code.
			</p>
			<div class="flex flex-wrap justify-center gap-4">
				<a
					href="/dashboard"
					class="inline-flex h-12 items-center rounded-xl bg-[#534AB7] px-8 text-sm font-bold text-white no-underline shadow-lg shadow-[#534AB7]/30 transition hover:bg-[#453fa0]"
					>Start Your Draft</a
				>
				<a
					href="/dashboard"
					class="inline-flex h-12 items-center rounded-xl border border-white/20 bg-white/5 px-8 text-sm font-medium text-white/80 no-underline transition hover:bg-white/10"
					>View Leaderboard</a
				>
			</div>
			<p class="mt-6 text-[11px] text-white/30">Secure. Transparent. Audited smart-contracts.</p>
		</div>
	</section>

	<!-- ── Footer ─────────────────────────────────────────────────────── -->
	<footer
		class="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 bg-[#0d0c18] px-6 py-5 text-[11px] text-white/30"
	>
		<span>© 2025 CoinDraft / SoSoValue. All rights reserved.</span>
		<div class="flex gap-5">
			<a href="/dashboard" class="text-white/30 no-underline hover:text-white/60">Dashboard</a>
			<a href="/draft" class="text-white/30 no-underline hover:text-white/60">Draft</a>
			<a href="/manager" class="text-white/30 no-underline hover:text-white/60">Manager</a>
		</div>
	</footer>
</div>
