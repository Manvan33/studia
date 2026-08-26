<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { db } from '$lib/db';
	import { nanoid } from 'nanoid';
	import type { Topic, Question, QuestionType } from '$lib/types';
	import { liveQuery } from 'dexie';

	const topicId = $derived(page.params.topicId ?? '');

	let topic = $state<Topic | undefined>();
	let questions = $state<Question[]>([]);
	let editingTitle = $state('');
	let showAddQuestion = $state(false);
	let confirmDelete = $state(false);

	let newType = $state<QuestionType>('multiple_choice');
	let newPrompt = $state('');
	let newContext = $state('');
	let newChoices = $state<string[]>(['', '']);
	let newCorrectAnswer = $state('');
	let newCorrectAnswers = $state<string[]>([]);
	let newExplanation = $state('');

	$effect(() => {
		const id = topicId;
		const sub1 = liveQuery(() => db.topics.get(id)).subscribe({
			next: (v) => {
				topic = v;
				if (v) editingTitle = v.title;
			}
		});
		const sub2 = liveQuery(() =>
			db.questions
				.where('topicId')
				.equals(id)
				.and((q) => !q.isFinalAssessment)
				.sortBy('order')
		).subscribe({
			next: (v) => (questions = v)
		});
		return () => {
			sub1.unsubscribe();
			sub2.unsubscribe();
		};
	});

	async function saveTopic() {
		if (!editingTitle.trim()) return;
		await db.topics.update(topicId, {
			title: editingTitle.trim(),
			updatedAt: new Date().toISOString()
		});
	}

	function addChoice() {
		newChoices = [...newChoices, ''];
	}

	function removeChoice(index: number) {
		newChoices = newChoices.filter((_, i) => i !== index);
	}

	function updateChoice(index: number, value: string) {
		newChoices = newChoices.map((c, i) => (i === index ? value : c));
	}

	async function addQuestion() {
		if (!topic || !newPrompt.trim() || !newExplanation.trim()) return;

		// Validate correct answers based on type
		if (newType === 'multiple_select') {
			if (newCorrectAnswers.length < 1) return;
		} else {
			if (!newCorrectAnswer.trim()) return;
		}

		const now = new Date().toISOString();
		await db.questions.add({
			id: nanoid(),
			chapterId: topic.chapterId,
			topicId,
			type: newType,
			prompt: newPrompt.trim(),
			context: newContext.trim() || undefined,
			choices:
				newType === 'multiple_choice' || newType === 'multiple_select'
					? [...newChoices.filter((c) => c.trim())]
					: undefined,
			correctAnswer: newType === 'multiple_select' ? '' : newCorrectAnswer.trim(),
			correctAnswers: newType === 'multiple_select' ? [...newCorrectAnswers] : undefined,
			explanation: newExplanation.trim(),
			order: questions.length + 1,
			isFinalAssessment: false,
			createdAt: now,
			updatedAt: now
		});
		resetForm();
	}

	function resetForm() {
		newPrompt = '';
		newContext = '';
		newChoices = ['', ''];
		newCorrectAnswer = '';
		newCorrectAnswers = [];
		newExplanation = '';
		showAddQuestion = false;
	}

	async function deleteQuestion(id: string) {
		await db.questions.delete(id);
	}

	async function deleteTopic() {
		if (!topic) return;
		await db.transaction('rw', [db.topics, db.questions], async () => {
			await db.questions.where('topicId').equals(topicId).delete();
			await db.topics.delete(topicId);
		});
		goto(`${base}/content/chapters/${topic.chapterId}`);
	}
</script>

