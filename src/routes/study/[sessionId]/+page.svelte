<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { db } from '$lib/db';
	import { submitAnswer, overrideAnswer, completeSession } from '$lib/sessions';
	import type { StudySession, Question, SessionAnswer } from '$lib/types';

	const sessionId = $derived(page.params.sessionId ?? '');

	let session = $state<StudySession | undefined>();
	let questions = $state<Question[]>([]);
	let answers = $state<SessionAnswer[]>([]);
	let currentIndex = $state(0);
	let userAnswer = $state('');
	let showExplanation = $state(false);
	let currentAnswer = $state<SessionAnswer | undefined>();
	let loading = $state(true);
	let submitting = $state(false);

	$effect(() => {
		loadSession();
	});

	async function loadSession() {
		loading = true;
		const s = await db.sessions.get(sessionId);
		if (!s) return;
		session = s;

		const qs = await db.questions.bulkGet(s.questionIds);
		questions = qs.filter((q): q is Question => q !== undefined);

		const existingAnswers = await db.sessionAnswers
			.where('sessionId')
			.equals(sessionId)
			.toArray();
		answers = existingAnswers;

		if (existingAnswers.length > 0) {
			currentIndex = existingAnswers.length;
		}

		loading = false;
	}

	const currentQuestion = $derived(questions[currentIndex]);
	const isComplete = $derived(currentIndex >= questions.length);
	const progress = $derived(
		questions.length > 0 ? Math.round((currentIndex / questions.length) * 100) : 0
	);

	async function handleSubmit() {
		if (!currentQuestion || submitting) return;
		submitting = true;

		const answer = await submitAnswer(sessionId, currentQuestion.id, userAnswer, false);
		currentAnswer = answer;
		answers = [...answers, answer];
		showExplanation = true;
		submitting = false;
	}

	async function handleSkip() {
		if (!currentQuestion || submitting) return;
		submitting = true;

		const answer = await submitAnswer(sessionId, currentQuestion.id, '', true);
		currentAnswer = answer;
		answers = [...answers, answer];
		showExplanation = true;
		submitting = false;
	}

	function nextQuestion() {
		showExplanation = false;
		currentAnswer = undefined;
		userAnswer = '';
		currentIndex++;
	}

	async function handleOverride(result: 'correct' | 'incorrect') {
		if (!currentAnswer) return;
		await overrideAnswer(currentAnswer.id, result);
		currentAnswer = { ...currentAnswer, manuallyOverriddenResult: result, finalResult: result };
		answers = answers.map((a) => (a.id === currentAnswer!.id ? currentAnswer! : a));
	}

	async function finishSession() {
		await completeSession(sessionId);
		goto(`/history/${sessionId}`);
	}

	function selectChoice(choice: string) {
		userAnswer = choice;
	}
</script>

