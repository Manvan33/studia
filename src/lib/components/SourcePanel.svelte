<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { sourceViewer, type SourceViewerRequest } from '$lib/sourceViewer';
	import { listSourceDocuments, getSourceDocument, normaliseForQuoteMatch } from '$lib/sources';
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

	// Last successful match target so the user can jump back any time.
	let pdfMatchPage: HTMLElement | null = null;
	let htmlMatchAnchorId: string | null = null;
	let hasMatch = $state(false);

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
		pdfMatchPage = null;
		htmlMatchAnchorId = null;
		hasMatch = false;
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
		let matchAnchor: string | null = null;
		if (quote && parsed.body) {
			matchAnchor = highlightInDom(parsed.body, quote);
		}
		if (matchAnchor) {
			htmlMatchAnchorId = matchAnchor;
			hasMatch = true;
		}

		iframeSrcDoc = '<!DOCTYPE html>' + parsed.documentElement.outerHTML;

		queueMicrotask(() => {
			const target = r?.locator?.anchor;
			if (iframeEl) {
				iframeEl.onload = () => {
					try {
						const doc2 = iframeEl?.contentDocument;
						if (!doc2) return;
						let el: Element | null = null;
						if (target) el = doc2.getElementById(target);
						if (!el && matchAnchor) el = doc2.getElementById(matchAnchor);
						if (!el) el = doc2.querySelector('mark.studia-hl');
						el?.scrollIntoView({ behavior: 'auto', block: 'center' });
					} catch {
						/* cross-origin shouldn't happen with srcdoc but guard anyway */
					}
				};
			}
		});
	}

	function highlightInDom(root: Element, quote: string): string | null {
		const target = normaliseForQuoteMatch(quote);
		if (!target) return null;
		const doc = root.ownerDocument!;
		const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
			acceptNode(node) {
				const p = node.parentElement;
				if (!p) return NodeFilter.FILTER_REJECT;
				const tag = p.tagName.toLowerCase();
				if (tag === 'script' || tag === 'style' || tag === 'noscript') {
					return NodeFilter.FILTER_REJECT;
				}
				return NodeFilter.FILTER_ACCEPT;
			}
		});

		// Build a flat character index across text nodes, mapping every
		// position in the normalised concatenated string back to (node, offset).
		const nodes: Text[] = [];
		const map: Array<{ nodeIndex: number; offset: number }> = [];
		let combined = '';
		let prevWasSpace = true; // collapse leading whitespace
		let n: Node | null;
		while ((n = walker.nextNode())) {
			const text = (n as Text).nodeValue ?? '';
			if (!text) continue;
			const idx = nodes.length;
			nodes.push(n as Text);
			for (let i = 0; i < text.length; i++) {
				const ch = text[i];
				const isSpace = /\s/.test(ch);
				if (isSpace) {
					if (prevWasSpace) continue;
					combined += ' ';
					map.push({ nodeIndex: idx, offset: i });
					prevWasSpace = true;
				} else {
					combined += ch.toLowerCase();
					map.push({ nodeIndex: idx, offset: i });
					prevWasSpace = false;
				}
			}
		}

		const start = combined.indexOf(target);
		if (start < 0) return null;
		const end = start + target.length - 1;
		const startMap = map[start];
		const endMap = map[end];
		if (!startMap || !endMap) return null;

		// Wrap text nodes in [startMap.nodeIndex .. endMap.nodeIndex], splitting
		// the boundary nodes so only the matched substring is highlighted.
		const anchorId = 'studia-hl-anchor';
		const startNode = nodes[startMap.nodeIndex];
		const endNode = nodes[endMap.nodeIndex];
		try {
			let firstMark: HTMLElement | null = null;
			for (let i = startMap.nodeIndex; i <= endMap.nodeIndex; i++) {
				const node = nodes[i];
				const len = (node.nodeValue ?? '').length;
				if (len === 0) continue;
				const from = node === startNode ? startMap.offset : 0;
				const to = node === endNode ? Math.min(endMap.offset + 1, len) : len;
				if (to <= from) continue;
				const text = node.nodeValue ?? '';
				const before = text.slice(0, from);
				const middle = text.slice(from, to);
				const after = text.slice(to);
				const parent = node.parentNode;
				if (!parent) continue;
				const mark = doc.createElement('mark');
				mark.className = 'studia-hl';
				mark.textContent = middle;
				if (!firstMark) {
					mark.id = anchorId;
					firstMark = mark;
				}
				if (before) parent.insertBefore(doc.createTextNode(before), node);
				parent.insertBefore(mark, node);
				if (after) parent.insertBefore(doc.createTextNode(after), node);
				parent.removeChild(node);
			}
			return firstMark ? anchorId : null;
		} catch {
			return null;
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
				const pageText = textContent.items.map((it) => ('str' in it ? it.str : '')).join(' ');

				if (targetPage === pageNum) {
					scrollTarget = pageDiv;
					pageDiv.style.outline = '3px solid #f59e0b';
					pageDiv.style.outlineOffset = '-3px';
				}
				if (
					!scrollTarget &&
					targetQuote &&
					normaliseForQuoteMatch(pageText).includes(targetQuote)
				) {
					scrollTarget = pageDiv;
					pageDiv.style.outline = '3px solid #f59e0b';
					pageDiv.style.outlineOffset = '-3px';
					const badge = document.createElement('div');
					badge.textContent = `Match on page ${pageNum}`;
					badge.style.cssText =
						'position:absolute;top:8px;right:8px;background:#f59e0b;color:#fff;font:600 11px system-ui,sans-serif;padding:2px 8px;border-radius:4px;pointer-events:none;';
					pageDiv.appendChild(badge);
				}
			}

			pdfStatus = '';
			if (scrollTarget) {
				pdfMatchPage = scrollTarget;
				hasMatch = true;
				scrollTarget.scrollIntoView({ behavior: 'auto', block: 'start' });
			}
		} catch (e) {
			pdfStatus = e instanceof Error ? e.message : 'Failed to render PDF';
		}
	}

	async function selectDocument(doc: SourceDocument) {
		await openDocument(doc, request);
	}

	function jumpToMatch() {
		if (activeDoc?.kind === 'pdf' && pdfMatchPage) {
			pdfMatchPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
			return;
		}
		if (activeDoc?.kind === 'html' && iframeEl?.contentDocument) {
			const doc2 = iframeEl.contentDocument;
			let el: Element | null = null;
			if (htmlMatchAnchorId) el = doc2.getElementById(htmlMatchAnchorId);
			if (!el) el = doc2.querySelector('mark.studia-hl');
			el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
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
			<button
				type="button"
				onclick={jumpToMatch}
				disabled={!hasMatch}
				class="flex w-full items-start gap-2 border-b border-yellow-200 bg-yellow-50 px-4 py-2 text-left transition-colors hover:bg-yellow-100 disabled:cursor-default disabled:hover:bg-yellow-50"
				title={hasMatch ? 'Jump to match' : 'No match found in this document'}
			>
				<div class="min-w-0 flex-1">
					<p class="text-xs font-medium tracking-wide text-yellow-700 uppercase">
						{hasMatch ? 'Looking for — click to jump' : 'Looking for (no match found)'}
					</p>
					<p class="mt-1 text-sm text-gray-800 italic">"{request.quote}"</p>
				</div>
				{#if hasMatch}
					<svg
						class="mt-0.5 h-4 w-4 shrink-0 text-yellow-700"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
					</svg>
				{/if}
			</button>
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
