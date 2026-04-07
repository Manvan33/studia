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
