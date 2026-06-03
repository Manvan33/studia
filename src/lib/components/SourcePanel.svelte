<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { sourceViewer, type SourceViewerRequest } from '$lib/sourceViewer';
	import {
		listSourceDocuments,
		getSourceDocument,
		normaliseForQuoteMatch
	} from '$lib/sources';
	import type { SourceDocument } from '$lib/types';

	let request = $state<SourceViewerRequest | null>(null);
	let documents = $state<SourceDocument[]>([]);
	let activeDoc = $state<SourceDocument | null>(null);
	let loading = $state(false);
	let errorMessage = $state('');

	// PDF state
	let pdfContainer: HTMLDivElement | null = $state(null);
	let pdfStatus = $state('');

	// HTML iframe state
	let iframeEl: HTMLIFrameElement | null = $state(null);
	let iframeSrcDoc = $state('');

	let panelOpen = $derived(request !== null);

	let unsubscribe = () => {};

	onMount(() => {
		unsubscribe = sourceViewer.subscribe((r) => {
			request = r;
			if (r) loadForRequest(r);
		});
	});

	onDestroy(() => unsubscribe());

	async function loadForRequest(r: SourceViewerRequest) {
		loading = true;
		errorMessage = '';
		try {
			documents = await listSourceDocuments(r.chapterId);
			let doc: SourceDocument | undefined;
			if (r.documentId) {
				doc = await getSourceDocument(r.documentId);
			}
			if (!doc) doc = documents[0];
			if (!doc) {
				activeDoc = null;
				return;
			}
			await openDocument(doc, r);
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Failed to open source document';
		} finally {
			loading = false;
		}
	}

	async function openDocument(doc: SourceDocument, r: SourceViewerRequest | null) {
		activeDoc = doc;
		if (doc.kind === 'pdf') {
			iframeSrcDoc = '';
			await renderPdf(doc, r);
		} else {
			pdfStatus = '';
			await renderHtml(doc, r);
		}
	}

	async function renderHtml(doc: SourceDocument, r: SourceViewerRequest | null) {
		const html = await doc.blob.text();
		const parser = new DOMParser();
		const parsed = parser.parseFromString(html, 'text/html');

		// Strip dangerous elements before rendering. The iframe sandbox below
		// disables script execution as a defence-in-depth, but this also
		// prevents any inline event handlers from being relevant.
		parsed
			.querySelectorAll('script, link[rel="import"], object, embed, iframe')
			.forEach((node) => node.remove());
		parsed.querySelectorAll('*').forEach((el) => {
			for (const attr of Array.from(el.attributes)) {
				if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
				if (attr.name === 'href' && attr.value.toLowerCase().startsWith('javascript:')) {
					el.removeAttribute('href');
				}
			}
		});

		// Inject CSP and helpers (highlight + scroll-to).
		const head = parsed.head ?? parsed.createElement('head');
		const csp = parsed.createElement('meta');
		csp.setAttribute('http-equiv', 'Content-Security-Policy');
		csp.setAttribute(
			'content',
			"default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:;"
		);
		head.prepend(csp);

		const style = parsed.createElement('style');
		style.textContent = `
			body { font-family: -apple-system, system-ui, sans-serif; padding: 12px; line-height: 1.5; color: #111; background: #fff; }
			mark.studia-hl { background: #fef08a; padding: 0 2px; border-radius: 2px; }
		`;
		head.appendChild(style);
		if (!parsed.head) parsed.documentElement.prepend(head);

		// Highlight quote in body text. We do this server-side (here) so the
		// iframe doesn't need to run scripts.
		const quote = r?.quote;
		if (quote && parsed.body) {
			highlightInDom(parsed.body, quote);
		}

		// Scroll to anchor on load via a one-shot inline script — but we run
		// with sandbox without allow-scripts, so instead we use the URL fragment.
		iframeSrcDoc = '<!DOCTYPE html>' + parsed.documentElement.outerHTML;

		// After iframe loads, navigate to the anchor or first highlight.
		queueMicrotask(() => {
			const target = r?.locator?.anchor;
			if (iframeEl) {
				iframeEl.onload = () => {
					try {
						const win = iframeEl?.contentWindow;
						const doc2 = iframeEl?.contentDocument;
						if (!win || !doc2) return;
						let el: Element | null = null;
						if (target) el = doc2.getElementById(target);
						if (!el) el = doc2.querySelector('mark.studia-hl');
						el?.scrollIntoView({ behavior: 'auto', block: 'center' });
					} catch {
						// cross-origin shouldn't happen with srcdoc but guard anyway
					}
				};
			}
		});
	}

	function highlightInDom(root: Element, quote: string): void {
		const target = normaliseForQuoteMatch(quote);
		if (!target) return;
		const walker = root.ownerDocument!.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		const nodes: Text[] = [];
		let n: Node | null;
		while ((n = walker.nextNode())) nodes.push(n as Text);

		// Sliding-window match across consecutive text nodes.
		for (let i = 0; i < nodes.length; i++) {
			let combined = '';
			for (let j = i; j < nodes.length && combined.length < target.length + 200; j++) {
				combined += nodes[j].nodeValue ?? '';
				if (normaliseForQuoteMatch(combined).includes(target)) {
					// Just wrap the first node fully and stop — good enough for v1.
					const tn = nodes[i];
					if (tn.parentNode) {
						const mark = tn.ownerDocument!.createElement('mark');
						mark.className = 'studia-hl';
						mark.textContent = tn.nodeValue ?? '';
						tn.parentNode.replaceChild(mark, tn);
					}
					return;
				}
			}
		}
	}

	async function renderPdf(doc: SourceDocument, r: SourceViewerRequest | null) {
		pdfStatus = 'Loading PDF…';
		try {
			const pdfjs = await import('pdfjs-dist');
			// Pin worker; bundled by Vite via ?url import.
			const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
			pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

			const buf = await doc.blob.arrayBuffer();
			const loadingTask = pdfjs.getDocument({
				data: buf,
				isEvalSupported: false,
				disableAutoFetch: true,
				disableStream: true
			});
			const pdf = await loadingTask.promise;

			if (!pdfContainer) return;
			pdfContainer.innerHTML = '';

			const targetPage = r?.locator?.page;
			const targetQuote = r?.quote ? normaliseForQuoteMatch(r.quote) : '';
			let scrollTarget: HTMLElement | null = null;

			for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
				const page = await pdf.getPage(pageNum);
				const viewport = page.getViewport({ scale: 1.2 });

				const pageDiv = document.createElement('div');
				pageDiv.className = 'studia-pdf-page';
				pageDiv.style.position = 'relative';
				pageDiv.style.margin = '0 auto 12px';
				pageDiv.style.width = `${viewport.width}px`;
				pageDiv.style.height = `${viewport.height}px`;
				pageDiv.dataset.page = String(pageNum);

				const canvas = document.createElement('canvas');
				canvas.width = viewport.width;
				canvas.height = viewport.height;
				canvas.style.display = 'block';
				const ctx = canvas.getContext('2d');
				pageDiv.appendChild(canvas);

				const textLayer = document.createElement('div');
				textLayer.className = 'studia-pdf-textlayer';
				pageDiv.appendChild(textLayer);

				pdfContainer.appendChild(pageDiv);

				if (ctx) {
					await page.render({ canvasContext: ctx, viewport }).promise;
				}

				const textContent = await page.getTextContent();
				const pageText = textContent.items
					.map((it) => ('str' in it ? it.str : ''))
					.join(' ');

				if (targetPage === pageNum) {
					scrollTarget = pageDiv;
				}
				if (
					!scrollTarget &&
					targetQuote &&
					normaliseForQuoteMatch(pageText).includes(targetQuote)
				) {
					scrollTarget = pageDiv;
					pageDiv.style.outline = '2px solid #facc15';
				}
			}

			pdfStatus = '';
			if (scrollTarget) {
				scrollTarget.scrollIntoView({ behavior: 'auto', block: 'start' });
			}
		} catch (e) {
			pdfStatus = e instanceof Error ? e.message : 'Failed to render PDF';
		}
	}

	async function selectDocument(doc: SourceDocument) {
		await openDocument(doc, request);
	}

	function close() {
		sourceViewer.close();
	}
