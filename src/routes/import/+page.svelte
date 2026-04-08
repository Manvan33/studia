<script lang="ts">
	import { goto } from '$app/navigation';
	import { validateImportData, importData, extractJson, findExistingTheme } from '$lib/import';
	import { LLM_PROMPT } from '$lib/prompt';
	import type { ImportData, ValidationError, LearningTheme } from '$lib/types';

	interface FileEntry {
		fileName: string;
		data: ImportData | null;
		errors: ValidationError[];
		parseError: string;
		existingTheme: LearningTheme | null;
	}

	let jsonInput = $state('');
	let fileEntries = $state<FileEntry[]>([]);
	let importing = $state(false);
	let parseError = $state('');
	let promptCopied = $state(false);
	let isDragOver = $state(false);

	// Single-file paste preview (existing behavior)
	let pastePreview = $state<ImportData | null>(null);
	let pasteErrors = $state<ValidationError[]>([]);
	let pasteExistingTheme = $state<LearningTheme | null>(null);

	const hasPreview = $derived(pastePreview !== null || fileEntries.length > 0);
	const validFileEntries = $derived(fileEntries.filter((e) => e.data !== null));

	function countQuestions(data: ImportData): number {
		let count = 0;
		for (const ch of data.chapters) {
			for (const t of ch.topics) {
				count += t.questions.length;
			}
			count += ch.finalAssessment?.length ?? 0;
		}
		return count;
	}

	async function parseAndValidate(jsonText: string): Promise<{
		data: ImportData | null;
		errors: ValidationError[];
		parseError: string;
		existingTheme: LearningTheme | null;
	}> {
		const extracted = extractJson(jsonText);

		let parsed: unknown;
		try {
			parsed = JSON.parse(extracted);
		} catch {
			return {
				data: null,
				errors: [],
				parseError:
					'Invalid JSON syntax. Paste raw JSON or LLM output containing a ```json code block.',
				existingTheme: null
			};
		}

		const result = validateImportData(parsed);
		if (!result.valid) {
			return { data: null, errors: result.errors, parseError: '', existingTheme: null };
		}

		const importDataParsed = parsed as ImportData;
		const found = await findExistingTheme(importDataParsed.theme.title);
		return { data: importDataParsed, errors: [], parseError: '', existingTheme: found ?? null };
	}

	async function handlePaste() {
		pasteErrors = [];
		pastePreview = null;
		parseError = '';
		pasteExistingTheme = null;

		if (!jsonInput.trim()) {
			parseError = 'Please paste JSON or upload a file';
			return;
		}

		const result = await parseAndValidate(jsonInput);
		if (result.parseError) {
			parseError = result.parseError;
			return;
		}
		if (result.errors.length > 0) {
			pasteErrors = result.errors;
			return;
		}

		pasteExistingTheme = result.existingTheme;
		pastePreview = result.data;
	}

	async function processFiles(files: FileList | File[]) {
		if (!files || files.length === 0) return;

		parseError = '';

		if (files.length === 1) {
			// Single file: use paste-style preview (existing UX)
			const file = files[0];
			const text = await readFileAsText(file);
			jsonInput = text;
			const result = await parseAndValidate(text);

			if (result.parseError) {
				parseError = result.parseError;
				return;
			}
			if (result.errors.length > 0) {
				pasteErrors = result.errors;
				return;
			}

			pasteExistingTheme = result.existingTheme;
			pastePreview = result.data;
			// Store the filename for display
			fileEntries = [];
		} else {
			// Multiple files: batch preview
			pastePreview = null;
			pasteErrors = [];
			pasteExistingTheme = null;
			jsonInput = '';

			const entries: FileEntry[] = [];
			for (const file of files) {
				const text = await readFileAsText(file);
				const result = await parseAndValidate(text);
				entries.push({
					fileName: file.name,
					data: result.data,
					errors: result.errors,
					parseError: result.parseError,
					existingTheme: result.existingTheme
				});
			}
			fileEntries = entries;
		}
	}

	async function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = input.files;
		if (!files || files.length === 0) return;

		await processFiles(files);

		// Reset file input so the same files can be re-selected
		input.value = '';
	}

	async function handleFileDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		isDragOver = false;

		const files = event.dataTransfer?.files;
		if (!files || files.length === 0) return;
		await processFiles(files);
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'copy';
		}
		isDragOver = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		isDragOver = false;
	}

	function readFileAsText(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => resolve((e.target?.result as string) ?? '');
			reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
			reader.readAsText(file);
		});
	}

	async function handleImportPaste() {
		if (!pastePreview || importing) return;
		importing = true;

		try {
			const rawPreview = $state.snapshot(pastePreview);
			const { themeId } = await importData(rawPreview);
			goto(`/themes/${themeId}`);
		} catch (e: unknown) {
			parseError = e instanceof Error ? e.message : 'Import failed';
			importing = false;
		}
	}

	async function handleImportBatch() {
		if (validFileEntries.length === 0 || importing) return;
		importing = true;

		try {
			let lastThemeId = '';
			const importedThemeIds = new Set<string>();

			for (const entry of validFileEntries) {
				const rawData = $state.snapshot(entry.data!);
				const { themeId } = await importData(rawData);
				lastThemeId = themeId;
				importedThemeIds.add(themeId);
			}

			if (importedThemeIds.size === 1) {
				goto(`/themes/${lastThemeId}`);
			} else {
				goto('/themes');
			}
		} catch (e: unknown) {
			parseError = e instanceof Error ? e.message : 'Import failed';
			importing = false;
		}
	}

	function clearAll() {
		jsonInput = '';
		fileEntries = [];
		pasteErrors = [];
		pastePreview = null;
		parseError = '';
		pasteExistingTheme = null;
		importing = false;
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
</script>

<svelte:window on:dragover|preventDefault on:drop|preventDefault />

<div class="mx-auto max-w-2xl space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-gray-900">Import Content</h1>
		<p class="mt-1 text-sm text-gray-500">
			Paste raw JSON or full LLM output containing a JSON code block
		</p>
	</div>

	<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm font-medium text-gray-900">LLM Prompt Template</p>
				<p class="text-xs text-gray-500">
					Copy this prompt, paste your study material at the end, and send to any LLM
				</p>
			</div>
			<button
				onclick={copyPrompt}
				class="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 {promptCopied
					? 'border-green-300 bg-green-50 text-green-700'
					: ''}"
			>
				{#if promptCopied}
					<svg
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2.5"
						><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg
					>
					Copied!
				{:else}
					<svg
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
						/></svg
					>
					Copy Prompt
				{/if}
			</button>
		</div>
	</div>

	{#if !hasPreview}
		<div class="space-y-4">
			<div>
				<label
					ondragenter={handleDragOver}
					ondragover={handleDragOver}
					ondragleave={handleDragLeave}
					ondrop={handleFileDrop}
					class="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors {isDragOver
						? 'border-primary-500 bg-primary-50'
						: 'border-gray-300 bg-white hover:border-primary-400 hover:bg-primary-50'}"
				>
					<div class="text-center">
						<p class="text-sm font-medium text-gray-600">Drop JSON files here or click to upload</p>
						<p class="mt-1 text-xs text-gray-400">.json files — select multiple to batch import</p>
					</div>
					<input type="file" accept=".json" multiple class="hidden" onchange={handleFileUpload} />
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
				onclick={handlePaste}
				disabled={!jsonInput.trim()}
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

		{#if pasteErrors.length > 0}
			<div class="rounded-lg border border-red-200 bg-red-50 p-4">
				<p class="mb-2 text-sm font-medium text-red-700">Validation errors:</p>
				<ul class="space-y-1">
					{#each pasteErrors as error}
						<li class="text-sm text-red-600">
							<span class="font-mono text-xs text-red-500">{error.path}</span>: {error.message}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	{:else if pastePreview}
		<!-- Single file / paste preview (existing UX) -->
		<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			<h2 class="text-lg font-semibold text-gray-900">Import Preview</h2>

			{#if pasteExistingTheme}
				<div
					class="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
				>
					<svg
						class="mt-0.5 h-5 w-5 shrink-0 text-amber-500"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/></svg
					>
					<div>
						<p class="text-sm font-medium text-amber-800">Will merge into existing theme</p>
						<p class="text-xs text-amber-600">
							A theme named "{pasteExistingTheme.title}" already exists. New chapters will be added
							to it.
						</p>
					</div>
				</div>
			{/if}

			<div class="mt-4 space-y-3">
				<div class="flex justify-between border-b border-gray-100 pb-2">
					<span class="text-sm text-gray-500">Theme</span>
					<span class="text-sm font-medium text-gray-900">{pastePreview.theme.title}</span>
				</div>
				<div class="flex justify-between border-b border-gray-100 pb-2">
					<span class="text-sm text-gray-500">Chapters</span>
					<span class="text-sm font-medium text-gray-900">{pastePreview.chapters.length}</span>
				</div>
				<div class="flex justify-between border-b border-gray-100 pb-2">
					<span class="text-sm text-gray-500">Total Questions</span>
					<span class="text-sm font-medium text-gray-900">{countQuestions(pastePreview)}</span>
				</div>
			</div>

			<div class="mt-4 space-y-2">
				{#each pastePreview.chapters as chapter}
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
					onclick={handleImportPaste}
					disabled={importing}
					class="flex-1 rounded-lg bg-primary-600 py-2.5 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
				>
					{importing
						? pasteExistingTheme
							? 'Merging...'
							: 'Importing...'
						: pasteExistingTheme
							? 'Merge into Existing Theme'
							: 'Import'}
				</button>
				<button
					onclick={clearAll}
					class="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
				>
					Cancel
				</button>
			</div>
		</div>
	{:else if fileEntries.length > 0}
		<!-- Multi-file batch preview -->
		<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			<div class="flex items-center justify-between">
				<h2 class="text-lg font-semibold text-gray-900">Batch Import Preview</h2>
				<span class="text-sm text-gray-500">{fileEntries.length} files</span>
			</div>

			{#if validFileEntries.length < fileEntries.length}
				<div class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
					<p class="text-sm font-medium text-amber-800">
						{fileEntries.length - validFileEntries.length} of {fileEntries.length} files have errors and
						will be skipped
					</p>
				</div>
			{/if}

			<div class="mt-4 space-y-3">
				{#each fileEntries as entry}
					<div
						class="rounded-lg border px-4 py-3 {entry.data
							? 'border-gray-200 bg-gray-50'
							: 'border-red-200 bg-red-50'}"
					>
						<div class="flex items-start justify-between">
							<div class="min-w-0 flex-1">
								<p class="text-sm font-medium {entry.data ? 'text-gray-900' : 'text-red-800'}">
									{entry.fileName}
								</p>
								{#if entry.data}
									<p class="mt-0.5 text-xs text-gray-500">
										{entry.data.theme.title} — {entry.data.chapters.length} chapters, {countQuestions(
											entry.data
										)} questions
									</p>
									{#if entry.existingTheme}
										<p class="mt-1 text-xs text-amber-600">
											⚠ Will merge into existing theme "{entry.existingTheme.title}"
										</p>
									{/if}
								{:else}
									<p class="mt-0.5 text-xs text-red-600">
										{entry.parseError ||
											(entry.errors.length > 0
												? `${entry.errors.length} validation error${entry.errors.length > 1 ? 's' : ''}`
												: 'Unknown error')}
									</p>
									{#if entry.errors.length > 0}
										<ul class="mt-1 space-y-0.5">
											{#each entry.errors.slice(0, 3) as error}
												<li class="text-xs text-red-500">
													<span class="font-mono">{error.path}</span>: {error.message}
												</li>
											{/each}
											{#if entry.errors.length > 3}
												<li class="text-xs text-red-400">... and {entry.errors.length - 3} more</li>
											{/if}
										</ul>
									{/if}
								{/if}
							</div>
							<div class="ml-3 shrink-0">
								{#if entry.data}
									<svg
										class="h-5 w-5 text-green-500"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2.5"
										><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg
									>
								{:else}
									<svg
										class="h-5 w-5 text-red-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
										><path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M6 18L18 6M6 6l12 12"
										/></svg
									>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>

			{#if parseError}
				<div class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
					<p class="text-sm font-medium text-red-700">{parseError}</p>
				</div>
			{/if}

			<div class="mt-6 flex gap-3">
				<button
					onclick={handleImportBatch}
					disabled={importing || validFileEntries.length === 0}
					class="flex-1 rounded-lg bg-primary-600 py-2.5 font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if importing}
						Importing...
					{:else if validFileEntries.length === 0}
						No Valid Files
					{:else}
						Import {validFileEntries.length} File{validFileEntries.length > 1 ? 's' : ''}
					{/if}
				</button>
				<button
					onclick={clearAll}
					disabled={importing}
					class="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}
</div>