{#if loading}
	<div class="flex items-center justify-center py-20">
		<p class="text-gray-500">Loading session...</p>
	</div>
{:else if !session}
	<div class="py-20 text-center">
		<p class="text-gray-500">Session not found</p>
		<a href="/" class="mt-2 text-primary-600 hover:text-primary-700">Back to Dashboard</a>
	</div>
{:else if isComplete}
	<div class="mx-auto max-w-lg space-y-6 py-10 text-center">
		<div class="text-5xl">🎉</div>
		<h1 class="text-2xl font-bold text-gray-900">Session Complete!</h1>
		<p class="text-gray-500">
			You answered {answers.filter((a) => !a.skipped).length} of {questions.length} questions
		</p>

		<div class="flex justify-center gap-6">
			<div class="text-center">
				<p class="text-2xl font-bold text-success-600">
					{answers.filter((a) => a.finalResult === 'correct').length}
				</p>
				<p class="text-sm text-gray-500">Correct</p>
			</div>
			<div class="text-center">
				<p class="text-2xl font-bold text-error-600">
					{answers.filter((a) => a.finalResult === 'incorrect').length}
				</p>
				<p class="text-sm text-gray-500">Incorrect</p>
			</div>
			<div class="text-center">
				<p class="text-2xl font-bold text-gray-400">
					{answers.filter((a) => a.skipped).length}
				</p>
				<p class="text-sm text-gray-500">Skipped</p>
			</div>
		</div>

		<button
			onclick={finishSession}
			class="rounded-xl bg-primary-600 px-8 py-3 font-semibold text-white hover:bg-primary-700"
		>
			View Full Summary
		</button>
	</div>
{:else if currentQuestion}
	<div class="mx-auto max-w-2xl space-y-6">
		<div class="flex items-center justify-between">
			<span class="text-sm text-gray-500">
				Question {currentIndex + 1} of {questions.length}
			</span>
			{#if currentQuestion.isFinalAssessment}
				<span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
					Final Assessment
				</span>
			{/if}
		</div>

		<div class="h-2 w-full overflow-hidden rounded-full bg-gray-200">
			<div
				class="h-full rounded-full bg-primary-500 transition-all duration-300"
				style="width: {progress}%"
			></div>
		</div>

		<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			<p class="text-lg font-medium text-gray-900">{currentQuestion.prompt}</p>

			{#if !showExplanation}
				{#if currentQuestion.type === 'multiple_choice' && currentQuestion.choices}
					<div class="mt-4 space-y-2">
						{#each currentQuestion.choices as choice}
							<button
								onclick={() => selectChoice(choice)}
								class="w-full rounded-lg border-2 px-4 py-3 text-left text-sm transition-colors {userAnswer ===
								choice
									? 'border-primary-500 bg-primary-50 text-primary-700'
									: 'border-gray-200 hover:border-gray-300'}"
							>
								{choice}
							</button>
						{/each}
					</div>
				{:else}
					<textarea
						bind:value={userAnswer}
						placeholder="Type your answer..."
						class="mt-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
						rows="3"
					></textarea>
				{/if}

				<div class="mt-4 flex gap-3">
					<button
						onclick={handleSubmit}
						disabled={!userAnswer.trim() || submitting}
						class="flex-1 rounded-lg bg-primary-600 py-2.5 font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Submit Answer
					</button>
					<button
						onclick={handleSkip}
						disabled={submitting}
						class="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
					>
						Skip
					</button>
				</div>
			{:else if currentAnswer}
				<div class="mt-4 space-y-4">
					{#if currentAnswer.skipped}
						<div class="rounded-lg bg-gray-100 px-4 py-3">
							<p class="text-sm font-medium text-gray-600">Skipped</p>
						</div>
					{:else}
						<div
							class="rounded-lg px-4 py-3 {currentAnswer.finalResult === 'correct'
								? 'bg-green-50 border border-green-200'
								: 'bg-red-50 border border-red-200'}"
						>
							<div class="flex items-center justify-between">
								<p
									class="text-sm font-medium {currentAnswer.finalResult === 'correct'
										? 'text-green-700'
										: 'text-red-700'}"
								>
									{currentAnswer.finalResult === 'correct' ? '✓ Correct' : '✗ Incorrect'}
								</p>
								{#if currentAnswer.manuallyOverriddenResult}
									<span class="text-xs text-gray-500">(manually overridden)</span>
								{/if}
							</div>
							<p class="mt-1 text-sm text-gray-600">Your answer: {currentAnswer.userAnswer}</p>
							{#if currentAnswer.finalResult === 'incorrect'}
								<p class="mt-1 text-sm text-gray-600">
									Correct answer: {currentQuestion.correctAnswer}
								</p>
							{/if}
						</div>
					{/if}

					<div class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
						<p class="text-xs font-medium uppercase text-blue-600">Explanation</p>
						<p class="mt-1 text-sm text-gray-700">{currentQuestion.explanation}</p>
					</div>

					{#if currentQuestion.type === 'free_text' && !currentAnswer.skipped}
						<div class="flex items-center gap-2">
							<span class="text-xs text-gray-500">Override result:</span>
							<button
								onclick={() => handleOverride('correct')}
								class="rounded px-2 py-1 text-xs font-medium {currentAnswer.finalResult === 'correct'
									? 'bg-green-100 text-green-700'
									: 'border border-gray-200 text-gray-500 hover:bg-gray-50'}"
							>
								Mark Correct
							</button>
							<button
								onclick={() => handleOverride('incorrect')}
								class="rounded px-2 py-1 text-xs font-medium {currentAnswer.finalResult === 'incorrect'
									? 'bg-red-100 text-red-700'
									: 'border border-gray-200 text-gray-500 hover:bg-gray-50'}"
							>
								Mark Incorrect
							</button>
						</div>
					{/if}

					<button
						onclick={nextQuestion}
						class="w-full rounded-lg bg-primary-600 py-2.5 font-medium text-white hover:bg-primary-700"
					>
						{currentIndex + 1 >= questions.length ? 'Finish' : 'Next Question'}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
