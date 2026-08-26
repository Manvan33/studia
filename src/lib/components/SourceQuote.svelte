<script lang="ts">
	import { sourceViewer } from '$lib/sourceViewer';
	import { listSourceDocuments } from '$lib/sources';
	import type { SourceRef } from '$lib/types';

	interface Props {
		chapterId: string;
		sourceRef: SourceRef;
	}

	const { chapterId, sourceRef }: Props = $props();

	let hasDoc = $state(false);

	$effect(() => {
		listSourceDocuments(chapterId).then((docs) => {
			hasDoc = docs.length > 0;
		});
	});

	function open() {
		sourceViewer.show({
			chapterId,
			locator: sourceRef.locator,
			quote: sourceRef.quote
		});
	}

	const locatorLabel = $derived(formatLocator(sourceRef));

	function formatLocator(ref: SourceRef): string {
		const parts: string[] = [];
		if (ref.locator?.page) parts.push(`p. ${ref.locator.page}`);
		if (ref.locator?.section) parts.push(ref.locator.section);
		else if (ref.locator?.anchor) parts.push(`#${ref.locator.anchor}`);
		return parts.join(' · ');
	}
</script>

<div class="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			<p class="text-xs font-medium tracking-wide text-yellow-700 uppercase">
				From the study guide
			</p>
			<blockquote class="mt-1 border-l-2 border-yellow-300 pl-3 text-sm text-gray-800 italic">
				"{sourceRef.quote}"
			</blockquote>
			{#if locatorLabel}
				<p class="mt-1 text-xs text-gray-500">{locatorLabel}</p>
			{/if}
		</div>
		{#if hasDoc}
			<button
				onclick={open}
				class="shrink-0 rounded-md border border-yellow-300 bg-white px-2.5 py-1 text-xs font-medium text-yellow-800 hover:bg-yellow-100"
			>
				Open
			</button>
		{/if}
	</div>
</div>
