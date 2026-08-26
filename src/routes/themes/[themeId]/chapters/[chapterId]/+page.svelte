<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { db } from '$lib/db';
	import { createChapterSession } from '$lib/sessions';
	import type { Chapter, Topic, Question } from '$lib/types';
	import { liveQuery } from 'dexie';

	let chapter = $state<Chapter | undefined>();
	let topics = $state<Topic[]>([]);
	let questions = $state<Question[]>([]);

	const chapterId = $derived(page.params.chapterId ?? '');
	const themeId = $derived(page.params.themeId ?? '');

	$effect(() => {
		const id = chapterId;
		const sub1 = liveQuery(() => db.chapters.get(id)).subscribe({
			next: (v) => (chapter = v)
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

	const topicQuestionCount = $derived(questions.filter((q) => !q.isFinalAssessment).length);
	const finalAssessmentCount = $derived(questions.filter((q) => q.isFinalAssessment).length);

	async function startStudy() {
		const session = await createChapterSession(chapterId);
		goto(`${base}/study/${session.id}`);
	}
</script>

{#if chapter}
	<div class="space-y-6">
		<div>
			<a href="{base}/themes/{themeId}" class="text-sm text-primary-600 hover:text-primary-700"
				>&larr; Back to Theme</a
			>
			<h1 class="mt-2 text-2xl font-bold text-gray-900">{chapter.title}</h1>
			{#if chapter.description}
				<p class="mt-1 text-gray-500">{chapter.description}</p>
			{/if}
		</div>

		<div class="flex gap-4">
			<div class="rounded-lg bg-blue-50 px-4 py-2 text-sm">
				<span class="font-medium text-blue-700">{topicQuestionCount}</span>
				<span class="text-blue-600"> topic questions</span>
			</div>
			<div class="rounded-lg bg-amber-50 px-4 py-2 text-sm">
				<span class="font-medium text-amber-700">{finalAssessmentCount}</span>
				<span class="text-amber-600"> final assessment</span>
			</div>
		</div>

		<button
			onclick={startStudy}
			class="w-full rounded-xl bg-primary-600 py-3 text-center font-semibold text-white shadow-sm hover:bg-primary-700 sm:w-auto sm:px-8"
		>
			Start Chapter Study
		</button>

		{#if topics.length > 0}
			<div>
				<h2 class="mb-3 text-lg font-semibold text-gray-800">Topics</h2>
				<div class="space-y-2">
					{#each topics as topic, i}
						{@const count = questions.filter(
							(q) => q.topicId === topic.id && !q.isFinalAssessment
						).length}
						<div
							class="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
						>
							<div class="flex items-center gap-3">
								<span class="text-sm font-medium text-gray-400">{i + 1}</span>
								<span class="font-medium text-gray-900">{topic.title}</span>
							</div>
							<span class="text-sm text-gray-500">{count} questions</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{:else}
	<p class="text-gray-500">Loading...</p>
{/if}
