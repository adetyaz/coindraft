<script lang="ts">
	import { onMount } from 'svelte';
	import { SECTORS } from '$lib/constants';
	import { toast } from '$lib/toast';
	import Toast from '$lib/components/Toast.svelte';

	type Article = {
		id: string;
		title: string;
		content: string;
		source: string;
		date: string | null;
		url: string | null;
		symbols: string[];
		sector: string;
	};

	let articles = $state<Article[]>([]);
	let loading = $state(true);
	let activeFilter = $state('all');
	let expandedId = $state('');
	let boostClaimedToday = $state(false);
	let claiming = $state(false);

	function sectorStyle(varName: string) {
		return {
			color: `var(--color-sector-${varName})`,
			bg: `color-mix(in oklab, var(--color-sector-${varName}) 18%, transparent)`
		};
	}
	const SECTOR_STYLE: Record<string, { color: string; bg: string }> = {
		l1: sectorStyle('l1'),
		l2: sectorStyle('l2'),
		defi: sectorStyle('defi'),
		meme: sectorStyle('meme'),
		wildcard: sectorStyle('wildcard')
	};

	onMount(async () => {
		try {
			const res = await fetch('/api/news');
			if (res.ok) {
				const data = await res.json();
				articles = Array.isArray(data) ? data : [];
			}
		} catch {
			/* leave articles empty, UI shows the empty state */
		} finally {
			loading = false;
		}
	});

	const filtered = $derived(
		activeFilter === 'all' ? articles : articles.filter((a) => a.sector === activeFilter)
	);

	function sectorName(id: string): string {
		return SECTORS.find((s) => s.id === id)?.name ?? 'Wildcard';
	}

	function fmtDate(iso: string | null): string {
		if (!iso) return '';
		return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	async function expand(article: Article) {
		const wasExpanded = expandedId === article.id;
		expandedId = wasExpanded ? '' : article.id;
		if (wasExpanded || boostClaimedToday || claiming) return;

		claiming = true;
		try {
			const res = await fetch('/api/research/read', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ articleId: article.id, sector: article.sector })
			});
			if (res.status === 401) {
				window.location.href = '/?auth=required';
				return;
			}
			const data = await res.json();
			if (data.awarded) {
				boostClaimedToday = true;
				toast(`+${data.xp} XP · ${sectorName(data.sector)} boost active for 24h`, 'success');
			} else {
				boostClaimedToday = true;
			}
		} catch {
			/* boost claiming is a bonus, not critical — fail silently */
		} finally {
			claiming = false;
		}
	}
</script>

<div class="flex flex-col gap-3">
	<div>
		<h1 class="text-lg font-semibold text-text">Research Hub</h1>
		<p class="mt-0.5 text-xs text-text-muted">
			Read one article a day for a free sector boost on your next draft.
		</p>
	</div>

	<div class="flex flex-wrap gap-1.5">
		<button
			class="cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition {activeFilter ===
			'all'
				? 'border-primary bg-primary-muted text-primary'
				: 'border-border bg-surface text-text-secondary hover:bg-hover'}"
			onclick={() => (activeFilter = 'all')}>All</button
		>
		{#each SECTORS as s (s.id)}
			<button
				class="cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition {activeFilter ===
				s.id
					? 'border-primary bg-primary-muted text-primary'
					: 'border-border bg-surface text-text-secondary hover:bg-hover'}"
				onclick={() => (activeFilter = s.id)}>{s.name}</button
			>
		{/each}
	</div>

	{#if loading}
		<p class="py-8 text-center text-sm text-text-muted">Loading research feed...</p>
	{:else if filtered.length === 0}
		<p class="py-8 text-center text-sm text-text-muted">No articles available right now.</p>
	{:else}
		<div class="flex flex-col gap-2">
			{#each filtered as article (article.id)}
				{@const style = SECTOR_STYLE[article.sector] ?? SECTOR_STYLE.wildcard}
				{@const isOpen = expandedId === article.id}
				<div class="rounded-xl border border-border bg-surface px-4 py-3">
					<button
						type="button"
						class="flex w-full cursor-pointer items-start justify-between gap-3 text-left"
						onclick={() => expand(article)}
					>
						<div class="min-w-0 flex-1">
							<div class="mb-1 flex items-center gap-2">
								<span
									class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
									style="background: {style.bg}; color: {style.color}"
									>{sectorName(article.sector)}</span
								>
								<span class="text-[11px] text-text-muted"
									>{article.source}{article.date ? ` · ${fmtDate(article.date)}` : ''}</span
								>
							</div>
							<p class="text-sm font-medium text-text">{article.title}</p>
						</div>
						<svg
							class="mt-1 h-4 w-4 shrink-0 text-text-muted transition-transform {isOpen
								? 'rotate-180'
								: ''}"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<polyline points="6 9 12 15 18 9" />
						</svg>
					</button>
					{#if isOpen}
						<div class="mt-3 border-t border-border pt-3">
							<p class="text-[13px] leading-relaxed whitespace-pre-line text-text-secondary">
								{article.content}
							</p>
							{#if article.url}
								<a
									href={article.url}
									target="_blank"
									rel="noopener noreferrer"
									class="mt-2 inline-block text-[11px] font-medium text-primary hover:underline"
									>Read full source →</a
								>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<Toast />
