# SPECS.md

## 1. Overview

A responsive Svelte web app for reverse-learning, where users study by answering questions generated from study material instead of reading it linearly. Content is organized into learning themes, chapters, topics, and questions. The app supports chapter-based learning, custom study sessions, progress tracking, and local session history.

V1 is a **single-user, local-only** application.

## 2. Goals

- Make study material interactive and question-driven
- Support structured chapter-by-chapter learning
- Support custom sessions across chapters
- Track scores, mistakes, and progress over time
- Provide a simple GUI to add learning themes and chapters
- Work well on desktop and mobile
- Optionally support PWA install/offline behavior

## 3. Primary Use Case

A user studies for a certification such as **CWNA** using an HTML study guide that has already been processed by an external LLM into structured JSON containing:

- chapters
- topics
- questions
- answers
- explanations
- final chapter assessment questions

The app is then used to:

- study topic by topic
- answer questions
- review explanations
- complete final chapter assessments
- review wrong answers
- create mixed custom sessions
- view study history and performance stats

## 4. Core Entities

### Learning Theme

A broad subject area.

- id
- title
- description optional

Example:

- CWNA

### Chapter

A chapter within a learning theme.

- id
- themeId
- title
- description optional
- order

### Topic

A section within a chapter.

- id
- chapterId
- title
- description optional
- order

### Question

A study item within a topic or chapter final assessment.

- id
- chapterId
- topicId optional for final assessment questions
- type: `multiple_choice | free_text | multiple_select`
- prompt
- choices optional
- correctAnswer
- correctAnswers optional — for multiple_select questions (array of correct choices)
- explanation
- order
- tags optional
- difficulty optional
- isFinalAssessment boolean

### Study Session

A generated run of questions for the user.

- id
- type: `chapter | custom | wrong_only | final_assessment`
- themeIds
- chapterIds
- topicIds optional
- createdAt
- startedAt
- completedAt
- questionIds
- scoring summary

### Session Answer

A stored answer for one question during a session.

- questionId
- userAnswer
- autoMatchedResult
- manuallyOverriddenResult optional
- finalResult
- skipped
- answeredAt

## 5. Content Import Format

V1 import format is **JSON**.

The external LLM should output structured JSON that can be imported into the app. JSON is preferred because it is:

- deterministic
- easy to validate
- easy to parse
- suitable for bulk import and future schema evolution

### Import Requirements

- import at theme level or chapter level
- preserve chapter/topic/question ordering
- support both topic questions and final assessment questions
- reject invalid or incomplete records with clear validation errors

### Example JSON Shape

