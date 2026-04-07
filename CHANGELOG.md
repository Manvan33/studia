# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Optional `context` field on questions: markdown-formatted background information displayed before the question prompt
- Markdown rendering for question explanations using `marked` library with Tailwind Typography (`prose`) styling
- Markdown rendering for question context in study player and history detail views
- Context textarea in topic question form (content management)
- Explanation and context displayed in history detail per question (previously only showed answer)
- `src/lib/markdown.ts` utility: `renderMarkdown()` with basic XSS sanitization
- LLM prompt template updated with `context` field and detailed markdown explanation instructions
- "Copy Prompt" button on Import page: one-click copy of the LLM prompt template to clipboard

### Changed
- Explanation label in question form now hints at markdown support
- PROMPT.md content rules updated: explanations must be detailed and markdown-formatted, context field documented

### Added
- Initial SvelteKit project with Svelte 5, TypeScript, Tailwind CSS 4, Prettier, ESLint
- Dexie.js (IndexedDB) database with full data model: themes, chapters, topics, questions, sessions, answers, question progress
- Core type definitions matching SPECS.md entities
- JSON import system with comprehensive validation (theme, chapter, topic, question level)
- Import UI with file upload, paste area, preview, and error display
- Study session player with multiple choice and free text question types
- Answer evaluation: exact match for MCQ, normalized case-insensitive comparison for free text
- Manual override for free text answer results
- Session scoring with per-topic and per-chapter breakdowns
- Session completion flow with summary statistics
- Session history list and detail views
- Dashboard with theme count, question count, recent sessions
- Theme list and detail pages with chapter navigation
- Chapter detail page with topic listing and study start
- Custom study session builder: select themes, chapters, topics, filters (wrong-only, unanswered, final assessment)
- Content management UI: CRUD for themes, chapters, topics, questions
- Responsive layout with mobile hamburger navigation
- Progress bar during study sessions
- Explanation display after each answer submission
- Progress dashboard with stat cards, theme overview, recent sessions, chapter progress bars
- Weak topics/chapters identification and display
- Frequently missed questions tracking
- Final assessment performance by chapter
- Per-question progress tracking (times seen, correct, incorrect, last answered)
- Chapter JSON editor: export chapter as JSON, edit in textarea, validate, and apply changes in place (`/manage/chapters/:id/json`)
- Import page and chapter JSON editor accept full LLM output with ```json code fences (auto-extracts JSON)
- LLM prompt template (`PROMPT.md`) for generating study content with two-phase thinking + JSON output
- "Edit as JSON" link on chapter manage page
- Copy to clipboard button on chapter JSON editor
- README with project overview, import format, screen listing, and setup instructions

### Improved
- Accessibility: correct/incorrect/skipped states now use SVG icons + text labels alongside color
- Accessibility: MCQ choices remain visible after submission with visual markers for correct/wrong answers
- Accessibility: aria-live region for answer feedback, ARIA roles for radiogroup choices, sr-only labels
- Accessibility: progress bar uses proper progressbar role with aria attributes
- Final assessment questions visually distinct: amber border, tinted background, labeled header in session player
- Final assessment badge with icon shown in history detail view per question
- History summary cards use SVG icons for correct/incorrect/skipped counts
- Session type labels capitalized in history list (Chapter, Custom, Review, Final)
- Manage page shows empty state with import link when no themes exist

### Fixed
- Critical: JSON import failing silently due to Svelte 5 `$state` proxy objects not being serializable to IndexedDB (DataCloneError). Fixed by using `$state.snapshot()` to unwrap reactive proxies before passing data to Dexie write operations.
- Preventive fix: spread `$state` arrays in content management question form to avoid same proxy serialization issue

### Added (Testing)
- End-to-end test suite (`e2e-test.mjs`) using Playwright with 42 tests covering: empty states, import flow, theme/chapter navigation, study session (MCQ + free text + final assessment), session completion, history, dashboard stats, custom session setup, content management, and mobile responsiveness
