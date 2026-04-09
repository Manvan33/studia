<script lang="ts">
	import { base } from '$app/paths';
	import { db } from '$lib/db';
	import { getProgressStats, type ProgressStats, type ChapterStatus } from '$lib/progress';
	import type { LearningTheme, StudySession, Chapter, Question } from '$lib/types';
	import { liveQuery } from 'dexie';

	let themes = $state<LearningTheme[]>([]);
	let questionCount = $state(0);
	let questions = $state<Question[]>([]);
	let stats = $state<ProgressStats | null>(null);
	let incompleteSessions = $state<StudySession[]>([]);
	let allSessions = $state<StudySession[]>([]);
	let chapterMap = $state<Map<string, Chapter>>(new Map());
	let selectedThemeId = $state('');

	const selectedTheme = $derived(themes.find((theme) => theme.id === selectedThemeId));
	const selectedThemeIncompleteSessions = $derived(
		selectedThemeId
			? incompleteSessions.filter((session) => session.themeIds.includes(selectedThemeId))
			: []
	);
	const selectedThemeSessions = $derived(
		selectedThemeId
			? allSessions
					.filter((session) => session.themeIds.includes(selectedThemeId))
					.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
			: []
	);
	const selectedThemeCompletedSessions = $derived(
		selectedThemeSessions.filter((session) => Boolean(session.completedAt))
	);
	const selectedThemeRecentCompletedSessions = $derived(selectedThemeCompletedSessions.slice(0, 5));
	const selectedThemeChapterProgress = $derived(
		stats && selectedThemeId
			? stats.chapterCompletionStatus
					.filter((chapter) => chapterMap.get(chapter.chapterId)?.themeId === selectedThemeId)
					.sort(
						(a, b) =>
							(chapterMap.get(a.chapterId)?.order ?? 0) - (chapterMap.get(b.chapterId)?.order ?? 0)
					)
			: []
	);
	const selectedThemeAverageScore = $derived(computeAverageScore(selectedThemeCompletedSessions));
	const selectedThemeChaptersStudied = $derived(
		selectedThemeChapterProgress.filter((chapter) => chapter.hasBeenStudied).length
	);
	const selectedThemeQuestionsTried = $derived(
		selectedThemeChapterProgress.reduce((sum, chapter) => sum + chapter.answeredQuestions, 0)
	);

	$effect(() => {
		const sub1 = liveQuery(() => db.themes.toArray()).subscribe({
			next: (v) => (themes = v)
		});
		const sub2 = liveQuery(() => db.questions.count()).subscribe({
			next: (v) => (questionCount = v)
		});
		const sub3 = liveQuery(() => db.questions.toArray()).subscribe({
			next: (v) => (questions = v)
		});
		const sub4 = liveQuery(() =>
			db.sessions
				.filter((s) => !s.completedAt)
				.reverse()
				.sortBy('createdAt')
		).subscribe({
			next: (v) => (incompleteSessions = v)
		});
		const sub5 = liveQuery(() => db.sessions.toArray()).subscribe({
			next: (v) => (allSessions = v)
		});
		const sub6 = liveQuery(() => db.chapters.toArray()).subscribe({
			next: (v) => (chapterMap = new Map(v.map((c) => [c.id, c])))
		});

		loadStats();

		return () => {
			sub1.unsubscribe();
			sub2.unsubscribe();
			sub3.unsubscribe();
			sub4.unsubscribe();
			sub5.unsubscribe();
			sub6.unsubscribe();
		};
	});

	$effect(() => {
		if (themes.length === 0) {
			selectedThemeId = '';
			return;
		}

		if (!themes.some((theme) => theme.id === selectedThemeId)) {
			selectedThemeId = themes[0].id;
		}
	});

	function getChapterTitles(chapterIds: string[]): string {
		return (
			chapterIds
				.map((id) => chapterMap.get(id)?.title)
				.filter(Boolean)
				.join(', ') || ''
		);
	}

	function getThemeChapterCount(themeId: string): number {
		return Array.from(chapterMap.values()).filter((chapter) => chapter.themeId === themeId).length;
	}

	function getThemeQuestionCount(themeId: string): number {
		const chapterIds = new Set(
			Array.from(chapterMap.values())
				.filter((chapter) => chapter.themeId === themeId)
				.map((chapter) => chapter.id)
		);
		return questions.filter((question) => chapterIds.has(question.chapterId)).length;
	}

	function getProgressBarClass(chapter: ChapterStatus): string {
		if (chapter.correctRate >= 70) return 'bg-success-500';
		if (chapter.correctRate >= 40) return 'bg-warning-500';
		return 'bg-error-500';
	}

	function computeAverageScore(sessions: StudySession[]): number {
		const scores = sessions
			.map((session) => session.scoring?.scorePercentage)
			.filter((score): score is number => score !== undefined);

		if (scores.length === 0) return 0;
		return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
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

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
		<p class="mt-1 text-sm text-gray-500">Select a theme to focus your study details</p>
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
			<p class="text-xs font-medium text-gray-500">Completed Sessions</p>
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
				href="{base}/import"
				class="mt-4 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
			>
				Import Content
			</a>
		</div>
	{:else if selectedTheme}
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
			<aside class="space-y-4 lg:col-span-4">
				<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
					<h2 class="text-lg font-semibold text-gray-800">Themes</h2>
					<p class="mt-1 text-xs text-gray-500">Choose one to inspect details</p>
					<div class="mt-3 space-y-2">
						{#each themes as theme}
							<button
								type="button"
								onclick={() => (selectedThemeId = theme.id)}
								class="w-full rounded-lg border px-3 py-2 text-left transition-colors {selectedThemeId ===
								theme.id
									? 'border-primary-300 bg-primary-50'
									: 'border-gray-200 bg-white hover:bg-gray-50'}"
							>
								<div class="flex items-center justify-between gap-2">
									<p class="truncate text-sm font-medium text-gray-900">{theme.title}</p>
									<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
										{getThemeChapterCount(theme.id)} chapters
									</span>
								</div>
							</button>
						{/each}
					</div>
				</div>

				<div class="flex flex-wrap gap-2">
					<a
						href="{base}/study/setup"
						class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
					>
						Custom Session
					</a>
					<a
						href="{base}/import"
						class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
					>
						Import Content
					</a>
				</div>
			</aside>

			<section class="space-y-4 lg:col-span-8">
				<div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<h2 class="text-xl font-semibold text-gray-900">{selectedTheme.title}</h2>
							{#if selectedTheme.description}
								<p class="mt-1 text-sm text-gray-500">{selectedTheme.description}</p>
							{/if}
						</div>
						<a
							href="{base}/themes/{selectedTheme.id}"
							class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
						>
							Open Theme
						</a>
					</div>

					<div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
						<div class="rounded-lg bg-gray-50 p-3">
							<p class="text-xs text-gray-500">Chapters Studied</p>
							<p class="text-lg font-semibold text-gray-900">
								{selectedThemeChaptersStudied}/{getThemeChapterCount(selectedTheme.id)}
							</p>
						</div>
						<div class="rounded-lg bg-gray-50 p-3">
							<p class="text-xs text-gray-500">Questions Tried</p>
							<p class="text-lg font-semibold text-gray-900">
								{selectedThemeQuestionsTried}/{getThemeQuestionCount(selectedTheme.id)}
							</p>
						</div>
						<div class="rounded-lg bg-gray-50 p-3">
							<p class="text-xs text-gray-500">Sessions</p>
							<p class="text-lg font-semibold text-gray-900">
								{selectedThemeCompletedSessions.length}
							</p>
						</div>
						<div class="rounded-lg bg-gray-50 p-3">
							<p class="text-xs text-gray-500">Avg Score</p>
							<p class="text-lg font-semibold text-gray-900">{selectedThemeAverageScore}%</p>
						</div>
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
					<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
						<div class="mb-3 flex items-center justify-between">
							<h3 class="text-sm font-semibold text-gray-800">Continue Studying</h3>
							<span class="text-xs text-gray-400"
								>{selectedThemeIncompleteSessions.length} active</span
							>
						</div>
						{#if selectedThemeIncompleteSessions.length === 0}
							<p class="text-sm text-gray-500">No active sessions for this theme.</p>
						{:else}
							<div class="space-y-2">
								{#each selectedThemeIncompleteSessions.slice(0, 3) as session}
									<a
										href="{base}/study/{session.id}"
										class="block rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800 hover:bg-primary-100"
									>
										<p class="font-medium">Resume session</p>
										{#if getChapterTitles(session.chapterIds)}
											<p class="mt-0.5 text-xs text-primary-700">
												{getChapterTitles(session.chapterIds)}
											</p>
										{/if}
										<p class="mt-0.5 text-xs text-primary-700">
											Started {formatDate(session.createdAt)}
										</p>
									</a>
								{/each}
							</div>
						{/if}
					</div>

					<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
						<div class="mb-3 flex items-center justify-between">
							<h3 class="text-sm font-semibold text-gray-800">Recent Results</h3>
							<a href="{base}/history" class="text-xs text-primary-600 hover:text-primary-700">View all</a
							>
						</div>
						{#if selectedThemeRecentCompletedSessions.length === 0}
							<p class="text-sm text-gray-500">No completed sessions for this theme yet.</p>
						{:else}
							<div class="space-y-2">
								{#each selectedThemeRecentCompletedSessions as session}
									<a
										href="{base}/history/{session.id}"
										class="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50"
									>
										<div>
											<p class="text-xs text-gray-500">{formatDate(session.createdAt)}</p>
											{#if getChapterTitles(session.chapterIds)}
												<p class="text-xs text-gray-500">{getChapterTitles(session.chapterIds)}</p>
											{/if}
										</div>
										{#if session.scoring}
											<p class="text-sm font-semibold text-gray-900">
												{session.scoring.scorePercentage}%
											</p>
										{/if}
									</a>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
					<div class="mb-3 flex items-center justify-between">
						<h3 class="text-sm font-semibold text-gray-800">Chapter Progress</h3>
						<span class="text-xs text-gray-400">{selectedThemeChapterProgress.length} chapters</span
						>
					</div>
					{#if selectedThemeChapterProgress.length === 0}
						<p class="text-sm text-gray-500">No chapter progress data for this theme yet.</p>
					{:else}
						<div class="space-y-2">
							{#each selectedThemeChapterProgress as chapter}
								<div class="rounded-lg border border-gray-200 px-3 py-2">
									<div class="flex items-center justify-between">
										<p class="text-sm font-medium text-gray-900">{chapter.chapterTitle}</p>
										<div class="text-right">
											<p class="text-xs text-gray-500">
												{chapter.answeredQuestions}/{chapter.totalQuestions} answered
											</p>
											<p class="text-xs font-semibold text-gray-700">
												Score: {chapter.answeredQuestions > 0 ? `${chapter.correctRate}%` : '—'}
											</p>
										</div>
									</div>
									{#if chapter.totalQuestions > 0}
										<div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
											<div
												class="h-full rounded-full transition-all duration-300 {getProgressBarClass(
													chapter
												)}"
												style="width: {(chapter.answeredQuestions / chapter.totalQuestions) * 100}%"
											></div>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</section>
		</div>
	{/if}
</div>
