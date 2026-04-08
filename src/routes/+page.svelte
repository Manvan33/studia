<script lang="ts">
	import { db } from '$lib/db';
	import { getProgressStats, type ProgressStats } from '$lib/progress';
	import type { LearningTheme, StudySession, Chapter } from '$lib/types';
	import { liveQuery } from 'dexie';

	let themes = $state<LearningTheme[]>([]);
	let questionCount = $state(0);
	let stats = $state<ProgressStats | null>(null);
	let incompleteSessions = $state<StudySession[]>([]);
	let chapterMap = $state<Map<string, Chapter>>(new Map());

	$effect(() => {
		const sub1 = liveQuery(() => db.themes.toArray()).subscribe({
			next: (v) => (themes = v)
		});
		const sub2 = liveQuery(() => db.questions.count()).subscribe({
			next: (v) => (questionCount = v)
		});
		const sub3 = liveQuery(() =>
			db.sessions
				.filter((s) => !s.completedAt)
				.reverse()
				.sortBy('createdAt')
		).subscribe({
			next: (v) => (incompleteSessions = v)
		});
		const sub4 = liveQuery(() => db.chapters.toArray()).subscribe({
			next: (v) => (chapterMap = new Map(v.map((c) => [c.id, c])))
		});

		loadStats();

		return () => {
			sub1.unsubscribe();
			sub2.unsubscribe();
			sub3.unsubscribe();
			sub4.unsubscribe();
		};
	});

	function getThemeTitle(themeIds: string[]): string {
		return (
			themeIds
				.map((id) => themes.find((t) => t.id === id)?.title)
				.filter(Boolean)
				.join(', ') || ''
		);
	}

	function getPrimaryThemeTitle(themeIds: string[]): string {
		return getThemeTitle(themeIds) || 'Theme';
	}

	function getChapterTitles(chapterIds: string[]): string {
		return (
			chapterIds
				.map((id) => chapterMap.get(id)?.title)
				.filter(Boolean)
				.join(', ') || ''
		);
	}

	function getThemeTitleForChapter(chapterId: string): string {
		const chapter = chapterMap.get(chapterId);
		if (!chapter) return 'Theme';
		return themes.find((theme) => theme.id === chapter.themeId)?.title ?? 'Theme';
	}

	async function loadStats() {
		stats = await getProgressStats();
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
		<p class="mt-1 text-sm text-gray-500">Your study overview at a glance</p>
	</div>

	<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
			<p class="text-xs font-medium text-gray-500">Themes</p>
			<p class="mt-1 text-2xl font-bold text-primary-700">{themes.length}</p>
		</div>
		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
			<p class="text-xs font-medium text-gray-500">Questions</p>
			<p class="mt-1 text-2xl font-bold text-primary-700">{questionCount}</p>
		</div>
		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
			<p class="text-xs font-medium text-gray-500">Sessions</p>
			<p class="mt-1 text-2xl font-bold text-primary-700">{stats?.completedSessions ?? 0}</p>
		</div>
		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
			<p class="text-xs font-medium text-gray-500">Avg Score</p>
			<p class="mt-1 text-2xl font-bold text-primary-700">{stats?.averageScore ?? 0}%</p>
		</div>
	</div>

	{#if themes.length === 0}
		<div class="rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
			<p class="text-lg font-medium text-gray-600">No study content yet</p>
			<p class="mt-1 text-sm text-gray-400">Import a JSON study guide to get started</p>
			<a
				href="/import"
				class="mt-4 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
			>
				Import Content
			</a>
		</div>
	{:else}
		{#if incompleteSessions.length > 0}
			<div>
				<h2 class="mb-3 text-lg font-semibold text-gray-800">Continue Studying</h2>
				<div class="space-y-2">
					{#each incompleteSessions as session}
						<a
							href="/study/{session.id}"
							class="flex items-center justify-between rounded-xl border border-primary-200 bg-primary-50 p-4 shadow-sm transition-shadow hover:shadow-md"
						>
							<div class="flex items-center gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
									<svg
										class="h-5 w-5 text-primary-600"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
										><path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
										/><path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
										/></svg
									>
								</div>
								<div>
									<span
										class="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
									>
										{getPrimaryThemeTitle(session.themeIds)}
									</span>
									{#if getChapterTitles(session.chapterIds)}
										<p class="text-xs text-gray-500">{getChapterTitles(session.chapterIds)}</p>
									{/if}
									<p class="mt-0.5 text-xs text-gray-400">
										Started {formatDate(session.createdAt)}
									</p>
								</div>
							</div>
							<div class="flex items-center gap-2 text-sm font-medium text-primary-700">
								Resume
								<svg
									class="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
									><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg
								>
							</div>
						</a>
					{/each}
				</div>
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<div>
				<h2 class="mb-3 text-lg font-semibold text-gray-800">Your Themes</h2>
				<div class="space-y-2">
					{#each themes as theme}
						<a
							href="/themes/{theme.id}"
							class="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
						>
							<h3 class="font-semibold text-gray-900">{theme.title}</h3>
							{#if theme.description}
								<p class="mt-1 text-sm text-gray-500">{theme.description}</p>
							{/if}
						</a>
					{/each}
				</div>
			</div>

			{#if stats && stats.recentSessions.length > 0}
				<div>
					<div class="mb-3 flex items-center justify-between">
						<h2 class="text-lg font-semibold text-gray-800">Recent Sessions</h2>
						<a href="/history" class="text-sm text-primary-600 hover:text-primary-700">View all</a>
					</div>
					<div class="space-y-2">
						{#each stats.recentSessions as session}
							<a
								href="/history/{session.id}"
								class="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 transition-shadow hover:shadow-sm"
							>
								<div>
									<span
										class="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
									>
										{getPrimaryThemeTitle(session.themeIds)}
									</span>
									<span class="ml-2 text-sm text-gray-500">{formatDate(session.createdAt)}</span>
									{#if getChapterTitles(session.chapterIds)}
										<p class="mt-0.5 text-xs text-gray-500">
											{getChapterTitles(session.chapterIds)}
										</p>
									{/if}
								</div>
								<div class="text-right">
									{#if session.scoring}
										<span class="text-sm font-semibold text-gray-900"
											>{session.scoring.scorePercentage}%</span
										>
										<span class="ml-2 text-xs text-gray-400"
											>{session.scoring.correct}/{session.scoring.total}</span
										>
									{:else}
										<span class="text-xs text-warning-500">In progress</span>
									{/if}
								</div>
							</a>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		{#if stats}
			{#if stats.chapterCompletionStatus.length > 0}
				<div>
					<h2 class="mb-3 text-lg font-semibold text-gray-800">Chapter Progress</h2>
					<div class="space-y-2">
						{#each stats.chapterCompletionStatus as chapter}
							<div class="rounded-lg border border-gray-200 bg-white px-4 py-3">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<span
											class="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
										>
											{getThemeTitleForChapter(chapter.chapterId)}
										</span>
										<span class="text-sm font-medium text-gray-900">{chapter.chapterTitle}</span>
									</div>
									<span class="text-sm text-gray-500">
										{chapter.answeredQuestions}/{chapter.totalQuestions} answered
									</span>
								</div>
								{#if chapter.totalQuestions > 0}
									<div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
										<div
											class="h-full rounded-full transition-all duration-300 {chapter.correctRate >=
											70
												? 'bg-success-500'
												: chapter.correctRate >= 40
													? 'bg-warning-500'
													: 'bg-error-500'}"
											style="width: {(chapter.answeredQuestions / chapter.totalQuestions) * 100}%"
										></div>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				{#if stats.weakTopics.length > 0}
					<div>
						<h2 class="mb-3 text-lg font-semibold text-gray-800">Weak Topics</h2>
						<div class="space-y-2">
							{#each stats.weakTopics as topic}
								<div
									class="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
								>
									<span class="text-sm text-gray-900">{topic.title}</span>
									<span
										class="text-sm font-medium {topic.correctRate >= 70
											? 'text-success-600'
											: topic.correctRate >= 40
												? 'text-warning-600'
												: 'text-error-600'}"
									>
										{topic.correctRate}%
									</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if stats.weakChapters.length > 0}
					<div>
						<h2 class="mb-3 text-lg font-semibold text-gray-800">Weak Chapters</h2>
						<div class="space-y-2">
							{#each stats.weakChapters as chapter}
								<div
									class="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
								>
									<span class="text-sm text-gray-900">{chapter.title}</span>
									<span
										class="text-sm font-medium {chapter.correctRate >= 70
											? 'text-success-600'
											: chapter.correctRate >= 40
												? 'text-warning-600'
												: 'text-error-600'}"
									>
										{chapter.correctRate}%
									</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			{#if stats.frequentlyMissed.length > 0}
				<div>
					<h2 class="mb-3 text-lg font-semibold text-gray-800">Frequently Missed Questions</h2>
					<div class="space-y-2">
						{#each stats.frequentlyMissed as missed}
							<div class="rounded-lg border border-gray-200 bg-white px-4 py-3">
								<p class="text-sm text-gray-900">{missed.prompt}</p>
								<div class="mt-1 flex gap-3 text-xs text-gray-500">
									<span>{missed.chapterTitle} &middot; {missed.topicTitle}</span>
									<span class="text-error-600">
										Missed {missed.timesIncorrect}/{missed.timesSeen} times
									</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if stats.finalAssessmentPerformance.length > 0}
				<div>
					<h2 class="mb-3 text-lg font-semibold text-gray-800">Final Assessment Performance</h2>
					<div class="space-y-2">
						{#each stats.finalAssessmentPerformance as fa}
							<div
								class="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
							>
								<span class="text-sm text-gray-900">{fa.chapterTitle}</span>
								<div class="text-right">
									{#if fa.attempted}
										<span class="text-sm font-medium text-gray-900"
											>{fa.correct}/{fa.totalQuestions}</span
										>
										<span class="ml-1 text-xs text-gray-400">correct</span>
									{:else}
										<span class="text-xs text-gray-400">Not attempted</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/if}

		<div class="flex gap-3">
			<a
				href="/study/setup"
				class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
			>
				Custom Session
			</a>
			<a
				href="/import"
				class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
			>
				Import Content
			</a>
		</div>
	{/if}
</div>
