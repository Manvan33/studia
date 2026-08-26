<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { db } from '$lib/db';
	import { renderMarkdown } from '$lib/markdown';
	import SourceQuote from '$lib/components/SourceQuote.svelte';
	import type {
		StudySession,
		SessionAnswer,
		Question,
		Chapter,
		Topic,
		LearningTheme
	} from '$lib/types';

	const sessionId = $derived(page.params.sessionId ?? '');

	let session = $state<StudySession | undefined>();
	let answers = $state<SessionAnswer[]>([]);
	const answersMap = $derived(new Map(answers.map((a) => [a.questionId, a])));
	let questions = $state<Question[]>([]);
	let chapters = $state<Chapter[]>([]);
	let topics = $state<Topic[]>([]);
	let themes = $state<LearningTheme[]>([]);
	let expandedTopicIds = $state<string[]>([]);
	let loading = $state(true);

	interface TopicGroup {
		id: string;
		title: string;
		questions: Question[];
		correct: number;
		incorrect: number;
		skipped: number;
		total: number;
	}

	$effect(() => {
		loadData();
	});

	async function loadData() {
		loading = true;
		const s = await db.sessions.get(sessionId);
		if (!s) {
			loading = false;
			return;
		}

		if (!s.completedAt) {
			goto(`${base}/study/${sessionId}`, { replaceState: true });
			return;
		}

		session = s;

		const qs = await db.questions.bulkGet(s.questionIds);
		questions = qs.filter((q): q is Question => q !== undefined);

		answers = await db.sessionAnswers.where('sessionId').equals(sessionId).toArray();

		const chapterIds = [
			...new Set([...(s.chapterIds ?? []), ...questions.map((q) => q.chapterId)])
		];
		const chs = await db.chapters.bulkGet(chapterIds);
		chapters = chs.filter((c): c is Chapter => c !== undefined);

		const themeIds = [...new Set([...(s.themeIds ?? []), ...chapters.map((c) => c.themeId)])];
		const ths = await db.themes.bulkGet(themeIds);
		themes = ths.filter((t): t is LearningTheme => t !== undefined);

		const topicIds = [
			...new Set([
				...(s.topicIds ?? []),
				...(questions.map((q) => q.topicId).filter(Boolean) as string[])
			])
		];
		const ts = await db.topics.bulkGet(topicIds);
		topics = ts.filter((t): t is Topic => t !== undefined);

		expandedTopicIds = topicGroups.map((g) => g.id);

		loading = false;
	}

	const topicGroups = $derived.by(() => {
		const groups: TopicGroup[] = [];
		const groupMap = new Map<string, TopicGroup>();
		const topicMap = new Map(topics.map((t) => [t.id, t.title]));

		for (const q of questions) {
			const groupId = q.topicId ?? (q.isFinalAssessment ? 'final_assessment' : 'other');
			let group = groupMap.get(groupId);

			if (!group) {
				let title = 'Unknown Topic';
				if (q.topicId) {
					title = topicMap.get(q.topicId) ?? 'Unknown Topic';
				} else if (q.isFinalAssessment) {
					title = 'Final Assessment';
				} else {
					title = 'General Questions';
				}

				group = {
					id: groupId,
					title,
					questions: [],
					correct: 0,
					incorrect: 0,
					skipped: 0,
					total: 0
				};
				groupMap.set(groupId, group);
				groups.push(group);
			}

			group.questions.push(q);
			group.total++;

			const answer = answersMap.get(q.id);
			if (!answer || answer.skipped) {
				group.skipped++;
			} else if (answer.finalResult === 'correct') {
				group.correct++;
			} else if (answer.finalResult === 'incorrect') {
				group.incorrect++;
			}
		}

		return groups;
	});

	function toggleTopic(id: string) {
		if (expandedTopicIds.includes(id)) {
			expandedTopicIds = expandedTopicIds.filter((i) => i !== id);
		} else {
			expandedTopicIds = [...expandedTopicIds, id];
		}
	}

	function expandAllTopics() {
		expandedTopicIds = topicGroups.map((g) => g.id);
	}

	function collapseAllTopics() {
		expandedTopicIds = [];
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatDuration(ms: number | undefined): string {
		if (!ms) return '—';
		const minutes = Math.floor(ms / 60000);
		const seconds = Math.floor((ms % 60000) / 1000);
		return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
	}

	function getAnswer(questionId: string): SessionAnswer | undefined {
		return answersMap.get(questionId);
	}

	function formatUserAnswer(type: string, userAnswer: string): string {
		if (type === 'multiple_select') {
			try {
				return JSON.parse(userAnswer).join(', ');
			} catch {
				return userAnswer;
			}
		}
		return userAnswer;
	}

	function formatCorrectAnswer(type: string, question: Question): string {
		if (type === 'multiple_select' && question.correctAnswers) {
			return question.correctAnswers.join(', ');
		}
		return question.correctAnswer;
	}
</script>

{#if loading}
	<p class="py-10 text-center text-gray-500">Loading...</p>
{:else if !session}
	<div class="py-10 text-center">
		<p class="text-gray-500">Session not found</p>
		<a href="{base}/history" class="mt-2 text-primary-600 hover:text-primary-700">Back to History</a
		>
	</div>
{:else}
	<div class="space-y-6">
		<div>
			<a href="{base}/history" class="text-sm text-primary-600 hover:text-primary-700"
				>&larr; All Sessions</a
			>
			<div class="mt-2 flex flex-wrap items-center justify-between gap-2">
				<div>
					<h1 class="text-2xl font-bold text-gray-900">Session Summary</h1>
					<p class="text-sm text-gray-500">{formatDate(session.createdAt)}</p>
				</div>
				{#if session.type}
					<span
						class="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 capitalize"
					>
						{session.type.replace('_', ' ')} Session
					</span>
				{/if}
			</div>

			<!-- Theme, Chapter & Topic Metadata Card -->
			{#if themes.length > 0 || chapters.length > 0 || topics.length > 0}
				<div
					class="mt-4 flex flex-wrap gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
				>
					{#if themes.length > 0}
						<div class="min-w-[120px]">
							<span class="text-xs font-semibold tracking-wider text-gray-400 uppercase">Theme</span
							>
							<p class="text-sm font-semibold text-gray-900">
								{themes.map((t) => t.title).join(', ')}
							</p>
						</div>
					{/if}
					{#if chapters.length > 0}
						<div class="min-w-[120px] border-l border-gray-200 pl-4">
							<span class="text-xs font-semibold tracking-wider text-gray-400 uppercase"
								>Chapter</span
							>
							<p class="text-sm font-semibold text-gray-900">
								{chapters.map((c) => c.title).join(', ')}
							</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		{#if session.scoring}
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
				<div class="rounded-xl border border-gray-200 bg-white p-4 text-center">
					<p class="text-2xl font-bold text-primary-700">{session.scoring.scorePercentage}%</p>
					<p class="text-xs text-gray-500">Score</p>
				</div>
				<div class="rounded-xl border border-gray-200 bg-white p-4 text-center">
					<div class="flex items-center justify-center gap-1">
						<svg
							class="h-4 w-4 text-success-600"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2.5"
							><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg
						>
						<p class="text-2xl font-bold text-success-600">{session.scoring.correct}</p>
					</div>
					<p class="text-xs text-gray-500">Correct</p>
				</div>
				<div class="rounded-xl border border-gray-200 bg-white p-4 text-center">
					<div class="flex items-center justify-center gap-1">
						<svg
							class="h-4 w-4 text-error-600"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2.5"
							><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg
						>
						<p class="text-2xl font-bold text-error-600">{session.scoring.incorrect}</p>
					</div>
					<p class="text-xs text-gray-500">Incorrect</p>
				</div>
				<div class="rounded-xl border border-gray-200 bg-white p-4 text-center">
					<div class="flex items-center justify-center gap-1">
						<svg
							class="h-4 w-4 text-gray-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M13 5l7 7-7 7M5 5l7 7-7 7"
							/></svg
						>
						<p class="text-2xl font-bold text-gray-400">{session.scoring.skipped}</p>
					</div>
					<p class="text-xs text-gray-500">Skipped</p>
				</div>
				<div class="rounded-xl border border-gray-200 bg-white p-4 text-center">
					<p class="text-2xl font-bold text-gray-700">
						{formatDuration(session.scoring.durationMs)}
					</p>
					<p class="text-xs text-gray-500">Duration</p>
				</div>
			</div>
		{/if}

		{#if topicGroups.length > 0}
			<div>
				<div class="mb-3 flex items-center justify-between">
					<h2 class="text-lg font-semibold text-gray-800">Per Topic</h2>
					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={expandAllTopics}
							class="text-xs font-medium text-primary-600 hover:text-primary-700"
						>
							Expand All
						</button>
						<span class="text-xs text-gray-300">|</span>
						<button
							type="button"
							onclick={collapseAllTopics}
							class="text-xs font-medium text-primary-600 hover:text-primary-700"
						>
							Collapse All
						</button>
					</div>
				</div>

				<div class="space-y-3">
					{#each topicGroups as group}
						{@const isExpanded = expandedTopicIds.includes(group.id)}
						<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
							<button
								type="button"
								onclick={() => toggleTopic(group.id)}
								aria-expanded={isExpanded}
								aria-controls={`topic-group-${group.id}`}
								class="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
							>
								<div class="flex items-center gap-3">
									<svg
										class="h-5 w-5 text-gray-400 transition-transform duration-200 {isExpanded
											? 'rotate-90'
											: ''}"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
									</svg>
									<div>
										<span class="text-base font-semibold text-gray-900">{group.title}</span>
										<span class="ml-2 text-xs font-normal text-gray-500"
											>({group.questions.length}
											{group.questions.length === 1 ? 'question' : 'questions'})</span
										>
									</div>
								</div>

								<div class="flex items-center gap-3 text-sm">
									<span class="inline-flex items-center gap-0.5 font-medium text-success-600">
										<svg
											class="h-3.5 w-3.5"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="2.5"
										>
											<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
										</svg>
										{group.correct}
									</span>
									<span class="inline-flex items-center gap-0.5 font-medium text-error-600">
										<svg
											class="h-3.5 w-3.5"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="2.5"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M6 18L18 6M6 6l12 12"
											/>
										</svg>
										{group.incorrect}
									</span>
									{#if group.skipped > 0}
										<span class="text-xs text-gray-400">{group.skipped} skip</span>
									{/if}
								</div>
							</button>

							{#if isExpanded}
								<div
									id={`topic-group-${group.id}`}
									class="space-y-3 border-t border-gray-100 bg-gray-50/50 p-4"
								>
									{#each group.questions as question, i}
										{@const answer = getAnswer(question.id)}
										<div
											class="rounded-xl border bg-white p-4 {question.isFinalAssessment
												? 'border-amber-200 bg-amber-50/30'
												: 'border-gray-200'}"
										>
											<div class="flex items-start gap-3">
												<span
													class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold {answer?.finalResult ===
													'correct'
														? 'bg-green-100 text-green-700'
														: answer?.finalResult === 'incorrect'
															? 'bg-red-100 text-red-700'
															: 'bg-gray-100 text-gray-500'}"
													aria-label={answer?.finalResult === 'correct'
														? 'Correct'
														: answer?.finalResult === 'incorrect'
															? 'Incorrect'
															: answer?.skipped
																? 'Skipped'
																: 'Not answered'}
												>
													{#if answer?.finalResult === 'correct'}
														<svg
															class="h-4 w-4"
															fill="none"
															viewBox="0 0 24 24"
															stroke="currentColor"
															stroke-width="2.5"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																d="M5 13l4 4L19 7"
															/>
														</svg>
													{:else if answer?.finalResult === 'incorrect'}
														<svg
															class="h-4 w-4"
															fill="none"
															viewBox="0 0 24 24"
															stroke="currentColor"
															stroke-width="2.5"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																d="M6 18L18 6M6 6l12 12"
															/>
														</svg>
													{:else}
														{i + 1}
													{/if}
												</span>
												<div class="flex-1">
													<div class="flex items-start justify-between gap-2">
														<p class="text-sm font-medium text-gray-900">{question.prompt}</p>
														{#if question.isFinalAssessment}
															<span
																class="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
															>
																<svg
																	class="h-3 w-3"
																	fill="none"
																	viewBox="0 0 24 24"
																	stroke="currentColor"
																	stroke-width="2"
																>
																	<path
																		stroke-linecap="round"
																		stroke-linejoin="round"
																		d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
																	/>
																</svg>
																Final
															</span>
														{/if}
													</div>

													{#if question.context}
														<div
															class="prose prose-sm mt-2 max-w-none rounded border border-gray-100 bg-gray-50 px-3 py-2 text-gray-600"
														>
															{@html renderMarkdown(question.context)}
														</div>
													{/if}

													{#if answer}
														<div class="mt-2 text-sm">
															{#if answer.skipped}
																<p class="text-gray-400 italic">Skipped</p>
															{:else}
																<p class="text-gray-600">
																	Your answer: {formatUserAnswer(question.type, answer.userAnswer)}
																</p>
															{/if}
															{#if answer.finalResult === 'incorrect'}
																<p class="text-success-600">
																	Correct: {formatCorrectAnswer(question.type, question)}
																</p>
															{/if}
														</div>
														<div
															class="prose prose-sm mt-2 max-w-none rounded border border-blue-100 bg-blue-50 px-3 py-2 text-gray-600"
														>
															<p class="text-xs font-medium text-blue-600 uppercase">Explanation</p>
															{@html renderMarkdown(question.explanation)}
														</div>
														{#if question.sourceRef}
															<div class="mt-2">
																<SourceQuote
																	chapterId={question.chapterId}
																	sourceRef={question.sourceRef}
																/>
															</div>
														{/if}
													{/if}
												</div>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}
