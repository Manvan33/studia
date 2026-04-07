<script lang="ts">
	import { goto } from '$app/navigation';
	import { validateImportData, importData, extractJson } from '$lib/import';
	import { LLM_PROMPT } from '$lib/prompt';
	import type { ImportData, ValidationError } from '$lib/types';

	let jsonInput = $state('');
	let fileName = $state('');
	let errors = $state<ValidationError[]>([]);
	let preview = $state<ImportData | null>(null);
	let importing = $state(false);
	let parseError = $state('');
	let promptCopied = $state(false);

	function handleParse() {
		errors = [];
		preview = null;
		parseError = '';

		if (!jsonInput.trim()) {
			parseError = 'Please paste JSON or upload a file';
			return;
		}

		const jsonText = extractJson(jsonInput);

		let parsed: unknown;
		try {
			parsed = JSON.parse(jsonText);
		} catch {
			parseError = 'Invalid JSON syntax. Paste raw JSON or LLM output containing a ```json code block.';
			return;
		}

		const result = validateImportData(parsed);
		if (!result.valid) {
			errors = result.errors;
			return;
		}

		preview = parsed as ImportData;
	}

	async function handleImport() {
		if (!preview || importing) return;
		importing = true;

		try {
			// Use $state.snapshot() to unwrap Svelte 5 reactive proxy before
			// passing to Dexie/IndexedDB, which requires structuredClone-compatible objects
			const rawPreview = $state.snapshot(preview);
			const { themeId } = await importData(rawPreview);
			goto(`/themes/${themeId}`);
		} catch (e: unknown) {
			parseError = e instanceof Error ? e.message : 'Import failed';
			importing = false;
		}
	}

	function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		fileName = file.name;
		const reader = new FileReader();
		reader.onload = (e) => {
			jsonInput = (e.target?.result as string) ?? '';
			handleParse();
		};
		reader.readAsText(file);
	}

	function clearAll() {
		jsonInput = '';
		fileName = '';
		errors = [];
		preview = null;
		parseError = '';
	}

	async function copyPrompt() {
		try {
			await navigator.clipboard.writeText(LLM_PROMPT);
			promptCopied = true;
			setTimeout(() => (promptCopied = false), 2000);
		} catch {
			parseError = 'Failed to copy prompt to clipboard';
		}
	}

	const totalQuestions = $derived(() => {
		if (!preview) return 0;
		let count = 0;
		for (const ch of preview.chapters) {
			for (const t of ch.topics) {
				count += t.questions.length;
			}
			count += ch.finalAssessment?.length ?? 0;
		}
		return count;
	});
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-gray-900">Import Content</h1>
		<p class="mt-1 text-sm text-gray-500">Paste raw JSON or full LLM output containing a JSON code block</p>
	</div>

	<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm font-medium text-gray-900">LLM Prompt Template</p>
				<p class="text-xs text-gray-500">Copy this prompt, paste your study material at the end, and send to any LLM</p>
			</div>
			<button
				onclick={copyPrompt}
				class="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 {promptCopied ? 'border-green-300 bg-green-50 text-green-700' : ''}"
			>
				{#if promptCopied}
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
					Copied!
				{:else}
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
					Copy Prompt
				{/if}
			</button>
		</div>
	</div>

	{#if !preview}
		<div class="space-y-4">
			<div>
				<label
					class="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white p-8 transition-colors hover:border-primary-400 hover:bg-primary-50"
				>
					<div class="text-center">
						<p class="text-sm font-medium text-gray-600">
							{fileName || 'Drop a JSON file here or click to upload'}
						</p>
						<p class="mt-1 text-xs text-gray-400">.json files only</p>
					</div>
					<input type="file" accept=".json" class="hidden" onchange={handleFileUpload} />
				</label>
			</div>

			<div class="relative">
				<div class="absolute inset-0 flex items-center">
					<div class="w-full border-t border-gray-300"></div>
				</div>
				<div class="relative flex justify-center text-sm">
					<span class="bg-gray-50 px-2 text-gray-500">or paste JSON</span>
				</div>
			</div>

			<textarea
				bind:value={jsonInput}
				placeholder="Paste JSON or full LLM output here..."
				class="h-64 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-mono text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
			></textarea>

			<button
				onclick={handleParse}
				disabled={!jsonInput.trim()}
				class="w-full rounded-xl bg-primary-600 py-3 font-semibold text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
			<h2 class="text-lg font-semibold text-gray-900">Import Preview</h2>

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
					<span class="text-sm font-medium text-gray-900">{totalQuestions()}</span>
				</div>
			</div>

			<div class="mt-4 space-y-2">
				{#each preview.chapters as chapter}
					<div class="rounded-lg bg-gray-50 px-3 py-2">
						<p class="text-sm font-medium text-gray-800">Ch. {chapter.order}: {chapter.title}</p>
						<p class="text-xs text-gray-500">
							{chapter.topics.length} topics,
							{chapter.topics.reduce((sum, t) => sum + t.questions.length, 0)} questions
							{#if chapter.finalAssessment?.length}
								+ {chapter.finalAssessment.length} final assessment
							{/if}
						</p>
					</div>
				{/each}
			</div>

			<div class="mt-6 flex gap-3">
				<button
					onclick={handleImport}
					disabled={importing}
					class="flex-1 rounded-lg bg-primary-600 py-2.5 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
				>
					{importing ? 'Importing...' : 'Import'}
				</button>
				<button
					onclick={clearAll}
					class="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}
</div>
