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
	let dragChapterId = $state('');
	let dropTargetChapterId = $state('');
	let savingChapterOrder = $state(false);

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

	async function persistChapterOrder(orderedChapters: Chapter[]) {
		savingChapterOrder = true;
		const now = new Date().toISOString();
		try {
			await db.chapters.bulkPut(
				orderedChapters.map((chapter, index) => ({
					...chapter,
					order: index + 1,
					updatedAt: now
				}))
			);
		} finally {
			savingChapterOrder = false;
		}
	}

	async function reorderChapter(sourceChapterId: string, targetChapterId: string) {
		if (sourceChapterId === targetChapterId) return;

		const nextChapters = [...chapters];
		const sourceIndex = nextChapters.findIndex((chapter) => chapter.id === sourceChapterId);
		const targetIndex = nextChapters.findIndex((chapter) => chapter.id === targetChapterId);

		if (sourceIndex < 0 || targetIndex < 0) return;

		const [movedChapter] = nextChapters.splice(sourceIndex, 1);
		nextChapters.splice(targetIndex, 0, movedChapter);
		chapters = nextChapters;
		await persistChapterOrder(nextChapters);
	}

	async function sortChaptersByName() {
		const sortedChapters = [...chapters].sort((a, b) =>
			a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
		);
		chapters = sortedChapters;
		await persistChapterOrder(sortedChapters);
	}

	function handleDragStart(event: DragEvent, chapterId: string) {
		dragChapterId = chapterId;
		event.dataTransfer?.setData('text/plain', chapterId);
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
		}
	}

	function handleDragOver(event: DragEvent, chapterId: string) {
		event.preventDefault();
		dropTargetChapterId = chapterId;
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}

	function handleDragLeave(chapterId: string) {
		if (dropTargetChapterId === chapterId) {
			dropTargetChapterId = '';
		}
	}

	async function handleDrop(event: DragEvent, targetChapterId: string) {
		event.preventDefault();
		const sourceChapterId = dragChapterId || event.dataTransfer?.getData('text/plain') || '';
		dropTargetChapterId = '';
		dragChapterId = '';

		if (!sourceChapterId || sourceChapterId === targetChapterId) return;
		await reorderChapter(sourceChapterId, targetChapterId);
	}

	function handleDragEnd() {
		dropTargetChapterId = '';
		dragChapterId = '';
	}

	async function deleteTheme() {
		const chapterIds = chapters.map((c) => c.id);
		await db.transaction('rw', [db.themes, db.chapters, db.topics, db.questions], async () => {
			for (const cid of chapterIds) {
				const topicIds = (await db.topics.where('chapterId').equals(cid).toArray()).map(
					(t) => t.id
				);
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
					<label for="theme-title" class="mb-1 block text-sm font-medium text-gray-700">Title</label
					>
					<input
						id="theme-title"
						bind:value={editingTitle}
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
					/>
				</div>
				<div>
					<label for="theme-desc" class="mb-1 block text-sm font-medium text-gray-700"
						>Description</label
					>
					<textarea
						id="theme-desc"
						bind:value={editingDescription}
						rows="2"
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
					></textarea>
				</div>
				<div class="flex flex-wrap gap-3">
					<button
						onclick={saveTheme}
						class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
					>
						Save Changes
					</button>
					<a
						href="/manage/themes/{themeId}/json"
						class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
					>
						Edit as JSON
					</a>
				</div>
			</div>
		</div>

		<div>
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-gray-800">Chapters</h2>
				<div class="flex items-center gap-3">
					<button
						type="button"
						onclick={sortChaptersByName}
						disabled={savingChapterOrder || chapters.length < 2}
						class="text-sm text-gray-600 hover:text-gray-800 disabled:cursor-not-allowed disabled:text-gray-300"
					>
						Sort by name
					</button>
					<button
						type="button"
						onclick={() => (showAddChapter = !showAddChapter)}
						class="text-sm text-primary-600 hover:text-primary-700"
					>
						{showAddChapter ? 'Cancel' : '+ Add Chapter'}
					</button>
				</div>
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
						<button
							onclick={addChapter}
							class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
						>
							Add Chapter
						</button>
					</div>
				</div>
			{/if}

			<ul class="space-y-2" role="list">
				{#each chapters as chapter, i}
					<li
						role="listitem"
						class="flex items-center justify-between rounded-lg border bg-white px-4 py-3 transition-colors hover:shadow-sm {dropTargetChapterId ===
						chapter.id
							? 'border-primary-300 bg-primary-50'
							: 'border-gray-200'}"
						ondragover={(event) => handleDragOver(event, chapter.id)}
						ondragleave={() => handleDragLeave(chapter.id)}
						ondrop={(event) => handleDrop(event, chapter.id)}
					>
						<div class="flex min-w-0 items-center gap-3">
							<button
								type="button"
								draggable="true"
								ondragstart={(event) => handleDragStart(event, chapter.id)}
								ondragend={handleDragEnd}
								class="cursor-grab rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing"
								aria-label="Reorder chapter {chapter.title}"
								disabled={savingChapterOrder}
							>
								<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
									<circle cx="6" cy="4" r="1.25" />
									<circle cx="6" cy="10" r="1.25" />
									<circle cx="6" cy="16" r="1.25" />
									<circle cx="14" cy="4" r="1.25" />
									<circle cx="14" cy="10" r="1.25" />
									<circle cx="14" cy="16" r="1.25" />
								</svg>
							</button>
							<span class="text-sm font-medium text-gray-400">{i + 1}</span>
							<a
								href="/manage/chapters/{chapter.id}"
								class="truncate font-medium text-gray-900 hover:text-primary-700 hover:underline"
							>
								{chapter.title}
							</a>
						</div>
						<span class="text-sm text-gray-400">&rarr;</span>
					</li>
				{/each}
			</ul>
			<p class="mt-2 text-xs text-gray-400">Drag using the handle to reorder chapters.</p>
		</div>

		<div class="border-t border-gray-200 pt-6">
			{#if confirmDelete}
				<div class="rounded-lg border border-red-200 bg-red-50 p-4">
					<p class="text-sm text-red-700">
						Delete this theme and all its content? This cannot be undone.
					</p>
					<div class="mt-3 flex gap-3">
						<button
							onclick={deleteTheme}
							class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
						>
							Yes, Delete
						</button>
						<button
							onclick={() => (confirmDelete = false)}
							class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
						>
							Cancel
						</button>
					</div>
				</div>
			{:else}
				<button
					onclick={() => (confirmDelete = true)}
					class="text-sm text-red-600 hover:text-red-700"
				>
					Delete Theme
				</button>
			{/if}
		</div>
	</div>
{:else}
	<p class="text-gray-500">Loading...</p>
{/if}
