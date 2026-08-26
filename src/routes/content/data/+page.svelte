<script lang="ts">
	let { embedded = false } = $props();

	import { base } from '$app/paths';
	import { db } from '$lib/db';
	import { exportDatabase, validateDatabaseBackup, importDatabase } from '$lib/import';
	import type { DatabaseBackup, ValidationError } from '$lib/types';

	let includeSessions = $state(true);
	let includeSourceDocuments = $state(false);
	let exporting = $state(false);

	let importMode = $state<'idle' | 'preview' | 'importing' | 'done'>('idle');
	let importFile = $state<DatabaseBackup | null>(null);
	let importFileName = $state('');
	let importErrors = $state<ValidationError[]>([]);
	let importParseError = $state('');
	let clearExisting = $state(true);
	let isDragOver = $state(false);

	let counts = $state({ themes: 0, chapters: 0, questions: 0, sessions: 0 });

	$effect(() => {
		const sub1 = db.themes.count().then((n) => (counts.themes = n));
		const sub2 = db.chapters.count().then((n) => (counts.chapters = n));
		const sub3 = db.questions.count().then((n) => (counts.questions = n));
		const sub4 = db.sessions.count().then((n) => (counts.sessions = n));
		void sub1;
		void sub2;
		void sub3;
		void sub4;
	});

	async function handleExport() {
		exporting = true;
		try {
			const backup = await exportDatabase(includeSessions, includeSourceDocuments);
			const json = JSON.stringify(backup, null, 2);
			const blob = new Blob([json], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			const date = new Date().toISOString().slice(0, 10);
			a.href = url;
			a.download = `studia-backup-${date}${includeSessions ? '' : '-no-sessions'}.json`;
			a.click();
			URL.revokeObjectURL(url);
		} finally {
			exporting = false;
		}
	}

	function readFileAsText(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => resolve((e.target?.result as string) ?? '');
			reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
			reader.readAsText(file);
		});
	}

	async function processBackupFile(file: File) {
		importErrors = [];
		importParseError = '';
		importFile = null;
		importFileName = file.name;

		const text = await readFileAsText(file);

		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			importParseError = 'Invalid JSON file';
			return;
		}

		const result = validateDatabaseBackup(parsed);
		if (!result.valid) {
			importErrors = result.errors;
			return;
		}

		importFile = parsed as DatabaseBackup;
		importMode = 'preview';
	}

	async function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = input.files;
		if (!files || files.length === 0) return;
		await processBackupFile(files[0]);
		input.value = '';
	}

	async function handleFileDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		isDragOver = false;

		const files = event.dataTransfer?.files;
		if (!files || files.length === 0) return;
		await processBackupFile(files[0]);
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
		isDragOver = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		isDragOver = false;
	}

	async function handleImport() {
		if (!importFile) return;
		importMode = 'importing';
		try {
			await importDatabase($state.snapshot(importFile), clearExisting);
			importMode = 'done';
			const [t, c, q, s] = await Promise.all([
				db.themes.count(),
				db.chapters.count(),
				db.questions.count(),
				db.sessions.count()
			]);
			counts = { themes: t, chapters: c, questions: q, sessions: s };
		} catch (e: unknown) {
			importParseError = e instanceof Error ? e.message : 'Import failed';
			importMode = 'preview';
		}
	}

	function resetImport() {
		importMode = 'idle';
		importFile = null;
		importFileName = '';
		importErrors = [];
		importParseError = '';
		clearExisting = true;
	}
</script>

<svelte:window on:dragover|preventDefault on:drop|preventDefault />

