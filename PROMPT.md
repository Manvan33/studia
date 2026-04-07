# LLM Prompt: Generate Study Questions from Source Material

Use this prompt with any LLM (ChatGPT, Claude, Gemini, etc.) to convert study material into JSON that Studia can import directly.

---

## Prompt

```
You are a study content generator. Your job is to read the provided study material and produce structured JSON that a study application can import.

Work in two phases:

PHASE 1 — ANALYSIS
Before writing any JSON, think through the material:
- Identify the natural chapter and topic structure. What are the major sections? What subtopics exist within each?
- For each topic, identify the key concepts worth testing. What would a student need to know?
- Decide which concepts are best tested with multiple choice (factual, definitional, comparative) vs free text (short recall, naming, listing).
- Note any cross-topic relationships that would make good final assessment questions.
- Consider what plausible wrong answers would look like — they should reflect real misconceptions, not random nonsense.

Write this analysis out. It will help you produce better questions.

PHASE 2 — JSON OUTPUT
After your analysis, output the JSON. The JSON block MUST be the last thing in your response, wrapped in a ```json code fence so it can be extracted cleanly.

The JSON must match this exact schema:

{
  "theme": {
    "title": "<subject name>",
    "description": "<optional short description>"
  },
  "chapters": [
    {
      "title": "<chapter title>",
      "description": "<optional chapter description>",
      "order": 1,
      "topics": [
        {
          "title": "<topic title>",
          "description": "<optional topic description>",
          "order": 1,
          "questions": [
            {
              "type": "multiple_choice",
              "prompt": "<question text>",
              "choices": ["<correct answer>", "<wrong 1>", "<wrong 2>", "<wrong 3>"],
              "correctAnswer": "<must exactly match one of the choices>",
              "explanation": "<why this is the correct answer>",
              "order": 1
            },
            {
              "type": "free_text",
              "prompt": "<question text>",
              "correctAnswer": "<expected short answer>",
              "explanation": "<why this is the correct answer>",
              "order": 2
            }
          ]
        }
      ],
      "finalAssessment": [
        {
          "type": "multiple_choice",
          "prompt": "<chapter-level assessment question>",
          "choices": ["<option A>", "<option B>", "<option C>"],
          "correctAnswer": "<must exactly match one choice>",
          "explanation": "<explanation>",
          "order": 1
        }
      ]
    }
  ]
}

HARD RULES — violations will break the import:
1. The JSON block MUST be the last thing in your response, inside a ```json fence.
2. Every question MUST have: type, prompt, correctAnswer, explanation, order.
3. Multiple choice questions MUST have a "choices" array with at least 2 items.
4. For multiple choice, "correctAnswer" MUST be an exact string match to one of the "choices".
5. Free text questions MUST NOT have a "choices" field.
6. "order" values MUST be non-negative numbers (0, 1, 2, ...). Use sequential integers starting from 1.
7. Every topic MUST have at least 1 question.
8. Every chapter MUST have at least 1 topic.
9. There MUST be at least 1 chapter.
10. "theme.title" MUST be a non-empty string.
11. Do NOT put any text after the closing ```json fence.

CONTENT RULES:
- Extract questions that test understanding, not just recall.
- For multiple choice: write 3-4 plausible distractors. The distractors should be common misconceptions or closely related concepts, not obviously wrong answers.
- For free text: keep correctAnswer short (1-5 words). The app matches case-insensitively with trimmed whitespace.
- Explanations should be concise but informative — tell the student WHY, not just restate the answer.
- Mix question types: aim for roughly 60-70% multiple choice, 30-40% free text.
- Group questions under topics that reflect logical sections of the source material.
- Add 5 finalAssessment questions per chapter that test cross-topic understanding.
- Shuffle the position of the correct answer among the choices (don't always put it first).

OPTIONAL FIELDS (include when relevant):
- "tags": ["tag1", "tag2"] — categorization tags on questions
- "difficulty": "easy" | "medium" | "hard" — difficulty level on questions
- "description": string — on theme, chapters, or topics

USER-SETTINGS:

- Student persona: I'm a Cisco Solutions Engineer, I have a strong background in networking. 
- Difficulty level: Make it hard
- How many questions: around 30 (20 while learning topics, 10 for the final assessment) per chapter

Now read the following study material, analyze it (Phase 1), then produce the JSON (Phase 2):

<paste study material here>
```

---

## Usage

1. Copy the prompt above
2. Paste your study material at the end (replace `<paste study material here>`)
3. Send to the LLM
4. Copy the **entire response** (analysis + JSON) — no need to extract the JSON yourself
5. Go to Studia → Import → paste the full output → preview → import

The import page automatically extracts JSON from the last ` ```json ` code fence in the pasted text.

## Tips

- **Long documents**: If the material is too long for one prompt, split by chapter and generate one chapter at a time. Then manually combine the chapter arrays under a single theme object.
- **Quality check**: Review the preview in Studia before importing. Look for correctAnswer mismatches in MCQs.
- **Free text answers**: Keep them short. "802.11b" is good. "The IEEE 802.11b standard" will be harder to match during study.
- **Regenerate**: If the output has validation errors, paste the errors back to the LLM and ask it to fix them.
