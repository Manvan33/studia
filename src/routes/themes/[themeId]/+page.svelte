<script lang="ts">
	import { page } from '$app/state';
	import { db } from '$lib/db';
	import type { LearningTheme, Chapter } from '$lib/types';
	import { liveQuery } from 'dexie';

	let theme = $state<LearningTheme | undefined>();
	let chapters = $state<Chapter[]>([]);

	const themeId = $derived(page.params.themeId ?? '');

	$effect(() => {
		const id = themeId;
		const sub1 = liveQuery(() => db.themes.get(id)).subscribe({
			next: (v) => (theme = v)
		});
		const sub2 = liveQuery(() => db.chapters.where('themeId').equals(id).sortBy('order')).subscribe(
			{
				next: (v) => (chapters = v)
			}
		);
		return () => {
			sub1.unsubscribe();
			sub2.unsubscribe();
		};
	});
</script>

{#if theme}
	<div class="space-y-6">
		<div>
			<a href="/themes" class="text-sm text-primary-600 hover:text-primary-700">&larr; All Themes</a>
			<h1 class="mt-2 text-2xl font-bold text-gray-900">{theme.title}</h1>
			{#if theme.description}
				<p class="mt-1 text-gray-500">{theme.description}</p>
			{/if}
		</div>

		{#if chapters.length === 0}
			<p class="text-gray-500">No chapters in this theme yet.</p>
		{:else}
			<div class="space-y-3">
				{#each chapters as chapter, i}
					<a
						href="/themes/{theme.id}/chapters/{chapter.id}"
						class="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
					>
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-sm font-bold text-primary-700"
						>
							{i + 1}
						</div>
						<div>
							<h3 class="font-semibold text-gray-900">{chapter.title}</h3>
							{#if chapter.description}
								<p class="text-sm text-gray-500">{chapter.description}</p>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<p class="text-gray-500">Loading...</p>
{/if}