{#if topic}
	<div class="mx-auto max-w-2xl space-y-6">
		<div>
			<a
				href="{base}/content/chapters/{topic.chapterId}"
				class="text-sm text-primary-600 hover:text-primary-700">&larr; Back to Chapter</a
			>
			<h1 class="mt-2 text-2xl font-bold text-gray-900">Edit Topic</h1>
		</div>

		<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			<div class="flex gap-3">
				<input
					bind:value={editingTitle}
					class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
				/>
				<button
					onclick={saveTopic}
					class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
				>
					Save
				</button>
			</div>
		</div>

		<div>
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-gray-800">Questions ({questions.length})</h2>
				<button
					onclick={() => (showAddQuestion = !showAddQuestion)}
					class="text-sm text-primary-600 hover:text-primary-700"
				>
					{showAddQuestion ? 'Cancel' : '+ Add Question'}
				</button>
			</div>

			{#if showAddQuestion}
				<div class="mb-4 space-y-3 rounded-lg border border-gray-200 bg-white p-4">
					<div>
						<label for="q-type" class="mb-1 block text-xs font-medium text-gray-700">Type</label>
						<select
							id="q-type"
							bind:value={newType}
							class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
						>
							<option value="multiple_choice">Multiple Choice</option>
							<option value="multiple_select">Select All That Apply</option>
							<option value="free_text">Free Text</option>
						</select>
					</div>

					<div>
						<label for="q-prompt" class="mb-1 block text-xs font-medium text-gray-700"
							>Question</label
						>
						<textarea
							id="q-prompt"
							bind:value={newPrompt}
							rows="2"
							class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
						></textarea>
					</div>

					<div>
						<label for="q-context" class="mb-1 block text-xs font-medium text-gray-700"
							>Context <span class="font-normal text-gray-400">(optional, markdown)</span></label
						>
						<textarea
							id="q-context"
							bind:value={newContext}
							rows="2"
							placeholder="Background information shown before the question..."
							class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
						></textarea>
					</div>

					{#if newType === 'multiple_choice' || newType === 'multiple_select'}
						<div>
							<p class="mb-1 text-xs font-medium text-gray-700">Choices</p>
							{#each newChoices as choice, i}
								<div class="mb-2 flex gap-2">
									<input
										value={choice}
										oninput={(e) => updateChoice(i, (e.target as HTMLInputElement).value)}
										placeholder="Choice {i + 1}"
										class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
									/>
									{#if newChoices.length > 2}
										<button
											onclick={() => removeChoice(i)}
											class="text-sm text-red-500 hover:text-red-600">✗</button
										>
									{/if}
								</div>
							{/each}
							<button onclick={addChoice} class="text-xs text-primary-600 hover:text-primary-700"
								>+ Add Choice</button
							>
						</div>
					{/if}

					{#if newType === 'multiple_select'}
						<div>
							<p class="mb-1 text-xs font-medium text-gray-700">
								Correct Answers (select which choices are correct)
							</p>
							{#each newChoices.filter((c) => c.trim()) as choice}
								<div class="mb-2 flex items-center gap-2">
									<input
										type="checkbox"
										id="correct-{choice}"
										checked={newCorrectAnswers.includes(choice)}
										onchange={(e) => {
											if ((e.target as HTMLInputElement).checked) {
												newCorrectAnswers = [...newCorrectAnswers, choice];
											} else {
												newCorrectAnswers = newCorrectAnswers.filter((c) => c !== choice);
											}
										}}
										class="rounded border-gray-300"
									/>
									<label for="correct-{choice}" class="text-sm text-gray-700">{choice}</label>
								</div>
							{/each}
						</div>
					{/if}

					{#if newType !== 'multiple_select'}
						<div>
							<label for="q-answer" class="mb-1 block text-xs font-medium text-gray-700"
								>Correct Answer</label
							>
							<input
								id="q-answer"
								bind:value={newCorrectAnswer}
								class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
							/>
						</div>
					{/if}

					<div>
						<label for="q-explanation" class="mb-1 block text-xs font-medium text-gray-700"
							>Explanation <span class="font-normal text-gray-400">(markdown)</span></label
						>
						<textarea
							id="q-explanation"
							bind:value={newExplanation}
							rows="2"
							class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
						></textarea>
					</div>

					<button
						onclick={addQuestion}
						class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
					>
						Add Question
					</button>
				</div>
			{/if}

			<div class="space-y-2">
				{#each questions as question, i}
					<div class="rounded-lg border border-gray-200 bg-white px-4 py-3">
						<div class="flex items-start justify-between gap-2">
							<div class="flex-1">
								<div class="flex items-center gap-2">
									<span class="text-xs font-medium text-gray-400">{i + 1}</span>
									<span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500"
										>{question.type === 'multiple_choice'
											? 'MCQ'
											: question.type === 'multiple_select'
												? 'Select'
												: 'Text'}</span
									>
								</div>
								<p class="mt-1 text-sm text-gray-900">{question.prompt}</p>
								<p class="mt-0.5 text-xs text-gray-500">
									Answer: {question.type === 'multiple_select'
										? question.correctAnswers?.join(', ')
										: question.correctAnswer}
								</p>
							</div>
							<button
								onclick={() => deleteQuestion(question.id)}
								class="shrink-0 text-xs text-red-500 hover:text-red-600">Delete</button
							>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<div class="border-t border-gray-200 pt-6">
			{#if confirmDelete}
				<div class="rounded-lg border border-red-200 bg-red-50 p-4">
					<p class="text-sm text-red-700">Delete this topic and all its questions?</p>
					<div class="mt-3 flex gap-3">
						<button
							onclick={deleteTopic}
							class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
							>Yes, Delete</button
						>
						<button
							onclick={() => (confirmDelete = false)}
							class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
							>Cancel</button
						>
					</div>
				</div>
			{:else}
				<button
					onclick={() => (confirmDelete = true)}
					class="text-sm text-red-600 hover:text-red-700">Delete Topic</button
				>
			{/if}
		</div>
	</div>
{:else}
	<p class="text-gray-500">Loading...</p>
{/if}