```json
{
	"theme": {
		"title": "CWNA",
		"description": "Certified Wireless Network Administrator study content"
	},
	"chapters": [
		{
			"title": "Chapter 1",
			"description": "Wireless fundamentals",
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
							"prompt": "Name the 2.4 GHz Wi-Fi band standard commonly associated with older WLANs.",
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
					"prompt": "Which band is commonly used by both 802.11b and 802.11g?",
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

## 6. Study Modes

### 6.1 Chapter Study

- User selects a theme, then a chapter
- Questions are presented in **fixed order**
- Flow follows chapter structure:
  - topic 1 questions
  - topic 2 questions
  - ...
  - final assessment questions
- Explanations shown after answer submission
- End-of-session summary shown after chapter completion

### 6.2 Custom Study Session

User can create a session from:

- one or more chapters
- selected topics
- wrong questions only
- unanswered questions only
- final assessment only

Rules:

- question order remains **fixed** based on chapter/topic/question order
- when multiple chapters are selected, ordering should follow:
  1. chapter order
  2. topic order
  3. question order

### 6.3 Wrong-Answer Review

- Build a session from previously incorrect questions
- Keep original ordering when possible
- Allow user to retry missed questions with updated scoring for the new session
- Historical results remain unchanged

## 7. Answer Evaluation

### Multiple Choice

- exact selected choice matching
- result determined immediately

### Free Text

- auto-matched against expected answer
- initial V1 logic may use:
  - normalized case-insensitive comparison
  - whitespace trimming
  - optional accepted variants in future versions

### Manual Override

For free-text answers, the UI must allow the user to override the automatic result:

- mark as correct
- mark as incorrect

Stored values:

- auto-matched result
- manual override result if used
- final result used for scoring

## 8. Scoring & Results

- Correct answer = earns score
- Incorrect answer = no score in V1
- Skipped answers tracked separately
- Explanations are always available after submission
- Session summary includes:
  - total questions
  - correct
  - incorrect
  - skipped
  - score percentage
  - per-topic breakdown
  - per-chapter breakdown
  - duration

## 9. Session History

The app stores every completed study session locally.

Each history entry includes:

- date/time
- session type
- included theme/chapter/topic scope
- number of questions
- score
- duration
- answer breakdown

Rules:

- session results are **not editable retrospectively**
- manual overrides only apply during the active session before completion
- historical records remain immutable once stored

## 10. Progress Tracking

Dashboard and progress views should show:

- total sessions completed
- average score
- recent sessions
- weak topics
- weak chapters
- frequently missed questions
- chapter completion status
- final assessment performance by chapter

Per-question tracking:

- times seen
- times correct
- times incorrect
- last answered date

## 11. Content Management

The GUI must allow easy creation and editing of:

### Learning Themes

- add new theme
- edit title/description
- delete theme with confirmation

### Chapters

- add chapter to a theme
- edit chapter metadata
- define chapter order

### Topics

- add topic to chapter
- edit topic metadata
- define topic order

### Questions

- add/edit/delete question
- select type
- define prompt
- define choices for MCQ
- define expected answer for free text
- define explanation
- define order
- mark as final assessment if applicable

### Import UX

- import JSON via paste area or file upload
- validate before saving
- show import preview
- show validation errors clearly
- allow merge or new import behavior later; for V1, simple append/import is acceptable

## 12. UI / UX Requirements

- Built with **Svelte**
- Responsive, mobile-first layout
- Designed for frequent question answering on small screens
- Minimal, clean interface
- Fast transitions between:
  - dashboard
  - themes
  - chapters
  - session setup
  - study player
  - session summary
  - history
  - content management

Accessibility requirements:

- readable font sizes
- touch-friendly controls
- keyboard-accessible forms
- clear correct/incorrect states without color-only dependence

## 13. Suggested Screens

- **Dashboard**
- **Theme List**
- **Theme Detail**
- **Chapter Detail**
- **Study Session Setup**
- **Session Player**
- **Session Summary**
- **History**
- **History Detail**
- **Content Management**
  - theme editor
  - chapter editor
  - topic editor
  - question editor
  - JSON import screen

## 14. Data Storage

V1 is **single-user local only**.

Suggested local storage options:

- IndexedDB preferred for structured content and history
- localStorage only for lightweight app preferences if needed

Data stored locally:

- themes
- chapters
- topics
- questions
- session history
- progress stats
- user preferences

No V1 support for:

- authentication
- sync
- cloud backup
- multi-device continuity

## 15. Technical Requirements

- Framework: **Svelte**
- Mobile-responsive design
- Component-based architecture
- Local-first data handling
- Import validation layer for JSON

Optional:

- PWA support
  - installable
  - cached static assets
  - basic offline support

## 16. Non-Goals for V1

- Built-in LLM generation of questions
- Multi-user support
- Backend/API sync
- Advanced semantic grading for free-text answers
- Editing completed session history
- Collaboration features
- Spaced repetition engine

## 17. V1 Priorities

1. Data model for themes, chapters, topics, questions, sessions
2. JSON import flow
3. Chapter-by-chapter study player
4. Fixed-order question flow
5. Free-text auto-match with manual override
6. Session scoring and summary
7. Session history
8. Progress dashboard
9. Content management UI
10. Mobile polish
11. Optional PWA support

## 18. Open Implementation Notes

- Free-text matching should start simple and be replaceable later
- Ordering must be deterministic everywhere in the app
- Session records should be immutable after completion
- Import validation should enforce required fields and valid ordering values
- Final assessment questions should be visually distinct from topic questions
