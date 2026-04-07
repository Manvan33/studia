<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();

	let mobileMenuOpen = $state(false);

	const navItems = [
		{ href: '/', label: 'Dashboard', icon: '📊' },
		{ href: '/themes', label: 'Themes', icon: '📚' },
		{ href: '/history', label: 'History', icon: '📋' },
		{ href: '/import', label: 'Import', icon: '📥' },
		{ href: '/manage', label: 'Manage', icon: '⚙️' }
	];

	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex min-h-screen flex-col bg-gray-50">
	<header class="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
		<div class="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
			<a href="/" class="text-xl font-bold text-primary-700">Studia</a>

			<nav class="hidden gap-1 md:flex">
				{#each navItems as item}
					<a
						href={item.href}
						class="rounded-lg px-3 py-2 text-sm font-medium transition-colors {isActive(item.href)
							? 'bg-primary-50 text-primary-700'
							: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
					>
						{item.label}
					</a>
				{/each}
			</nav>

			<button
				class="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
				onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
				aria-label="Toggle menu"
			>
				<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					{#if mobileMenuOpen}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					{:else}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
					{/if}
				</svg>
			</button>
		</div>

		{#if mobileMenuOpen}
			<nav class="border-t border-gray-200 bg-white px-4 pb-3 md:hidden">
				{#each navItems as item}
					<a
						href={item.href}
						class="block rounded-lg px-3 py-2 text-sm font-medium transition-colors {isActive(item.href)
							? 'bg-primary-50 text-primary-700'
							: 'text-gray-600 hover:bg-gray-100'}"
						onclick={() => (mobileMenuOpen = false)}
					>
						<span class="mr-2">{item.icon}</span>{item.label}
					</a>
				{/each}
			</nav>
		{/if}
	</header>

	<main class="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
		{@render children()}
	</main>

	<footer class="border-t border-gray-200 bg-white py-4 text-center text-sm text-gray-500">
		Studia &mdash; Reverse Learning App
	</footer>
</div>
