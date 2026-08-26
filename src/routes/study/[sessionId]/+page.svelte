<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { db } from '$lib/db';
	import { submitAnswer, overrideAnswer, completeSession } from '$lib/sessions';
	import { renderMarkdown } from '$lib/markdown';
	import { sourceViewer } from '$lib/sourceViewer';
	import SourceQuote from '$lib/components/SourceQuote.svelte';
	import type { StudySession, Question, SessionAnswer } from '$lib/types';

	const sessionId = $derived(page.params.sessionId ?? '');

	let session = $state<StudySession | undefined>();
	let questions = $state<Question[]>([]);
	let answers = $state<SessionAnswer[]>([]);
	let currentIndex = $state(0);
	let furthestIndex = $state(0);
	let userAnswer = $state('');
	let selectedChoices = $state<string[]>([]);
	let showExplanation = $state(false);
	let currentAnswer = $state<SessionAnswer | undefined>();
	let loading = $state(true);
	let submitting = $state(false);
	let explanationEl = $state<HTMLElement | null>(null);

	$effect(() => {
		loadSession();
	});

	async function loadSession() {
		loading = true;
		const s = await db.sessions.get(sessionId);
		if (!s) return;

		if (s.completedAt) {
			goto(`${base}/history/${sessionId}`, { replaceState: true });
			return;
		}

		session = s;

		const qs = await db.questions.bulkGet(s.questionIds);
		questions = qs.filter((q): q is Question => q !== undefined);

		const existingAnswers = await db.sessionAnswers.where('sessionId').equals(sessionId).toArray();
		answers = existingAnswers;

		if (existingAnswers.length > 0 && existingAnswers.length < questions.length) {
			const lastAnswer = existingAnswers.reduce((latest, a) =>
				a.answeredAt > latest.answeredAt ? a : latest
			);
			const lastAnsweredIndex = questions.findIndex((q) => q.id === lastAnswer.questionId);

			if (lastAnsweredIndex >= 0) {
				currentIndex = lastAnsweredIndex;
				furthestIndex = lastAnsweredIndex;
				currentAnswer = lastAnswer;
				showExplanation = true;
			} else {
				currentIndex = existingAnswers.length;
				furthestIndex = existingAnswers.length;
			}
		} else if (existingAnswers.length > 0) {
			currentIndex = existingAnswers.length;
			furthestIndex = existingAnswers.length;
		}

		loading = false;
	}

	const currentQuestion = $derived(questions[currentIndex]);
	const isComplete = $derived(currentIndex >= questions.length);
	const isReviewingPast = $derived(currentIndex < furthestIndex);
	const canGoPrevious = $derived(currentIndex > 0);
	const progress = $derived(
		questions.length > 0 ? Math.round((furthestIndex / questions.length) * 100) : 0
	);

	let shuffledChoices = $state<string[]>([]);

	$effect(() => {
		const q = currentQuestion;
		if ((q?.type === 'multiple_choice' || q?.type === 'multiple_select') && q.choices) {
			shuffledChoices = shuffle([...q.choices]);
		} else {
			shuffledChoices = [];
		}
	});

	function shuffle<T>(arr: T[]): T[] {
		for (let i = arr.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
		return arr;
	}

	async function handleSubmit() {
		if (!currentQuestion || submitting) return;
		submitting = true;

		const answer =
			currentQuestion.type === 'multiple_select' ? JSON.stringify(selectedChoices) : userAnswer;
		const submittedAnswer = await submitAnswer(sessionId, currentQuestion.id, answer, false);
		currentAnswer = submittedAnswer;
		answers = [...answers, submittedAnswer];
		showExplanation = true;
		submitting = false;
		if (currentIndex >= furthestIndex) {
			furthestIndex = currentIndex + 1;
		}
	}

	async function handleSkip() {
		if (!currentQuestion || submitting) return;
		submitting = true;

		const answer = await submitAnswer(sessionId, currentQuestion.id, '', true);
		currentAnswer = answer;
		answers = [...answers, answer];
		showExplanation = true;
		submitting = false;
		if (currentIndex >= furthestIndex) {
			furthestIndex = currentIndex + 1;
		}
	}

	function nextQuestion() {
		currentIndex++;
		const existingAnswer = answers.find((a) => a.questionId === questions[currentIndex]?.id);
		if (existingAnswer) {
			currentAnswer = existingAnswer;
			showExplanation = true;
		} else {
			showExplanation = false;
			currentAnswer = undefined;
		}
		userAnswer = '';
		selectedChoices = [];
		if (currentIndex > furthestIndex) {
			furthestIndex = currentIndex;
		}
	}

	function goToPrevious() {
		if (currentIndex <= 0) return;
		currentIndex--;
		const existingAnswer = answers.find((a) => a.questionId === questions[currentIndex]?.id);
		if (existingAnswer) {
			currentAnswer = existingAnswer;
			showExplanation = true;
		} else {
			showExplanation = false;
			currentAnswer = undefined;
		}
		userAnswer = '';
		selectedChoices = [];
	}

	async function handleOverride(result: 'correct' | 'incorrect') {
		if (!currentAnswer) return;
		await overrideAnswer(currentAnswer.id, result);
		currentAnswer = { ...currentAnswer, manuallyOverriddenResult: result, finalResult: result };
		answers = answers.map((a) => (a.id === currentAnswer!.id ? currentAnswer! : a));
	}

	async function finishSession() {
		await completeSession(sessionId);
		goto(`${base}/history/${sessionId}`);
	}

	function selectChoice(choice: string) {
		userAnswer = choice;
	}

	function toggleChoice(choice: string) {
		if (selectedChoices.includes(choice)) {
			selectedChoices = selectedChoices.filter((c) => c !== choice);
		} else {
			selectedChoices = [...selectedChoices, choice];
		}
	}

	function openStudyGuide() {
		if (currentQuestion?.sourceRef) {
			sourceViewer.show({
				chapterId: currentQuestion.chapterId,
				locator: currentQuestion.sourceRef.locator,
				quote: currentQuestion.sourceRef.quote
			});
		}
		if (explanationEl) {
			explanationEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}

		const target = event.target as HTMLElement | null;
		const isEditable =
			target &&
			(target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

		// Don't override default keyboard activation for focused controls (buttons/links/etc.).
		// Exception: allow Enter-in-textarea to submit free-text answers.
		const isFocusableControl = !!target?.closest(
			'button, a, input, textarea, select, option, [role="button"], [role="link"]'
		);
		if (isFocusableControl && event.key === 'Enter' && target?.tagName !== 'TEXTAREA') return;

		if (isEditable) {
			if (event.key === 'Enter' && !event.shiftKey && target?.tagName === 'TEXTAREA') {
				if (!showExplanation && !submitting) {
					if (userAnswer.trim()) {
						event.preventDefault();
						handleSubmit();
					}
				}
			}
			return;
		}

		if (event.ctrlKey || event.altKey || event.metaKey) return;

		if (event.key >= '1' && event.key <= '9') {
			const index = parseInt(event.key, 10) - 1;
			if (!showExplanation && index >= 0 && index < shuffledChoices.length) {
				event.preventDefault();
				if (currentQuestion?.type === 'multiple_choice') {
					selectChoice(shuffledChoices[index]);
				} else if (currentQuestion?.type === 'multiple_select') {
					toggleChoice(shuffledChoices[index]);
				}
			}
			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			if (!showExplanation) {
				const canSubmit =
					currentQuestion?.type === 'multiple_select'
						? selectedChoices.length > 0
						: userAnswer.trim().length > 0;
				if (canSubmit && !submitting) {
					handleSubmit();
				}
			} else {
				if (currentIndex + 1 >= questions.length) {
					finishSession();
				} else {
					nextQuestion();
				}
			}
			return;
		}

		if (event.key === 'e' || event.key === 'E') {
			event.preventDefault();
			openStudyGuide();
			return;
		}

		if (event.key === 'ArrowLeft') {
			if (canGoPrevious) {
				event.preventDefault();
				goToPrevious();
			}
			return;
		}

		if (event.key === 'ArrowRight') {
			if (showExplanation) {
				event.preventDefault();
				if (currentIndex + 1 >= questions.length) {
					finishSession();
				} else {
					nextQuestion();
				}
			}
			return;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if loading}
	<div class="flex items-center justify-center py-20">
		<p class="text-gray-500">Loading session...</p>
	</div>
{:else if !session}
	<div class="py-20 text-center">
		<p class="text-gray-500">Session not found</p>
		<a href="{base}/" class="mt-2 text-primary-600 hover:text-primary-700">Back to Dashboard</a>
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
				<div class="flex items-center justify-center gap-1">
					<svg
						class="h-5 w-5 text-success-600"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2.5"
						><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg
					>
					<p class="text-2xl font-bold text-success-600">
						{answers.filter((a) => a.finalResult === 'correct').length}
					</p>
				</div>
				<p class="text-sm text-gray-500">Correct</p>
			</div>
			<div class="text-center">
				<div class="flex items-center justify-center gap-1">
					<svg
						class="h-5 w-5 text-error-600"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2.5"
						><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg
					>
					<p class="text-2xl font-bold text-error-600">
						{answers.filter((a) => a.finalResult === 'incorrect').length}
					</p>
				</div>
				<p class="text-sm text-gray-500">Incorrect</p>
			</div>
			<div class="text-center">
				<div class="flex items-center justify-center gap-1">
					<svg
						class="h-5 w-5 text-gray-400"
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
					<p class="text-2xl font-bold text-gray-400">
						{answers.filter((a) => a.skipped).length}
					</p>
				</div>
				<p class="text-sm text-gray-500">Skipped</p>
			</div>
		</div>

		<button
			onclick={finishSession}
			class="rounded-xl bg-primary-600 px-8 py-3 font-semibold text-white hover:bg-primary-700"
		>
			View Full Summary
		</button>
		<button
			onclick={() => {
				currentIndex = questions.length - 1;
				const a = answers.find((a) => a.questionId === questions[currentIndex]?.id);
				if (a) {
					currentAnswer = a;
					showExplanation = true;
				}
			}}
			class="mx-auto block text-sm text-gray-500 hover:text-gray-700"
		>
			← Review questions
		</button>
	</div>
{:else if currentQuestion}
	<div class="mx-auto max-w-2xl space-y-6">
		<div class="flex items-center justify-between">
			<span class="text-sm text-gray-500">
				Question {currentIndex + 1} of {questions.length}
			</span>
			{#if currentQuestion.isFinalAssessment}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700"
				>
					<svg
						class="h-3.5 w-3.5"
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
					Final Assessment
				</span>
			{/if}
		</div>

		<div
			class="h-2 w-full overflow-hidden rounded-full bg-gray-200"
			role="progressbar"
			aria-valuenow={progress}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-label="Session progress"
		>
			<div
				class="h-full rounded-full bg-primary-500 transition-all duration-300"
				style="width: {progress}%"
			></div>
		</div>

		<div
			class="rounded-xl border bg-white p-6 shadow-sm {currentQuestion.isFinalAssessment
				? 'border-amber-300 bg-amber-50/30 ring-1 ring-amber-200'
				: 'border-gray-200'}"
		>
			{#if currentQuestion.isFinalAssessment}
				<div class="mb-3 flex items-center gap-2 border-b border-amber-200 pb-3">
					<svg
						class="h-4 w-4 text-amber-600"
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
					<span class="text-xs font-semibold tracking-wide text-amber-600 uppercase"
						>Final Assessment Question</span
					>
				</div>
			{/if}
			{#if currentQuestion.context}
				<div
					class="prose prose-sm mb-4 max-w-none rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700"
				>
					{@html renderMarkdown(currentQuestion.context)}
				</div>
			{/if}
			<p class="text-lg font-medium text-gray-900">{currentQuestion.prompt}</p>

			{#if !showExplanation}
				{#if currentQuestion.type === 'multiple_choice' && shuffledChoices.length > 0}
					<div class="mt-4 space-y-2" role="radiogroup" aria-label="Answer choices">
						{#each shuffledChoices as choice, idx}
							<button
								onclick={() => selectChoice(choice)}
								role="radio"
								aria-checked={userAnswer === choice}
								class="flex w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left text-sm transition-colors {userAnswer ===
								choice
									? 'border-primary-500 bg-primary-50 font-medium text-primary-700'
									: 'border-gray-200 hover:border-gray-300'}"
							>
								<span
									class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-gray-100 text-xs font-semibold text-gray-600"
								>
									{idx + 1}
								</span>
								<span class="flex-1">{choice}</span>
							</button>
						{/each}
					</div>
				{:else if currentQuestion.type === 'multiple_select' && shuffledChoices.length > 0}
					<div class="mt-4 space-y-3">
						<p class="text-xs font-medium tracking-wide text-gray-600 uppercase">
							Select all that apply
						</p>
						<div class="space-y-2" role="group" aria-label="Answer choices — select all that apply">
							{#each shuffledChoices as choice, idx}
								<button
									onclick={() => toggleChoice(choice)}
									class="flex w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left text-sm transition-colors {selectedChoices.includes(
										choice
									)
										? 'border-primary-500 bg-primary-50 font-medium text-primary-700'
										: 'border-gray-200 hover:border-gray-300'}"
								>
									<span
										class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-gray-100 text-xs font-semibold text-gray-600"
									>
										{idx + 1}
									</span>
									<div
										class="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 {selectedChoices.includes(
											choice
										)
											? 'border-primary-500 bg-primary-500'
											: 'border-gray-300'}"
									>
										{#if selectedChoices.includes(choice)}
											<svg
												class="h-3.5 w-3.5 text-white"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												stroke-width="3"
												><path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M5 13l4 4L19 7"
												/></svg
											>
										{/if}
									</div>
									<span class="flex-1">{choice}</span>
								</button>
							{/each}
						</div>
					</div>
				{:else}
					<label for="free-text-answer" class="sr-only">Your answer</label>
					<textarea
						id="free-text-answer"
						bind:value={userAnswer}
						placeholder="Type your answer... (Press Enter to submit)"
						class="mt-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
						rows="3"
					></textarea>
				{/if}

				<div class="mt-4 flex flex-wrap items-center justify-between gap-3">
					<div class="flex gap-2">
						{#if canGoPrevious}
							<button
								onclick={goToPrevious}
								class="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
							>
								← Previous <span class="text-xs text-gray-400">(←)</span>
							</button>
						{/if}
						{#if currentQuestion.sourceRef}
							<button
								onclick={openStudyGuide}
								class="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2.5 text-sm font-medium text-yellow-800 hover:bg-yellow-100"
								title="Open study guide"
							>
								📖 Study guide <span class="text-xs opacity-75">(E)</span>
							</button>
						{/if}
					</div>
					<div class="flex flex-1 justify-end gap-2">
						<button
							onclick={handleSubmit}
							disabled={(currentQuestion.type === 'multiple_select'
								? selectedChoices.length === 0
								: !userAnswer.trim()) || submitting}
							class="max-w-xs flex-1 rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Submit Answer <span class="text-xs opacity-75">(Enter ↵)</span>
						</button>
						<button
							onclick={handleSkip}
							disabled={submitting}
							class="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
						>
							Skip
						</button>
					</div>
				</div>
			{:else if currentAnswer}
				<div class="mt-4 space-y-4" aria-live="polite">
					{#if currentAnswer.skipped}
						<div class="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-3">
							<svg
								class="h-5 w-5 text-gray-400"
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
							<p class="text-sm font-medium text-gray-600">Skipped</p>
						</div>
					{:else if currentQuestion.type !== 'multiple_choice'}
						<div
							class="rounded-lg px-4 py-3 {currentAnswer.finalResult === 'correct'
								? 'border border-green-200 bg-green-50'
								: 'border border-red-200 bg-red-50'}"
						>
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									{#if currentAnswer.finalResult === 'correct'}
										<svg
											class="h-5 w-5 text-green-600"
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
										<p class="text-sm font-medium text-green-700">Correct</p>
									{:else}
										<svg
											class="h-5 w-5 text-red-600"
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
										<p class="text-sm font-medium text-red-700">Incorrect</p>
									{/if}
								</div>
								{#if currentAnswer.manuallyOverriddenResult}
									<span class="text-xs text-gray-500">(manually overridden)</span>
								{/if}
							</div>
							{#if currentQuestion.type === 'multiple_select'}
								{@const userSelections = (() => {
									try {
										return JSON.parse(currentAnswer.userAnswer);
									} catch {
										return [];
									}
								})()}
								<p class="mt-1 text-sm text-gray-600">
									Your answers: {userSelections.join(', ')}
								</p>
								{#if currentAnswer.finalResult === 'incorrect'}
									<p class="mt-1 text-sm text-gray-600">
										Correct answers: {(currentQuestion.correctAnswers ?? []).join(', ')}
									</p>
								{/if}
							{:else if currentQuestion.type === 'free_text'}
								<p class="mt-1 text-sm text-gray-600">Your answer: {currentAnswer.userAnswer}</p>
								{#if currentAnswer.finalResult === 'incorrect'}
									<p class="mt-1 text-sm text-gray-600">
										Correct answer: {currentQuestion.correctAnswer}
									</p>
								{/if}
							{/if}
						</div>
					{/if}

					{#if currentQuestion.type === 'multiple_choice' && shuffledChoices.length > 0 && !currentAnswer.skipped}
						<div class="space-y-2" aria-label="Answer review">
							{#each shuffledChoices as choice}
								{@const isCorrectChoice = choice === currentQuestion.correctAnswer}
								{@const isUserChoice = choice === currentAnswer.userAnswer}
								<div
									class="flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-sm
									{isCorrectChoice
										? 'border-green-300 bg-green-50'
										: isUserChoice && !isCorrectChoice
											? 'border-red-300 bg-red-50'
											: 'border-gray-100 bg-gray-50 opacity-60'}"
								>
									{#if isCorrectChoice}
										<svg
											class="h-4 w-4 shrink-0 text-green-600"
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
									{:else if isUserChoice}
										<svg
											class="h-4 w-4 shrink-0 text-red-600"
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
										<span class="h-4 w-4 shrink-0"></span>
									{/if}
									<span
										class={isCorrectChoice
											? 'font-medium text-green-800'
											: isUserChoice && !isCorrectChoice
												? 'font-medium text-red-800'
												: 'text-gray-500'}
									>
										{choice}
									</span>
									{#if isCorrectChoice}
										<span class="ml-auto text-xs font-medium text-green-600">Correct answer</span>
									{:else if isUserChoice && !isCorrectChoice}
										<span class="ml-auto text-xs font-medium text-red-600">Your answer</span>
									{/if}
								</div>
							{/each}
						</div>
					{:else if currentQuestion.type === 'multiple_select' && shuffledChoices.length > 0 && !currentAnswer.skipped}
						{@const userSelections = (() => {
							try {
								return JSON.parse(currentAnswer.userAnswer);
							} catch {
								return [];
							}
						})()}
						{@const correctAnswers = currentQuestion.correctAnswers ?? []}
						<div class="space-y-2" aria-label="Answer review">
							{#each shuffledChoices as choice}
								{@const isCorrectChoice = correctAnswers.includes(choice)}
								{@const isUserChoice = userSelections.includes(choice)}
								<div
									class="flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-sm
									{isCorrectChoice && isUserChoice
										? 'border-green-300 bg-green-50'
										: isCorrectChoice && !isUserChoice
											? 'border-green-300 bg-green-50'
											: !isCorrectChoice && isUserChoice
												? 'border-red-300 bg-red-50'
												: 'border-gray-100 bg-gray-50 opacity-60'}"
								>
									{#if isCorrectChoice}
										<svg
											class="h-4 w-4 shrink-0 text-green-600"
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
									{:else if isUserChoice}
										<svg
											class="h-4 w-4 shrink-0 text-red-600"
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
										<span class="h-4 w-4 shrink-0"></span>
									{/if}
									<span
										class={isCorrectChoice
											? 'font-medium text-green-800'
											: isUserChoice && !isCorrectChoice
												? 'font-medium text-red-800'
												: 'text-gray-500'}
									>
										{choice}
									</span>
									{#if isCorrectChoice && !isUserChoice}
										<span class="ml-auto text-xs font-medium text-green-600">Missed</span>
									{:else if !isCorrectChoice && isUserChoice}
										<span class="ml-auto text-xs font-medium text-red-600">Your answer</span>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					<div
						bind:this={explanationEl}
						class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3"
					>
						<div class="flex items-center justify-between">
							<p class="text-xs font-medium text-blue-600 uppercase">Explanation</p>
							{#if currentQuestion.sourceRef}
								<button
									onclick={openStudyGuide}
									class="text-xs font-medium text-blue-700 hover:underline"
									title="Press E to open study guide"
								>
									Open Study guide <span class="opacity-75">(E)</span>
								</button>
							{/if}
						</div>
						<div class="prose prose-sm mt-1 max-w-none text-gray-700">
							{@html renderMarkdown(currentQuestion.explanation)}
						</div>
					</div>

					{#if currentQuestion.sourceRef}
						<SourceQuote
							chapterId={currentQuestion.chapterId}
							sourceRef={currentQuestion.sourceRef}
						/>
					{/if}

					{#if currentQuestion.type === 'free_text' && !currentAnswer.skipped}
						<div class="flex items-center gap-2">
							<span class="text-xs text-gray-500">Override result:</span>
							<button
								onclick={() => handleOverride('correct')}
								class="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium {currentAnswer.finalResult ===
								'correct'
									? 'bg-green-100 text-green-700'
									: 'border border-gray-200 text-gray-500 hover:bg-gray-50'}"
							>
								<svg
									class="h-3 w-3"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2.5"
									><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg
								>
								Mark Correct
							</button>
							<button
								onclick={() => handleOverride('incorrect')}
								class="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium {currentAnswer.finalResult ===
								'incorrect'
									? 'bg-red-100 text-red-700'
									: 'border border-gray-200 text-gray-500 hover:bg-gray-50'}"
							>
								<svg
									class="h-3 w-3"
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
								Mark Incorrect
							</button>
						</div>
					{/if}

					<div class="flex gap-3">
						{#if canGoPrevious}
							<button
								onclick={goToPrevious}
								class="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
							>
								← Previous <span class="text-xs text-gray-400">(←)</span>
							</button>
						{/if}
						<button
							onclick={nextQuestion}
							class="flex-1 rounded-lg bg-primary-600 py-2.5 font-medium text-white hover:bg-primary-700"
						>
							{currentIndex + 1 >= questions.length ? 'Finish' : 'Next Question'}
							<span class="text-xs opacity-75">(Enter ↵ / →)</span>
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
