<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from '$lib/toast';

	type Question = {
		id: string;
		question: string;
		options: Array<{ label: string; value: string }>;
		sector: string | null;
		xpReward: number;
		boostSector: string | null;
		alreadyAnswered: boolean;
		previousAnswer: string | null;
		wasCorrect: boolean | null;
	};

	let question = $state<Question | null>(null);
	let selected = $state('');
	let loading = $state(true);
	let submitting = $state(false);
	let result = $state<{
		correct: boolean;
		xpEarned: number;
		boostSector: string | null;
		correctAnswer: string;
	} | null>(null);

	onMount(loadQuestion);

	async function loadQuestion() {
		loading = true;
		try {
			const res = await fetch('/api/gauntlet/today');
			if (res.ok) {
				question = await res.json();
			} else {
				question = null;
			}
		} catch {
			question = null;
		} finally {
			loading = false;
		}
	}

	async function submitAnswer() {
		if (!question || !selected) return;
		submitting = true;
		try {
			const res = await fetch('/api/gauntlet/answer', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ questionId: question.id, answer: selected })
			});
			const data = await res.json();
			if (res.ok) {
				result = data;
				if (data.correct) {
					toast(`+${data.xpEarned} XP! Boost unlocked!`, 'success');
				} else {
					toast('Not quite — come back tomorrow!', 'error');
				}
			} else {
				toast(data.error || 'Failed to submit', 'error');
			}
		} catch {
			toast('Submit failed', 'error');
		} finally {
			submitting = false;
		}
	}
</script>

<div class="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
	<div class="mb-4 flex items-center gap-2">
		<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEEDFE]">
			<svg
				class="h-4 w-4 text-[#534AB7]"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
			</svg>
		</div>
		<div>
			<h3 class="text-sm font-semibold text-[#1c1b22]">Daily Gauntlet</h3>
			<p class="text-[11px] text-[#888780]">Answer correctly for XP + draft boost</p>
		</div>
	</div>

	{#if loading}
		<div class="h-24 animate-pulse rounded-lg bg-[#f0f0f0]"></div>
	{:else if !question}
		<p class="text-sm text-[#888780]">No challenge available today. Check back tomorrow!</p>
	{:else if result}
		<div class="rounded-lg p-4 {result.correct ? 'bg-[#E1F5EE]' : 'bg-[#FAECE7]'}">
			<p class="text-sm font-semibold {result.correct ? 'text-[#0F6E56]' : 'text-[#993C1D]'} mb-1">
				{result.correct ? 'Correct!' : 'Not quite!'}
			</p>
			<p class="text-xs text-[#5d5d6b]">
				{result.correct
					? `+${result.xpEarned} XP earned${result.boostSector ? ` · ${result.boostSector.toUpperCase()} boost unlocked` : ''}`
					: `The correct answer was: ${result.correctAnswer}`}
			</p>
		</div>
	{:else if question.alreadyAnswered}
		<div class="rounded-lg bg-[#f0f0f0] p-4">
			<p class="text-sm text-[#5d5d6b]">
				You already answered today{question.wasCorrect ? ' — and got it right!' : ''}
			</p>
		</div>
	{:else}
		<p class="mb-3 text-sm font-medium text-[#1c1b22]">{question.question}</p>
		<div class="flex flex-col gap-2">
			{#each question.options as opt (opt.value)}
				<button
					type="button"
					onclick={() => (selected = opt.value)}
					class="flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-all
						{selected === opt.value
						? 'border-[#534AB7] bg-[#EEEDFE] text-[#534AB7]'
						: 'border-black/10 bg-white text-[#1c1b22] hover:border-black/20'}"
				>
					<div
						class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border {selected ===
						opt.value
							? 'border-[#534AB7] bg-[#534AB7]'
							: 'border-black/20'}"
					>
						{#if selected === opt.value}
							<svg class="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
									clip-rule="evenodd"
								/>
							</svg>
						{/if}
					</div>
					{opt.label}
				</button>
			{/each}
		</div>
		<button
			onclick={submitAnswer}
			disabled={!selected || submitting}
			class="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold transition-all
				{selected && !submitting
				? 'bg-[#534AB7] text-white hover:bg-[#453fa0]'
				: 'cursor-not-allowed bg-[#e0e0e0] text-[#aaa]'}"
		>
			{submitting ? 'Submitting...' : 'Submit Answer'}
		</button>
	{/if}
</div>
