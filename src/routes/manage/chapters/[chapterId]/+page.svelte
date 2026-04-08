<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { db } from '$lib/db';
	import { nanoid } from 'nanoid';
	import type { Chapter, Topic, Question } from '$lib/types';
	import { liveQuery } from 'dexie';

	const chapterId = $derived(page.params.chapterId ?? '');

	let chapter = $state<Chapter | undefined>();
	let topics = $state<Topic[]>([]);
	let questions = $state<Question[]>([]);
	let editingTitle = $state('');
	let editingDescription = $state('');
	let showAddTopic = $state(false);
	let newTopicTitle = $state('');
	let confirmDelete = $state(false);
	let savingChapter = $state(false);
	let saveMessage = $state('');
	let saveMessageType = $state<'success' | 'error'>('success');

	$effect(() => {
		const id = chapterId;
		const sub1 = liveQuery(() => db.chapters.get(id)).subscribe({
			next: (v) => {
				chapter = v;
				if (v) {
					editingTitle = v.title;
					editingDescription = v.description ?? '';
				}
			}
		});
		const sub2 = liveQuery(() => db.topics.where('chapterId').equals(id).sortBy('order')).subscribe(
			{
				next: (v) => (topics = v)
			}
		);
		const sub3 = liveQuery(() => db.questions.where('chapterId').equals(id).toArray()).subscribe({
			next: (v) => (questions = v)
		});
		return () => {
			sub1.unsubscribe();
			sub2.unsubscribe();
			sub3.unsubscribe();
		};
	});

	async function saveChapter() {
		if (!editingTitle.trim()) {
			saveMessageType = 'error';
			saveMessage = 'Title is required';
			return;
		}

		savingChapter = true;
		saveMessage = '';

		try {
			await db.chapters.update(chapterId, {
				title: editingTitle.trim(),
				description: editingDescription.trim() || undefined,
				updatedAt: new Date().toISOString()
			});
			saveMessageType = 'success';
			saveMessage = 'Changes saved';
			setTimeout(() => {
				saveMessage = '';
			}, 2000);
		} catch {
			saveMessageType = 'error';
			saveMessage = 'Failed to save changes';
		} finally {
			savingChapter = false;
		}
	}

	async function addTopic() {
		if (!newTopicTitle.trim()) return;
		const now = new Date().toISOString();
		await db.topics.add({
			id: nanoid(),
			chapterId,
			title: newTopicTitle.trim(),
			order: topics.length + 1,
			createdAt: now,
			updatedAt: now
		});
		newTopicTitle = '';
		showAddTopic = false;
	}

	async function deleteChapter() {
		if (!chapter) return;
		await db.transaction('rw', [db.chapters, db.topics, db.questions], async () => {
			await db.questions.where('chapterId').equals(chapterId).delete();
			await db.topics.where('chapterId').equals(chapterId).delete();
			await db.chapters.delete(chapterId);
		});
		goto(`/manage/themes/${chapter.themeId}`);
	}

	function questionsForTopic(topicId: string): number {
		return questions.filter((q) => q.topicId === topicId && !q.isFinalAssessment).length;
	}

	const finalAssessmentCount = $derived(questions.filter((q) => q.isFinalAssessment).length);
</script>

{#if chapter}
	<div class="mx-auto max-w-2xl space-y-6">
		<div>
			<a
				href="/manage/themes/{chapter.themeId}"
				class="text-sm text-primary-600 hover:text-primary-700">&larr; Back to Theme</a
			>
			<h1 class="mt-2 text-2xl font-bold text-gray-900">Edit Chapter</h1>
		</div>

		<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			<div class="space-y-4">
				{#if saveMessage}
					<div
						class="rounded-lg px-3 py-2 text-sm {saveMessageType === 'success'
							? 'border border-green-200 bg-green-50 text-green-700'
							: 'border border-red-200 bg-red-50 text-red-700'}"
					>
						{saveMessage}
					</div>
				{/if}
				<div>
					<label for="ch-title" class="mb-1 block text-sm font-medium text-gray-700">Title</label>
					<input
						id="ch-title"
						bind:value={editingTitle}
						oninput={() => {
							saveMessage = '';
						}}
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
					/>
				</div>
				<div>
					<label for="ch-desc" class="mb-1 block text-sm font-medium text-gray-700"
						>Description</label
					>
					<textarea
						id="ch-desc"
						bind:value={editingDescription}
						oninput={() => {
							saveMessage = '';
						}}
						rows="2"
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
					></textarea>
				</div>
				<button
					onclick={saveChapter}
					disabled={savingChapter}
					class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{savingChapter ? 'Saving...' : 'Save Changes'}
				</button>
				<a
					href="/manage/chapters/{chapterId}/json"
					class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
				>
					Edit as JSON
				</a>
			</div>
		</div>

		<div>
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-gray-800">Topics</h2>
				<button
					onclick={() => (showAddTopic = !showAddTopic)}
					class="text-sm text-primary-600 hover:text-primary-700"
				>
					{showAddTopic ? 'Cancel' : '+ Add Topic'}
				</button>
			</div>

			{#if showAddTopic}
				<div class="mb-4 rounded-lg border border-gray-200 bg-white p-4">
					<div class="flex gap-3">
						<input
							bind:value={newTopicTitle}
							placeholder="Topic title"
							class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
						/>
						<button
							onclick={addTopic}
							class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
						>
							Add
						</button>
					</div>
				</div>
			{/if}

			<div class="space-y-2">
				{#each topics as topic, i}
					<a
						href="/manage/topics/{topic.id}"
						class="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 hover:shadow-sm"
					>
						<div class="flex items-center gap-3">
							<span class="text-sm font-medium text-gray-400">{i + 1}</span>
							<span class="font-medium text-gray-900">{topic.title}</span>
						</div>
						<span class="text-sm text-gray-500">{questionsForTopic(topic.id)} questions</span>
					</a>
				{/each}
			</div>
		</div>

		{#if finalAssessmentCount > 0}
			<div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
				<p class="text-sm text-amber-700">{finalAssessmentCount} final assessment questions</p>
			</div>
		{/if}

		<div class="border-t border-gray-200 pt-6">
			{#if confirmDelete}
				<div class="rounded-lg border border-red-200 bg-red-50 p-4">
					<p class="text-sm text-red-700">Delete this chapter and all its content?</p>
					<div class="mt-3 flex gap-3">
						<button
							onclick={deleteChapter}
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
					Delete Chapter
				</button>
			{/if}
		</div>
	</div>
{:else}
	<p class="text-gray-500">Loading...</p>
{/if}
