<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { db } from '$lib/db';
	import { renderMarkdown } from '$lib/markdown';
	import type { StudySession, SessionAnswer, Question, Chapter, Topic } from '$lib/types';

	const sessionId = $derived(page.params.sessionId ?? '');

	let session = $state<StudySession | undefined>();
	let answers = $state<SessionAnswer[]>([]);
	const answersMap = $derived(new Map(answers.map((a) => [a.questionId, a])));
	let questions = $state<Question[]>([]);
	let chapters = $state<Chapter[]>([]);
	let topics = $state<Topic[]>([]);
	let loading = $state(true);

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

		const chapterIds = [...new Set(questions.map((q) => q.chapterId))];
		const chs = await db.chapters.bulkGet(chapterIds);
		chapters = chs.filter((c): c is Chapter => c !== undefined);

		const topicIds = [...new Set(questions.map((q) => q.topicId).filter(Boolean))] as string[];
		const ts = await db.topics.bulkGet(topicIds);
		topics = ts.filter((t): t is Topic => t !== undefined);

		loading = false;
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

	function getTopicTitle(topicId: string | undefined): string {
		if (!topicId) return 'Final Assessment';
		return topics.find((t) => t.id === topicId)?.title ?? 'Unknown';
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
			<h1 class="mt-2 text-2xl font-bold text-gray-900">Session Summary</h1>
			<p class="text-sm text-gray-500">{formatDate(session.createdAt)}</p>
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

			{#if session.scoring.perTopicBreakdown}
				<div>
					<h2 class="mb-3 text-lg font-semibold text-gray-800">Per Topic</h2>
					<div class="space-y-2">
						{#each Object.values(session.scoring.perTopicBreakdown) as breakdown}
							<div
								class="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
							>
								<span class="text-sm font-medium text-gray-900">{breakdown.topicTitle}</span>
								<div class="flex gap-3 text-sm">
									<span class="inline-flex items-center gap-0.5 text-success-600">
										<svg
											class="h-3.5 w-3.5"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="2.5"
											><path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M5 13l4 4L19 7"
											/></svg
										>
										{breakdown.correct}
									</span>
									<span class="inline-flex items-center gap-0.5 text-error-600">
										<svg
											class="h-3.5 w-3.5"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="2.5"
											><path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M6 18L18 6M6 6l12 12"
											/></svg
										>
										{breakdown.incorrect}
									</span>
									{#if breakdown.skipped > 0}
										<span class="text-gray-400">{breakdown.skipped} skip</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/if}

		<div>
			<h2 class="mb-3 text-lg font-semibold text-gray-800">Questions & Answers</h2>
			<div class="space-y-3">
				{#each questions as question, i}
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
										><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg
									>
								{:else if answer?.finalResult === 'incorrect'}
									<svg
										class="h-4 w-4"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2.5"
										><path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M6 18L18 6M6 6l12 12"
										/></svg
									>
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
												><path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
												/></svg
											>
											Final
										</span>
									{/if}
								</div>
								<p class="mt-1 text-xs text-gray-400">{getTopicTitle(question.topicId)}</p>

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
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}
