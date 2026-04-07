# Studia

A reverse-learning web app where you study by answering questions generated from study material, rather than reading it linearly. Built for certification prep and structured self-study.

## What it does

Import structured JSON study content (e.g. from an LLM processing a study guide) and use it to:

- Study chapter by chapter with fixed-order question flow
- Answer multiple choice and free text questions
- Review explanations after each answer
- Complete final chapter assessments
- Create custom sessions across chapters with filters (wrong-only, unanswered, final assessment)
- Track scores, mistakes, and progress over time
- Manage content (themes, chapters, topics, questions) via GUI

All data stays local in your browser via IndexedDB. No accounts, no server, no sync.

## Tech stack

- [SvelteKit](https://svelte.dev/) with Svelte 5 + TypeScript
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Dexie.js](https://dexie.org/) (IndexedDB wrapper)
- [Vite](https://vite.dev/)

## Getting started

```sh
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Import format

The app imports structured JSON at the theme level. Example:

```json
{
  "theme": {
    "title": "CWNA",
    "description": "Certified Wireless Network Administrator"
  },
  "chapters": [
    {
      "title": "Chapter 1",
      "order": 1,
      "topics": [
        {
          "title": "RF Basics",
          "order": 1,
          "questions": [
            {
              "type": "multiple_choice",
              "prompt": "What does RF stand for?",
              "choices": ["Radio Frequency", "Routing Function", "Random Frame"],
              "correctAnswer": "Radio Frequency",
              "explanation": "RF stands for Radio Frequency.",
              "order": 1
            },
            {
              "type": "free_text",
              "prompt": "Name the 2.4 GHz Wi-Fi standard for older WLANs.",
              "correctAnswer": "802.11b",
              "explanation": "802.11b operates in the 2.4 GHz band.",
              "order": 2
            }
          ]
        }
      ],
      "finalAssessment": [
        {
          "type": "multiple_choice",
          "prompt": "Which band is used by both 802.11b and 802.11g?",
          "choices": ["2.4 GHz", "5 GHz", "6 GHz"],
          "correctAnswer": "2.4 GHz",
          "explanation": "Both 802.11b and 802.11g use the 2.4 GHz band.",
          "order": 1
        }
      ]
    }
  ]
}
```

Paste JSON or upload a file on the Import page. The app validates before saving and shows clear error messages for invalid data.

## Screens

| Screen | Path | Description |
|--------|------|-------------|
| Dashboard | `/` | Progress stats, weak topics, recent sessions |
| Themes | `/themes` | Browse learning themes |
| Theme detail | `/themes/:id` | Chapters within a theme |
| Chapter detail | `/themes/:themeId/chapters/:id` | Topics and study start |
| Session player | `/study/:id` | Answer questions, see explanations |
| Custom session | `/study/setup` | Build a filtered session |
| History | `/history` | Past session list |
| Session detail | `/history/:id` | Score breakdown per topic/chapter |
| Import | `/import` | JSON import with preview |
| Manage | `/manage` | Content CRUD |

## Scripts

```sh
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run check        # TypeScript + Svelte type checking
npm run lint         # Prettier + ESLint
npm run format       # Auto-format
```

## Testing

E2E tests use Playwright (Chromium):

```sh
# Install browser (first time)
npx playwright install chromium

# Run tests (starts dev server automatically)
node e2e-test.mjs
```

42 tests covering import, study sessions, history, dashboard, content management, and mobile responsiveness.

## Project structure

```
src/
  lib/
    types.ts          # All entity type definitions
    db.ts             # Dexie database schema (7 tables)
    import.ts         # JSON validation and import logic
    evaluation.ts     # Answer evaluation (MCQ + free text)
    sessions.ts       # Session lifecycle (create, submit, complete)
    progress.ts       # Progress stats computation
  routes/
    +layout.svelte    # Root layout with responsive nav
    +page.svelte      # Dashboard
    themes/           # Theme browsing
    study/            # Session player + custom setup
    history/          # Session history
    import/           # JSON import
    manage/           # Content management CRUD
```

## Design decisions

- **Local-only**: All data in IndexedDB via Dexie. No backend.
- **Deterministic ordering**: Questions always appear in chapter > topic > question order.
- **Immutable sessions**: Completed session records cannot be edited.
- **Manual override**: Free text answers can be marked correct/incorrect by the user during the session.
- **Accessibility**: Correct/incorrect states use icons + text labels, not color alone. ARIA attributes throughout.

## License

Private project.
