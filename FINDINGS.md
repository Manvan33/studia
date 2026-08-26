# Findings

Technical findings, problems encountered, and solutions during development.

## PDF.js v4 in SvelteKit / Vite

**Problem**: `pdfjs-dist` v4 ships ES modules and a separate worker. Using it without configuring the worker URL causes "Setting up fake worker failed" errors.

**Solution**: Lazy-import on demand and resolve the worker through Vite's `?url` suffix:

```ts
const pdfjs = await import('pdfjs-dist');
const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
```

Pass `isEvalSupported: false`, `disableAutoFetch: true`, `disableStream: true` to `getDocument()` for security & predictable behaviour with in-memory blobs. Note: in v4 `page.render()` no longer accepts a `canvas` field — pass only `canvasContext` and `viewport`.

## Sandboxing Untrusted HTML Study Guides

**Problem**: User-uploaded HTML guides may contain scripts, inline event handlers, or external resource loads. Rendering directly in the DOM is unsafe.

**Solution**: Render in an `<iframe srcdoc>` with `sandbox="allow-same-origin"` (no `allow-scripts`). Before injection, parse the HTML inertly with `DOMParser`, strip `<script>`/`<iframe>`/`<object>`/`<embed>`, remove all `on*` attributes, and prepend a restrictive CSP `<meta>` tag (`default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'`). Highlights are inserted server-side (in our parsed DOM) so the iframe needs no scripting.

## Dexie liveQuery Observable Typing

**Problem**: Dexie's `liveQuery()` returns an Observable, but when subscribing with a callback directly like `.subscribe((v) => ...)`, TypeScript infers `v` as `unknown` in some contexts.

**Solution**: Use the object form of subscribe: `.subscribe({ next: (v) => ... })` which properly infers types. Alternatively, explicitly type the state variable that receives the value (e.g., `let themes = $state<LearningTheme[]>([])`).

## SvelteKit page.params Type Safety

**Problem**: `page.params.xxx` from `$app/state` returns `string | undefined` in TypeScript, but route params from dynamic segments like `[themeId]` are always strings at runtime. Dexie methods like `.get()` and `.equals()` require `string`, not `string | undefined`.

**Solution**: Use nullish coalescing: `const themeId = $derived(page.params.themeId ?? '')`. Empty string is safe because Dexie will simply return `undefined` for a non-existent key, which we handle with "not found" UI.

## Svelte 5 Runes + Dexie Reactivity

**Problem**: Svelte 5 uses runes ($state, $derived, $effect) instead of stores. Dexie's `liveQuery` returns an RxJS-compatible Observable, not a Svelte store.

**Solution**: Use `$effect` to subscribe to Dexie observables and write results into `$state` variables. Return the unsubscribe function from `$effect` for cleanup. This gives full reactivity while keeping the Svelte 5 runes pattern.

## Tailwind CSS 4 Theme Configuration

**Problem**: Tailwind CSS 4 uses `@theme` directive instead of `tailwind.config.js` for custom theme values.

**Solution**: Define custom colors with `@theme { --color-primary-500: #3b82f6; }` in the layout CSS file. Reference as standard Tailwind classes like `text-primary-700`, `bg-primary-600`.

## Svelte 5 $state Proxy + IndexedDB DataCloneError

**Problem**: When data stored in Svelte 5 `$state` variables is passed to Dexie/IndexedDB write operations (`add`, `bulkAdd`, `put`), IndexedDB throws `DataCloneError: [object Array] could not be cloned`. This is because Svelte 5 wraps `$state` values in deep reactive Proxy objects, and IndexedDB's structured clone algorithm cannot serialize Proxy objects.

**Thought process**: The import flow appeared to work (validation passed, preview displayed correctly) but clicking "Import" had no visible effect — no navigation, no error message. Adding console.log to the handler revealed the function was called and passed the guard, but `importData()` threw a DexieError. The error message `DataCloneError` pointed to the structured clone issue with proxied arrays (like `choices` on MCQ questions).

**Solution**: Use `$state.snapshot()` to unwrap the reactive proxy before passing data to Dexie:

```typescript
const rawPreview = $state.snapshot(preview);
const { themeId } = await importData(rawPreview);
```

For simpler cases (e.g., a `$state` array being passed to `db.add()`), spreading the array (`[...proxyArray]`) also works. This applies anywhere `$state` data flows into IndexedDB write operations.

## Performance Optimization
When running a local Node-based benchmark on code that transforms large arrays (e.g. 5000 items), building an explicit `Map` mapping ID to the object natively speeds up iterative inner loop lookups. The optimization was measured with an ad-hoc local script and resulted in a 53x improvement vs the `Array.prototype.find` approach. Wait to use global formatter runs to prevent out-of-scope styling diffs.
