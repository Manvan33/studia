# LLM Prompt: Generate Study Questions from Source Material

Use this prompt with any LLM (ChatGPT, Claude, Gemini, etc.) to convert study material into JSON that Studia can import directly.

---

## Prompt

````
You are a study content generator. Your job is to read the provided study material and produce structured JSON that a study application can import.

Work in 4 phases:

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
              "context": "<optional markdown-formatted background information shown before the question>",
              "choices": ["<correct answer>", "<wrong 1>", "<wrong 2>", "<wrong 3>"],
              "correctAnswer": "<must exactly match one of the choices>",
              "explanation": "<detailed markdown-formatted explanation of why this is correct>",
              "order": 1
            },
            {
              "type": "free_text",
              "prompt": "<question text>",
              "context": "<optional markdown-formatted background information>",
              "correctAnswer": "<expected short answer>",
              "explanation": "<detailed markdown-formatted explanation>",
              "order": 2
            },
            {
              "type": "multiple_select",
              "prompt": "<question text — select all that apply>",
              "context": "<optional markdown-formatted background information>",
              "choices": ["<correct 1>", "<correct 2>", "<wrong 1>", "<wrong 2>"],
              "correctAnswers": ["<correct 1>", "<correct 2>"],
              "explanation": "<detailed markdown-formatted explanation>",
              "order": 3
            }
          ]
        }
      ],
      "finalAssessment": [
        {
          "type": "multiple_choice",
          "prompt": "<chapter-level assessment question>",
          "context": "<optional markdown context for assessment questions>",
          "choices": ["<option A>", "<option B>", "<option C>"],
          "correctAnswer": "<must exactly match one choice>",
          "explanation": "<detailed markdown explanation>",
          "order": 1
        }
      ]
    }
  ]
}

HARD RULES — violations will break the import:
1. The JSON block MUST be the last thing in your response, inside a ```json fence.
2. Every question MUST have: type, prompt, explanation, order.
3. Multiple choice questions MUST have a "choices" array with at least 2 items and a "correctAnswer" string.
4. For multiple choice, "correctAnswer" MUST be an exact string match to one of the "choices".
5. Free text questions MUST NOT have a "choices" field. They MUST have a "correctAnswer" string.
6. Multiple select questions MUST have a "choices" array with at least 2 items and a "correctAnswers" array with at least 1 item.
7. For multiple select, each entry in "correctAnswers" MUST be an exact string match to one of the "choices".
8. Multiple select questions MUST NOT have a "correctAnswer" field — use "correctAnswers" (plural) only.
9. "order" values MUST be non-negative numbers (0, 1, 2, ...). Use sequential integers starting from 1.
10. Every topic MUST have at least 1 question.
11. Every chapter MUST have at least 1 topic.
12. There MUST be at least 1 chapter.
13. "theme.title" MUST be a non-empty string.
14. Do NOT put any text after the closing ```json fence.

PHASE 3 - Review

For each question, create a subagent that reviews the question for clarity, accuracy, and adherence to the rules. The subagent should check:
- Is the question clear and unambiguous?
- Are the correct and wrong answers accurate and plausible?
- Does the explanation thoroughly justify the correct answer and address the wrong answers (for MCQ)?
- Does the question adhere to the content rules and JSON schema?
- Is the correct answer actually correct based on the study material?

PHASE 4 - Finalize
After review, make any necessary edits to the questions. Then finalize the JSON output, ensuring it is well-formatted and adheres to the schema. Double-check that all required fields are present and correctly filled out, and that the JSON is valid. Once finalized, the JSON block should be the last thing in the response, wrapped in a ```json code fence.

CONTENT RULES:
- Extract questions that test understanding, not just recall.
- For multiple choice: write 3-4 plausible distractors. The distractors should be common misconceptions or closely related concepts, not obviously wrong answers.
- For free text: keep correctAnswer short (1-5 words). The app matches case-insensitively with trimmed whitespace.
- **Context field** (optional): Use `context` to provide background information the student needs before answering. Write it in **markdown format**. Good uses: a short paragraph explaining a scenario, a table of values, a code snippet, or a diagram description. Only include context when the question requires setup — don't add it to every question.
- **Explanations** must be **detailed and markdown-formatted**. A good explanation:
  - States WHY the correct answer is correct (not just restates it)
  - Explains WHY each wrong answer is wrong (for MCQ)
  - Provides additional context, references, or mnemonics when helpful
  - Uses markdown formatting: **bold** for key terms, `code` for technical values, bullet lists for multiple points, etc.
- Mix question types: aim for roughly 50-60% multiple choice, 20-30% free text, 10-20% multiple select ("select all that apply").
- Use multiple select questions when a concept has multiple correct components, categories, or conditions that all apply.
- Group questions under topics that reflect logical sections of the source material.
- Add 5 finalAssessment questions per chapter that test cross-topic understanding.
- Shuffle the position of the correct answer among the choices (don't always put it first).

OPTIONAL FIELDS (include when relevant):
- "context": "<markdown string>" — background information shown before the question (scenarios, tables, code snippets)
- "tags": ["tag1", "tag2"] — categorization tags on questions
- "difficulty": "easy" | "medium" | "hard" — difficulty level on questions
- "description": string — on theme, chapters, or topics

USER-SETTINGS:

- Student persona: I'm a Cisco Solutions Engineer, I have a strong background in networking. 
- Difficulty level: Make it hard
- How many questions: around 30 (20 while learning topics, 10 for the final assessment) per chapter

Now read the following study material, analyze it (Phase 1), then produce the JSON (Phase 2), review it (Phase 3), and finalize (Phase 4).

Study material will be provided by the user below:
````

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