<div class="mx-auto max-w-2xl space-y-8">
	{#if !embedded}
		<div>
		<div class="flex items-center gap-2">
			<a href="{base}/content" class="text-sm text-gray-500 hover:text-gray-700">&larr; Content</a>
		</div>
		<h1 class="mt-2 text-2xl font-bold text-gray-900">Database Backup</h1>
		<p class="mt-1 text-sm text-gray-500">Export or restore your entire Studia database</p>
		</div>
	{/if}

	<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
		<h2 class="text-lg font-semibold text-gray-900">Export</h2>
		<p class="mt-1 text-sm text-gray-500">Download a full backup of your data as JSON</p>

		<div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
			<div class="rounded-lg bg-gray-50 px-3 py-2 text-center">
				<p class="text-lg font-semibold text-gray-900">{counts.themes}</p>
				<p class="text-xs text-gray-500">Themes</p>
			</div>
			<div class="rounded-lg bg-gray-50 px-3 py-2 text-center">
				<p class="text-lg font-semibold text-gray-900">{counts.chapters}</p>
				<p class="text-xs text-gray-500">Chapters</p>
			</div>
			<div class="rounded-lg bg-gray-50 px-3 py-2 text-center">
				<p class="text-lg font-semibold text-gray-900">{counts.questions}</p>
				<p class="text-xs text-gray-500">Questions</p>
			</div>
			<div class="rounded-lg bg-gray-50 px-3 py-2 text-center">
				<p class="text-lg font-semibold text-gray-900">{counts.sessions}</p>
				<p class="text-xs text-gray-500">Sessions</p>
			</div>
		</div>

		<label class="mt-4 flex cursor-pointer items-center gap-3">
			<input
				type="checkbox"
				bind:checked={includeSessions}
				class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
			/>
			<div>
				<span class="text-sm font-medium text-gray-900">Include study sessions</span>
				<p class="text-xs text-gray-500">Session history, answers, and per-question progress</p>
			</div>
		</label>

		<label class="mt-3 flex cursor-pointer items-center gap-3">
			<input
				type="checkbox"
				bind:checked={includeSourceDocuments}
				class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
			/>
			<div>
				<span class="text-sm font-medium text-gray-900">Include study guide files</span>
				<p class="text-xs text-gray-500">
					Embeds attached PDF/HTML guides as base64 — makes the backup much larger.
				</p>
			</div>
		</label>

		<button
			onclick={handleExport}
			disabled={exporting || counts.themes === 0}
			class="mt-4 w-full rounded-lg bg-primary-600 py-2.5 font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{exporting ? 'Exporting...' : 'Download Backup'}
		</button>
	</div>

	<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
		<h2 class="text-lg font-semibold text-gray-900">Import</h2>
		<p class="mt-1 text-sm text-gray-500">Restore from a previously exported backup file</p>

		{#if importMode === 'idle'}
			<label
				ondragenter={handleDragOver}
				ondragover={handleDragOver}
				ondragleave={handleDragLeave}
				ondrop={handleFileDrop}
				class="mt-4 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors {isDragOver
					? 'border-primary-500 bg-primary-50'
					: 'border-gray-300 hover:border-primary-400 hover:bg-primary-50'}"
			>
				<div class="text-center">
					<p class="text-sm font-medium text-gray-600">Drop backup file here or click to upload</p>
					<p class="mt-1 text-xs text-gray-400">.json file exported from Studia</p>
				</div>
				<input type="file" accept=".json" class="hidden" onchange={handleFileUpload} />
			</label>

			{#if importParseError}
				<div class="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
					<p class="text-sm font-medium text-red-700">{importParseError}</p>
				</div>
			{/if}

			{#if importErrors.length > 0}
				<div class="mt-3 rounded-lg border border-red-200 bg-red-50 p-4">
					<p class="mb-2 text-sm font-medium text-red-700">Invalid backup file:</p>
					<ul class="space-y-1">
						{#each importErrors as error}
							<li class="text-sm text-red-600">
								<span class="font-mono text-xs text-red-500">{error.path}</span>: {error.message}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{:else if importMode === 'preview' && importFile}
			<div class="mt-4 space-y-4">
				<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
					<p class="text-sm font-medium text-gray-900">{importFileName}</p>
					<p class="mt-1 text-xs text-gray-500">
						Exported {new Date(importFile.exportedAt).toLocaleString()}
					</p>

					<div class="mt-3 grid grid-cols-2 gap-2 text-sm">
						<div class="flex justify-between">
							<span class="text-gray-500">Themes</span>
							<span class="font-medium">{importFile.data.themes.length}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-500">Chapters</span>
							<span class="font-medium">{importFile.data.chapters.length}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-500">Questions</span>
							<span class="font-medium">{importFile.data.questions.length}</span>
						</div>
						{#if importFile.includesSessions}
							<div class="flex justify-between">
								<span class="text-gray-500">Sessions</span>
								<span class="font-medium">{importFile.data.sessions?.length ?? 0}</span>
							</div>
						{:else}
							<div class="flex justify-between">
								<span class="text-gray-500">Sessions</span>
								<span class="text-gray-400">not included</span>
							</div>
						{/if}
					</div>
				</div>

				<label class="flex cursor-pointer items-center gap-3">
					<input
						type="checkbox"
						bind:checked={clearExisting}
						class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
					/>
					<div>
						<span class="text-sm font-medium text-gray-900">Replace existing data</span>
						<p class="text-xs text-gray-500">
							Clear all current data before importing. Uncheck to merge.
						</p>
					</div>
				</label>

				{#if clearExisting}
					<div
						class="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
					>
						<svg
							class="mt-0.5 h-5 w-5 shrink-0 text-amber-500"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
						<p class="text-sm text-amber-800">
							This will delete all existing data before importing. Make sure you have a backup.
						</p>
					</div>
				{/if}

				{#if importParseError}
					<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
						<p class="text-sm font-medium text-red-700">{importParseError}</p>
					</div>
				{/if}

				<div class="flex gap-3">
					<button
						onclick={handleImport}
						class="flex-1 rounded-lg bg-primary-600 py-2.5 font-medium text-white hover:bg-primary-700"
					>
						{clearExisting ? 'Replace & Import' : 'Merge Import'}
					</button>
					<button
						onclick={resetImport}
						class="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
					>
						Cancel
					</button>
				</div>
			</div>
		{:else if importMode === 'importing'}
			<div class="mt-4 flex items-center justify-center py-8">
				<p class="text-sm font-medium text-gray-600">Importing...</p>
			</div>
		{:else if importMode === 'done'}
			<div class="mt-4 space-y-4">
				<div
					class="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3"
				>
					<svg
						class="mt-0.5 h-5 w-5 shrink-0 text-green-500"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2.5"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
					<p class="text-sm font-medium text-green-800">Backup restored successfully</p>
				</div>
				<div class="flex gap-3">
					<a
						href="{base}/"
						class="flex-1 rounded-lg bg-primary-600 py-2.5 text-center font-medium text-white hover:bg-primary-700"
					>
						Go to Dashboard
					</a>
					<button
						onclick={resetImport}
						class="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
					>
						Import Another
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
