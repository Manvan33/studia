# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
