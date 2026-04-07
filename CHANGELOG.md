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
