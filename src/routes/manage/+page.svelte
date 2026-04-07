<script lang="ts">
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
		<h1 class="text-2xl font-bold text-gray-900">Content Management</h1>
	</div>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<a href="/import" class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
			<h2 class="text-lg font-semibold text-gray-900">Import JSON</h2>
			<p class="mt-1 text-sm text-gray-500">Import a new study guide from JSON</p>
		</a>
		<a href="/study/setup" class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
			<h2 class="text-lg font-semibold text-gray-900">Custom Session</h2>
			<p class="mt-1 text-sm text-gray-500">Create a custom study session</p>
		</a>
	</div>

	{#if themes.length > 0}
		<div>
			<h2 class="mb-3 text-lg font-semibold text-gray-800">Manage Themes</h2>
			<div class="space-y-2">
				{#each themes as theme}
					<a
						href="/manage/themes/{theme.id}"
						class="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 transition-shadow hover:shadow-sm"
					>
						<span class="font-medium text-gray-900">{theme.title}</span>
						<span class="text-sm text-gray-400">&rarr;</span>
					</a>
				{/each}
			</div>
		</div>
	{:else}
		<div class="rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
			<p class="text-lg font-medium text-gray-600">No content yet</p>
			<p class="mt-1 text-sm text-gray-400">Import a study guide to get started</p>
			<a href="/import" class="mt-3 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
				Import JSON
			</a>
		</div>
	{/if}
</div>
