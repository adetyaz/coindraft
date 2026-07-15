<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { toast } from '$lib/toast';
	import Toast from '$lib/components/Toast.svelte';

	type Role = 'user' | 'assistant';
	type Message = { role: Role; content: string };
	type Token = { currency_id: string; symbol?: string; name?: string };

	let messages = $state<Message[]>([]);
	let input = $state('');
	let streaming = $state(false);
	let error = $state('');
	let tokens = $state<Token[]>([]);
	let scrollEl: HTMLDivElement | null = null;

	const SUGGESTIONS = [
		'Should I pick ETH or SOL right now?',
		"What's the strongest sector today?",
		'Explain what a good Wildcard pick looks like',
		'What does 24h volume tell me about a token?'
	];

	onMount(async () => {
		try {
			const res = await fetch('/api/tokens');
			if (res.ok) tokens = await res.json();
		} catch {
			/* token-linking is a nice-to-have; chat still works without it */
		}
	});

	const tokenBySymbol = $derived.by(() => {
		const map = new Map<string, Token>();
		for (const t of tokens) {
			if (t.symbol) map.set(t.symbol.toUpperCase(), t);
		}
		return map;
	});

	function extractMentionedTokens(text: string): Token[] {
		const found = new Map<string, Token>();
		const words = text.match(/\b[A-Z]{2,10}\b/g) ?? [];
		for (const w of words) {
			const t = tokenBySymbol.get(w);
			if (t && !found.has(t.currency_id)) found.set(t.currency_id, t);
		}
		return [...found.values()];
	}

	async function scrollToBottom() {
		await tick();
		scrollEl?.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
	}

	async function send(question?: string) {
		const text = (question ?? input).trim();
		if (!text || streaming) return;

		error = '';
		input = '';
		messages = [...messages, { role: 'user', content: text }, { role: 'assistant', content: '' }];
		streaming = true;
		scrollToBottom();

		try {
			const res = await fetch('/api/mentor', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messages: messages.slice(0, -1) })
			});

			if (!res.ok || !res.body) {
				if (res.status === 401) {
					window.location.href = '/?auth=required';
					return;
				}
				const payload = await res.json().catch(() => ({}));
				throw new Error(payload?.error ?? 'Mentor is unavailable right now');
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let acc = '';
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				acc += decoder.decode(value, { stream: true });
				messages[messages.length - 1] = { role: 'assistant', content: acc };
				scrollToBottom();
			}
			if (!acc.trim()) {
				messages[messages.length - 1] = {
					role: 'assistant',
					content: "Sorry, I didn't get a response that time — try asking again."
				};
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Mentor is unavailable right now';
			messages = messages.slice(0, -1);
			toast(error, 'error');
		} finally {
			streaming = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}
</script>

<div class="mx-auto flex h-[calc(100vh-44px)] max-w-3xl flex-col px-3.5 py-4">
	<div class="mb-3 flex items-center gap-2">
		<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
			<svg
				class="h-4 w-4 text-white"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
				/>
			</svg>
		</div>
		<div>
			<h1 class="text-sm font-bold text-text">AI Mentor</h1>
			<p class="text-[11px] text-text-muted">Grounded in live sector, token, and news data</p>
		</div>
	</div>

	<div
		bind:this={scrollEl}
		class="flex-1 space-y-3 overflow-y-auto rounded-xl border border-border bg-surface p-4"
	>
		{#if messages.length === 0}
			<div class="flex h-full flex-col items-center justify-center gap-4 text-center">
				<p class="text-sm text-text-muted">Ask about a token, a sector, or how to build your lineup.</p>
				<div class="flex flex-wrap justify-center gap-2">
					{#each SUGGESTIONS as s (s)}
						<button
							class="cursor-pointer rounded-full border border-primary/20 bg-primary-muted px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20"
							onclick={() => send(s)}
						>
							{s}
						</button>
					{/each}
				</div>
			</div>
		{:else}
			{#each messages as msg, i (i)}
				<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
					<div
						class="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap
						{msg.role === 'user' ? 'bg-primary text-white' : 'bg-surface-raised text-text'}"
					>
						{#if msg.role === 'assistant' && msg.content === '' && streaming && i === messages.length - 1}
							<span class="inline-flex gap-1">
								<span class="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted"></span>
								<span
									class="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted"
									style="animation-delay: 0.15s"
								></span>
								<span
									class="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted"
									style="animation-delay: 0.3s"
								></span>
							</span>
						{:else}
							{msg.content}
						{/if}

						{#if msg.role === 'assistant' && msg.content && (i < messages.length - 1 || !streaming)}
							{@const mentioned = extractMentionedTokens(msg.content)}
							{#if mentioned.length > 0}
								<div class="mt-2 flex flex-wrap gap-1.5 border-t border-border pt-2">
									{#each mentioned as t (t.currency_id)}
										<a
											href={`/draft?highlight=${t.currency_id}`}
											class="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-primary no-underline shadow-sm hover:underline"
										>
											{(t.symbol ?? '').toUpperCase()} → Draft
										</a>
									{/each}
								</div>
							{/if}
						{/if}
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<div class="mt-3 flex gap-2">
		<textarea
			bind:value={input}
			onkeydown={handleKeydown}
			disabled={streaming}
			placeholder="Ask the mentor anything about tokens or sectors…"
			rows="1"
			class="flex-1 resize-none rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary"
		></textarea>
		<button
			onclick={() => send()}
			disabled={streaming || !input.trim()}
			class="cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
		>
			Send
		</button>
	</div>
</div>

<Toast />
