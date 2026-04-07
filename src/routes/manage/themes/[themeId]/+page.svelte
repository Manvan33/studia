<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { db } from '$lib/db';
	import { nanoid } from 'nanoid';
	import type { LearningTheme, Chapter } from '$lib/types';
	import { liveQuery } from 'dexie';

	const themeId = $derived(page.params.themeId ?? '');

	let theme = $state<LearningTheme | undefined>();
	let chapters = $state<Chapter[]>([]);
	let editingTitle = $state('');
	let editingDescription = $state('');
	let showAddChapter = $state(false);
	let newChapterTitle = $state('');
	let newChapterDescription = $state('');
	let confirmDelete = $state(false);

	$effect(() => {
		const id = themeId;
		const sub1 = liveQuery(() => db.themes.get(id)).subscribe({
			next: (v) => {
				theme = v;
				if (v) {
					editingTitle = v.title;
					editingDescription = v.description ?? '';
				}
			}
		});
		const sub2 = liveQuery(() => db.chapters.where('themeId').equals(id).sortBy('order')).subscribe({
			next: (v) => (chapters = v)
		});
		return () => {
			sub1.unsubscribe();
			sub2.unsubscribe();
		};
	});

	async function saveTheme() {
		if (!editingTitle.trim()) return;
		await db.themes.update(themeId, {
			title: editingTitle.trim(),
			description: editingDescription.trim() || undefined,
			updatedAt: new Date().toISOString()
		});
	}

	async function addChapter() {
		if (!newChapterTitle.trim()) return;
		const now = new Date().toISOString();
		await db.chapters.add({
			id: nanoid(),
			themeId,
			title: newChapterTitle.trim(),
			description: newChapterDescription.trim() || undefined,
			order: chapters.length + 1,
			createdAt: now,
			updatedAt: now
		});
		newChapterTitle = '';
		newChapterDescription = '';
		showAddChapter = false;
	}

	async function deleteTheme() {
		const chapterIds = chapters.map((c) => c.id);
		await db.transaction('rw', [db.themes, db.chapters, db.topics, db.questions], async () => {
			for (const cid of chapterIds) {
				const topicIds = (await db.topics.where('chapterId').equals(cid).toArray()).map((t) => t.id);
				await db.questions.where('chapterId').equals(cid).delete();
				await db.topics.bulkDelete(topicIds);
			}
			await db.chapters.bulkDelete(chapterIds);
			await db.themes.delete(themeId);
		});
		goto('/manage');
	}
</script>

{#if theme}
	<div class="mx-auto max-w-2xl space-y-6">
		<div>
			<a href="/manage" class="text-sm text-primary-600 hover:text-primary-700">&larr; Back</a>
			<h1 class="mt-2 text-2xl font-bold text-gray-900">Edit Theme</h1>
		</div>

		<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			<div class="space-y-4">
				<div>
					<label for="theme-title" class="mb-1 block text-sm font-medium text-gray-700">Title</label>
					<input
						id="theme-title"
						bind:value={editingTitle}
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
					/>
				</div>
				<div>
					<label for="theme-desc" class="mb-1 block text-sm font-medium text-gray-700">Description</label>
					<textarea
						id="theme-desc"
						bind:value={editingDescription}
						rows="2"
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
					></textarea>
				</div>
				<button onclick={saveTheme} class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
					Save Changes
				</button>
			</div>
		</div>

		<div>
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-gray-800">Chapters</h2>
				<button
					onclick={() => (showAddChapter = !showAddChapter)}
					class="text-sm text-primary-600 hover:text-primary-700"
				>
					{showAddChapter ? 'Cancel' : '+ Add Chapter'}
				</button>
			</div>

			{#if showAddChapter}
				<div class="mb-4 rounded-lg border border-gray-200 bg-white p-4">
					<div class="space-y-3">
						<input
							bind:value={newChapterTitle}
							placeholder="Chapter title"
							class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
						/>
						<input
							bind:value={newChapterDescription}
							placeholder="Description (optional)"
							class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
						/>
						<button onclick={addChapter} class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
							Add Chapter
						</button>
					</div>
				</div>
			{/if}

			<div class="space-y-2">
				{#each chapters as chapter, i}
					<a
						href="/manage/chapters/{chapter.id}"
						class="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 hover:shadow-sm"
					>
						<div class="flex items-center gap-3">
							<span class="text-sm font-medium text-gray-400">{i + 1}</span>
							<span class="font-medium text-gray-900">{chapter.title}</span>
						</div>
						<span class="text-sm text-gray-400">&rarr;</span>
					</a>
				{/each}
			</div>
		</div>

		<div class="border-t border-gray-200 pt-6">
			{#if confirmDelete}
				<div class="rounded-lg border border-red-200 bg-red-50 p-4">
					<p class="text-sm text-red-700">Delete this theme and all its content? This cannot be undone.</p>
					<div class="mt-3 flex gap-3">
						<button onclick={deleteTheme} class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
							Yes, Delete
						</button>
						<button onclick={() => (confirmDelete = false)} class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
							Cancel
						</button>
					</div>
				</div>
			{:else}
				<button onclick={() => (confirmDelete = true)} class="text-sm text-red-600 hover:text-red-700">
					Delete Theme
				</button>
			{/if}
		</div>
	</div>
{:else}
	<p class="text-gray-500">Loading...</p>
{/if}
