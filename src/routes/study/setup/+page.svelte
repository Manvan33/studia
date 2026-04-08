<script lang="ts">
	import { goto } from '$app/navigation';
	import { db } from '$lib/db';
	import { createCustomSession } from '$lib/sessions';
	import type { LearningTheme, Chapter, Topic, SessionType } from '$lib/types';
	import { liveQuery } from 'dexie';

	let themes = $state<LearningTheme[]>([]);
	let chapters = $state<Chapter[]>([]);
	let topics = $state<Topic[]>([]);

	let selectedThemeId = $state('');
	let selectedChapterIds = $state<string[]>([]);
	let selectedTopicIds = $state<string[]>([]);
	let sessionType = $state<SessionType>('custom');
	let wrongOnly = $state(false);
	let unansweredOnly = $state(false);
	let finalAssessmentOnly = $state(false);
	let creating = $state(false);

	$effect(() => {
		const sub = liveQuery(() => db.themes.toArray()).subscribe({
			next: (v) => (themes = v)
		});
		return () => sub.unsubscribe();
	});

	$effect(() => {
		if (!selectedThemeId) {
			chapters = [];
			return;
		}
		const sub = liveQuery(() =>
			db.chapters.where('themeId').equals(selectedThemeId).sortBy('order')
		).subscribe({
			next: (v) => {
				chapters = v;
				selectedChapterIds = [];
				selectedTopicIds = [];
			}
		});
		return () => sub.unsubscribe();
	});

	$effect(() => {
		if (selectedChapterIds.length === 0) {
			topics = [];
			return;
		}
		const load = async () => {
			const allTopics: Topic[] = [];
			for (const cid of selectedChapterIds) {
				const ts = await db.topics.where('chapterId').equals(cid).sortBy('order');
				allTopics.push(...ts);
			}
			topics = allTopics;
		};
		load();
	});

	function toggleChapter(id: string) {
		if (selectedChapterIds.includes(id)) {
			selectedChapterIds = selectedChapterIds.filter((c) => c !== id);
		} else {
			selectedChapterIds = [...selectedChapterIds, id];
		}
	}

	function selectAllChapters() {
		selectedChapterIds = chapters.map((chapter) => chapter.id);
	}

	function toggleTopic(id: string) {
		if (selectedTopicIds.includes(id)) {
			selectedTopicIds = selectedTopicIds.filter((t) => t !== id);
		} else {
			selectedTopicIds = [...selectedTopicIds, id];
		}
	}

	async function startSession() {
		if (selectedChapterIds.length === 0 || creating) return;
		creating = true;

		try {
			const type: SessionType = wrongOnly
				? 'wrong_only'
				: finalAssessmentOnly
					? 'final_assessment'
					: 'custom';
			const session = await createCustomSession({
				chapterIds: selectedChapterIds,
				topicIds: selectedTopicIds.length > 0 ? selectedTopicIds : undefined,
				type,
				wrongOnly,
				unansweredOnly,
				finalAssessmentOnly
			});
			goto(`/study/${session.id}`);
		} catch {
			creating = false;
		}
	}
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-gray-900">Custom Study Session</h1>
		<p class="mt-1 text-sm text-gray-500">Build a session from specific chapters and topics</p>
	</div>

	<div class="space-y-4">
		<div>
			<label for="theme-select" class="mb-1 block text-sm font-medium text-gray-700">Theme</label>
			<select
				id="theme-select"
				bind:value={selectedThemeId}
				class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
			>
				<option value="">Select a theme</option>
				{#each themes as theme}
					<option value={theme.id}>{theme.title}</option>
				{/each}
			</select>
		</div>

		{#if chapters.length > 0}
			<div>
				<div class="mb-2 flex items-center justify-between">
					<p class="text-sm font-medium text-gray-700">Chapters</p>
					<button
						onclick={selectAllChapters}
						disabled={selectedChapterIds.length === chapters.length}
						class="text-xs font-medium text-primary-600 hover:text-primary-700 disabled:cursor-not-allowed disabled:text-gray-400"
					>
						Select all
					</button>
				</div>
				<div class="space-y-2">
					{#each chapters as chapter}
						<label
							class="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50"
						>
							<input
								type="checkbox"
								checked={selectedChapterIds.includes(chapter.id)}
								onchange={() => toggleChapter(chapter.id)}
								class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
							/>
							<span class="text-sm text-gray-900">{chapter.title}</span>
						</label>
					{/each}
				</div>
			</div>
		{/if}

		{#if topics.length > 0}
			<div>
				<p class="mb-2 text-sm font-medium text-gray-700">Topics (optional filter)</p>
				<div class="space-y-2">
					{#each topics as topic}
						<label
							class="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 hover:bg-gray-50"
						>
							<input
								type="checkbox"
								checked={selectedTopicIds.includes(topic.id)}
								onchange={() => toggleTopic(topic.id)}
								class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
							/>
							<span class="text-sm text-gray-900">{topic.title}</span>
						</label>
					{/each}
				</div>
			</div>
		{/if}

		<div>
			<p class="mb-2 text-sm font-medium text-gray-700">Filters</p>
			<div class="space-y-2">
				<label class="flex cursor-pointer items-center gap-3">
					<input
						type="checkbox"
						bind:checked={wrongOnly}
						class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
					/>
					<span class="text-sm text-gray-700">Wrong answers only</span>
				</label>
				<label class="flex cursor-pointer items-center gap-3">
					<input
						type="checkbox"
						bind:checked={unansweredOnly}
						class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
					/>
					<span class="text-sm text-gray-700">Unanswered questions only</span>
				</label>
				<label class="flex cursor-pointer items-center gap-3">
					<input
						type="checkbox"
						bind:checked={finalAssessmentOnly}
						class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
					/>
					<span class="text-sm text-gray-700">Final assessment only</span>
				</label>
			</div>
		</div>

		<button
			onclick={startSession}
			disabled={selectedChapterIds.length === 0 || creating}
			class="w-full rounded-xl bg-primary-600 py-3 font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{creating ? 'Creating Session...' : 'Start Session'}
		</button>
	</div>
</div>
