<script lang="ts">
	import { base } from '$app/paths';
	import { db } from '$lib/db';
	import type { LearningTheme } from '$lib/types';
	import { liveQuery } from 'dexie';

	let themes = $state<LearningTheme[]>([]);

	$effect(() => {
		const sub = liveQuery(() => db.themes.toArray()).subscribe({
			next: (v) => (themes = v)
		});
		return () => sub.unsubscribe();
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-gray-900">Learning Themes</h1>
		<a
			href="{base}/import"
			class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
		>
			Import New
		</a>
	</div>

	{#if themes.length === 0}
		<div class="rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
			<p class="text-lg font-medium text-gray-600">No themes yet</p>
			<p class="mt-1 text-sm text-gray-400">Import a JSON study guide to create your first theme</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			{#each themes as theme}
				<a
					href="{base}/themes/{theme.id}"
					class="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
				>
					<h2 class="text-lg font-semibold text-gray-900">{theme.title}</h2>
					{#if theme.description}
						<p class="mt-1 text-sm text-gray-500">{theme.description}</p>
					{/if}
					<p class="mt-3 text-xs text-gray-400">
						Created {new Date(theme.createdAt).toLocaleDateString()}
					</p>
				</a>
			{/each}
		</div>
	{/if}
</div>
