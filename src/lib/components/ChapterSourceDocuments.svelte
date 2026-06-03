<script lang="ts">
	import {
		listSourceDocuments,
		addSourceDocument,
		deleteSourceDocument,
		renameSourceDocument
	} from '$lib/sources';
	import type { SourceDocument } from '$lib/types';

	interface Props {
		chapterId: string;
	}

	const { chapterId }: Props = $props();

	let docs = $state<SourceDocument[]>([]);
	let uploadError = $state('');
	let uploading = $state(false);
	let isDragOver = $state(false);
	let renamingId = $state<string | null>(null);
	let renameValue = $state('');

	$effect(() => {
		void chapterId;
		refresh();
	});

	async function refresh() {
		docs = await listSourceDocuments(chapterId);
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}

	async function handleFiles(files: FileList | null | undefined) {
		if (!files || files.length === 0) return;
		uploadError = '';
		uploading = true;
		try {
			for (const file of Array.from(files)) {
				await addSourceDocument(chapterId, file);
			}
			await refresh();
		} catch (e) {
			uploadError = e instanceof Error ? e.message : 'Upload failed';
		} finally {
			uploading = false;
		}
	}

	function onChange(event: Event) {
		const input = event.target as HTMLInputElement;
		void handleFiles(input.files);
		input.value = '';
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		isDragOver = false;
		void handleFiles(event.dataTransfer?.files);
	}

	function onDragOver(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
		isDragOver = true;
	}

	function onDragLeave(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		isDragOver = false;
	}

	async function remove(doc: SourceDocument) {
		if (!confirm(`Delete "${doc.title}"?`)) return;
		await deleteSourceDocument(doc.id);
		await refresh();
	}

	function startRename(doc: SourceDocument) {
		renamingId = doc.id;
		renameValue = doc.title;
	}

	async function commitRename(doc: SourceDocument) {
		try {
			await renameSourceDocument(doc.id, renameValue);
		} catch {
			// ignore
		}
		renamingId = null;
		await refresh();
	}
</script>

<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
	<h2 class="text-lg font-semibold text-gray-900">Study guide</h2>
	<p class="mt-1 text-sm text-gray-500">
		Attach the original PDF or HTML so source quotes can be verified during study.
	</p>

	<label
		ondragenter={onDragOver}
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
		class="mt-4 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors {isDragOver
			? 'border-primary-500 bg-primary-50'
			: 'border-gray-300 hover:border-primary-400 hover:bg-primary-50'}"
	>
		<div class="text-center">
			<p class="text-sm font-medium text-gray-600">
				{uploading ? 'Uploading…' : 'Drop a PDF or HTML file here, or click to upload'}
			</p>
			<p class="mt-1 text-xs text-gray-400">.pdf, .html — kept locally on this device</p>
		</div>
		<input
			type="file"
			accept=".pdf,.html,.htm,application/pdf,text/html"
			multiple
			class="hidden"
			onchange={onChange}
			disabled={uploading}
		/>
	</label>

	{#if uploadError}
		<div class="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
			{uploadError}
		</div>
	{/if}

	{#if docs.length > 0}
		<ul class="mt-4 space-y-2">
			{#each docs as doc}
				<li class="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
					<span
						class="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-gray-700 uppercase"
					>
						{doc.kind}
					</span>
					{#if renamingId === doc.id}
						<input
							bind:value={renameValue}
							class="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
							onkeydown={(e) => e.key === 'Enter' && commitRename(doc)}
						/>
						<button
							onclick={() => commitRename(doc)}
							class="text-sm text-primary-600 hover:text-primary-700">Save</button
						>
						<button
							onclick={() => (renamingId = null)}
							class="text-sm text-gray-500 hover:text-gray-700">Cancel</button
						>
					{:else}
						<span class="flex-1 truncate text-sm text-gray-900">{doc.title}</span>
						<span class="text-xs text-gray-500">{formatSize(doc.size)}</span>
						<button
							onclick={() => startRename(doc)}
							class="text-xs text-gray-500 hover:text-gray-700">Rename</button
						>
						<button
							onclick={() => remove(doc)}
							class="text-xs text-red-600 hover:text-red-700">Delete</button
						>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
