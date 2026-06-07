<script lang="ts">
	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleLogin() {
		loading = true;
		error = '';

		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});

			if (!res.ok) {
				const data = await res.json();
				error = data.error || 'Login failed';
				return;
			}

			window.location.href = '/dashboard';
		} catch (err) {
			error = 'Network error. Try again.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex min-h-[calc(100vh-44px)] items-center justify-center bg-[#f5f5f5]">
	<div
		class="w-full max-w-md rounded-xl border border-[#e0e0e0] bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
	>
		<h1 class="mb-6 text-center text-2xl font-medium">Login to CoinDraft</h1>

		<form
			class="flex flex-col gap-4"
			onsubmit={(e) => {
				e.preventDefault();
				handleLogin();
			}}
		>
			<div class="flex flex-col gap-1.5">
				<label class="text-sm font-medium text-[#333]" for="login-email">Email</label>
				<input
					id="login-email"
					class="rounded-md border border-[#ddd] px-3 py-2.5 text-sm transition focus:border-[#534ab7] focus:ring-2 focus:ring-[rgba(83,74,183,0.1)] focus:outline-none disabled:bg-[#f5f5f5] disabled:text-[#999]"
					type="email"
					bind:value={email}
					placeholder="you@example.com"
					required
					disabled={loading}
				/>
			</div>

			<div class="flex flex-col gap-1.5">
				<label class="text-sm font-medium text-[#333]" for="login-password">Password</label>
				<input
					id="login-password"
					class="rounded-md border border-[#ddd] px-3 py-2.5 text-sm transition focus:border-[#534ab7] focus:ring-2 focus:ring-[rgba(83,74,183,0.1)] focus:outline-none disabled:bg-[#f5f5f5] disabled:text-[#999]"
					type="password"
					bind:value={password}
					placeholder="••••••••"
					required
					disabled={loading}
				/>
			</div>

			{#if error}
				<div class="rounded-md bg-[#faece7] px-3 py-2.5 text-[13px] text-[#993c1d]">{error}</div>
			{/if}

			<button
				type="submit"
				disabled={loading}
				class="mt-2 cursor-pointer rounded-lg border-0 bg-[#534ab7] p-3 text-sm font-medium text-white transition hover:bg-[#4a3d9e] disabled:cursor-not-allowed disabled:bg-[#ccc]"
			>
				{loading ? 'Logging in...' : 'Login'}
			</button>
		</form>

		<p class="mt-4 text-center text-[13px] text-[#666]">
			Don't have an account? <a
				class="font-medium text-[#534ab7] no-underline hover:underline"
				href="/signup">Sign up</a
			>
		</p>
	</div>
</div>