</script>

{#if panelOpen}
	<aside
		class="fixed top-0 right-0 z-50 flex h-full w-full max-w-[600px] flex-col border-l border-gray-200 bg-white shadow-xl md:w-[45vw]"
		aria-label="Study guide panel"
	>
		<header class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-semibold text-gray-900">
					{activeDoc?.title ?? 'Study guide'}
				</p>
				{#if request?.locator?.section}
					<p class="truncate text-xs text-gray-500">{request.locator.section}</p>
				{/if}
			</div>
			<button
				onclick={close}
				class="ml-3 rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
				aria-label="Close source panel"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</header>

		{#if documents.length > 1}
			<div class="flex gap-1 overflow-x-auto border-b border-gray-100 bg-gray-50 px-2 py-1">
				{#each documents as doc}
					<button
						onclick={() => selectDocument(doc)}
						class="rounded px-2 py-1 text-xs whitespace-nowrap {activeDoc?.id === doc.id
							? 'bg-primary-100 text-primary-700'
							: 'text-gray-600 hover:bg-gray-100'}"
					>
						{doc.title}
					</button>
				{/each}
			</div>
		{/if}

		{#if request?.quote}
			<div class="border-b border-gray-100 bg-yellow-50 px-4 py-2">
				<p class="text-xs font-medium tracking-wide text-yellow-700 uppercase">Looking for</p>
				<p class="mt-1 text-sm text-gray-800 italic">"{request.quote}"</p>
			</div>
		{/if}

		<div class="flex-1 overflow-auto bg-gray-100">
			{#if loading}
				<p class="p-6 text-center text-sm text-gray-500">Loading…</p>
			{:else if errorMessage}
				<p class="p-6 text-center text-sm text-red-600">{errorMessage}</p>
			{:else if !activeDoc}
				<div class="p-6 text-center text-sm text-gray-500">
					<p>No study guide is attached to this chapter.</p>
					<p class="mt-2 text-xs">Attach one in Manage → Chapter → Study guide.</p>
				</div>
			{:else if activeDoc.kind === 'pdf'}
				{#if pdfStatus}
					<p class="p-6 text-center text-sm text-gray-500">{pdfStatus}</p>
				{/if}
				<div bind:this={pdfContainer} class="py-2"></div>
			{:else}
				<iframe
					bind:this={iframeEl}
					title="Study guide HTML"
					sandbox="allow-same-origin"
					srcdoc={iframeSrcDoc}
					class="h-full w-full border-0 bg-white"
				></iframe>
			{/if}
		</div>
	</aside>
{/if}

<style>
	:global(.studia-pdf-page) {
		background: white;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}
</style>
