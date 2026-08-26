<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { db } from '$lib/db';
	import {
		exportThemeAsJson,
		validateImportData,
		updateThemeFromJson,
		extractJson
	} from '$lib/import';
	import type { ImportData, ValidationError } from '$lib/types';

	const themeId = $derived(page.params.themeId ?? '');

	let jsonText = $state('');
	let loading = $state(true);
	let errors = $state<ValidationError[]>([]);
	let parseError = $state('');
	let preview = $state<ImportData | null>(null);
	let saving = $state(false);
	let copySuccess = $state(false);
	let themeTitle = $state('');

	$effect(() => {
		const id = themeId;
		loading = true;
		errors = [];
		preview = null;
		parseError = '';

		loadThemeJson(id);
	});

	async function loadThemeJson(id: string) {
		try {
			const theme = await db.themes.get(id);
			if (!theme) {
				parseError = 'Theme not found';
				loading = false;
				return;
			}
			themeTitle = theme.title;
			const exported = await exportThemeAsJson(id);
			jsonText = JSON.stringify(exported, null, 2);
		} catch (e: unknown) {
			parseError = e instanceof Error ? e.message : 'Failed to load theme';
		}
		loading = false;
	}

	function handleValidate() {
		errors = [];
		preview = null;
		parseError = '';

		if (!jsonText.trim()) {
			parseError = 'JSON content is empty';
			return;
		}

		const extracted = extractJson(jsonText);

		let parsed: unknown;
		try {
			parsed = JSON.parse(extracted);
		} catch {
			parseError =
				'Invalid JSON syntax. Paste raw JSON or LLM output containing a ```json code block.';
			return;
		}

		const result = validateImportData(parsed);
		if (!result.valid) {
			errors = result.errors;
			return;
		}

		preview = parsed as ImportData;
	}

	async function handleSave() {
		if (!preview || saving) return;
		saving = true;

		try {
			const rawPreview = $state.snapshot(preview);
			await updateThemeFromJson(themeId, rawPreview);
			goto(`${base}/content/themes/${themeId}`);
		} catch (e: unknown) {
			parseError = e instanceof Error ? e.message : 'Update failed';
			saving = false;
		}
	}

	function cancelPreview() {
		preview = null;
		errors = [];
		parseError = '';
	}

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(jsonText);
			copySuccess = true;
			setTimeout(() => (copySuccess = false), 2000);
		} catch {
			parseError = 'Failed to copy to clipboard';
		}
	}

	const previewQuestionCount = $derived(() => {
		if (!preview) return 0;
		let count = 0;
		for (const chapter of preview.chapters) {
			for (const topic of chapter.topics) {
				count += topic.questions.length;
			}
			count += chapter.finalAssessment?.length ?? 0;
		}
		return count;
	});
</script>

<div class="mx-auto max-w-4xl space-y-6">
	<div>
		<a href="{base}/content/themes/{themeId}" class="text-sm text-primary-600 hover:text-primary-700"
			>&larr; Back to Theme</a
		>
		<h1 class="mt-2 text-2xl font-bold text-gray-900">Edit Theme JSON</h1>
		{#if themeTitle}
			<p class="mt-1 text-sm text-gray-500">{themeTitle}</p>
		{/if}
	</div>

	{#if loading}
		<p class="text-gray-500">Loading...</p>
	{:else if !preview}
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<p class="text-sm text-gray-600">Edit the JSON below, or paste modified LLM output</p>
				<button
					onclick={handleCopy}
					class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
				>
					{copySuccess ? 'Copied!' : 'Copy JSON'}
				</button>
			</div>

			<textarea
				bind:value={jsonText}
				class="h-[32rem] w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-mono text-sm leading-relaxed focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
				spellcheck="false"
			></textarea>

			<button
				onclick={handleValidate}
				disabled={!jsonText.trim()}
				class="w-full rounded-xl bg-primary-600 py-3 font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Validate & Preview
			</button>
		</div>

		{#if parseError}
			<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
				<p class="text-sm font-medium text-red-700">{parseError}</p>
			</div>
		{/if}

		{#if errors.length > 0}
			<div class="rounded-lg border border-red-200 bg-red-50 p-4">
				<p class="mb-2 text-sm font-medium text-red-700">Validation errors:</p>
				<ul class="space-y-1">
					{#each errors as error}
						<li class="text-sm text-red-600">
							<span class="font-mono text-xs text-red-500">{error.path}</span>: {error.message}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	{:else}
		<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			<h2 class="text-lg font-semibold text-gray-900">Update Preview</h2>
			<p class="mt-1 text-sm text-amber-600">
				This will replace all chapters, topics, and questions in this theme.
			</p>

			<div class="mt-4 space-y-3">
				<div class="flex justify-between border-b border-gray-100 pb-2">
					<span class="text-sm text-gray-500">Theme</span>
					<span class="text-sm font-medium text-gray-900">{preview.theme.title}</span>
				</div>
				<div class="flex justify-between border-b border-gray-100 pb-2">
					<span class="text-sm text-gray-500">Chapters</span>
					<span class="text-sm font-medium text-gray-900">{preview.chapters.length}</span>
				</div>
				<div class="flex justify-between border-b border-gray-100 pb-2">
					<span class="text-sm text-gray-500">Total Questions</span>
					<span class="text-sm font-medium text-gray-900">{previewQuestionCount()}</span>
				</div>
			</div>

			<div class="mt-4 space-y-2">
				{#each preview.chapters as chapter}
					<div class="rounded-lg bg-gray-50 px-3 py-2">
						<p class="text-sm font-medium text-gray-800">Ch. {chapter.order}: {chapter.title}</p>
						<p class="text-xs text-gray-500">
							{chapter.topics.length} topics, {chapter.finalAssessment?.length ?? 0} final assessment
							questions
						</p>
					</div>
				{/each}
			</div>

			<div class="mt-6 flex gap-3">
				<button
					onclick={handleSave}
					disabled={saving}
					class="flex-1 rounded-lg bg-primary-600 py-2.5 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
				>
					{saving ? 'Saving...' : 'Apply Changes'}
				</button>
				<button
					onclick={cancelPreview}
					class="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}
</div>
