# Findings

Technical findings, problems encountered, and solutions during development.

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

## Efficient Sorting with Related Data

**Problem**: Sorting a large list of objects (e.g., Questions) based on a property of a related object (e.g., Topic order) can become $O(N \cdot M)$ if the lookup is performed inside the sort comparator using `.find()` or a database query.

**Solution**: Pre-map the related data into a `Map` or lookup object before starting the sort. This reduces the lookup time to $O(1)$ on average, bringing the total sorting complexity down to $O(N \log N + M)$, where $N$ is the number of items to sort and $M$ is the number of related items.

## Eliminating N+1 Queries in IndexedDB

**Problem**: Performing database queries inside a loop (N+1 query problem) is a common performance bottleneck, especially in client-side databases like IndexedDB where each query has overhead.

**Solution**: Use bulk fetching methods like Dexie's `.anyOf()` to retrieve all required data in a single query outside the loop. Use in-memory grouping (e.g., a `Map<chapterId, items[]>`) to provide efficient access to the pre-fetched data within the loop.
