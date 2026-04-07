import { nanoid } from 'nanoid';
import type {
	ImportData,
	ImportChapter,
	ImportTopic,
	ImportQuestion,
	ValidationResult,
	ValidationError,
	LearningTheme,
	Chapter,
	Topic,
	Question
} from './types';
import { db } from './db';

export function validateImportData(data: unknown): ValidationResult {
	const errors: ValidationError[] = [];

	if (!data || typeof data !== 'object') {
		errors.push({ path: 'root', message: 'Import data must be an object' });
		return { valid: false, errors };
	}

	const d = data as Record<string, unknown>;

	if (!d.theme || typeof d.theme !== 'object') {
		errors.push({ path: 'theme', message: 'Missing or invalid theme object' });
	} else {
		const theme = d.theme as Record<string, unknown>;
		if (!theme.title || typeof theme.title !== 'string' || theme.title.trim() === '') {
			errors.push({ path: 'theme.title', message: 'Theme title is required' });
		}
	}

	if (!Array.isArray(d.chapters)) {
		errors.push({ path: 'chapters', message: 'Chapters must be an array' });
		return { valid: errors.length === 0, errors };
	}

	if (d.chapters.length === 0) {
		errors.push({ path: 'chapters', message: 'At least one chapter is required' });
	}

	(d.chapters as unknown[]).forEach((chapter, ci) => {
		validateChapter(chapter, `chapters[${ci}]`, errors);
	});

	return { valid: errors.length === 0, errors };
}

function validateChapter(
	chapter: unknown,
	path: string,
	errors: ValidationError[]
): void {
	if (!chapter || typeof chapter !== 'object') {
		errors.push({ path, message: 'Chapter must be an object' });
		return;
	}

	const c = chapter as Record<string, unknown>;

	if (!c.title || typeof c.title !== 'string' || c.title.trim() === '') {
		errors.push({ path: `${path}.title`, message: 'Chapter title is required' });
	}

	if (typeof c.order !== 'number' || c.order < 0) {
		errors.push({ path: `${path}.order`, message: 'Chapter order must be a non-negative number' });
	}

	if (!Array.isArray(c.topics)) {
		errors.push({ path: `${path}.topics`, message: 'Topics must be an array' });
	} else {
		(c.topics as unknown[]).forEach((topic, ti) => {
			validateTopic(topic, `${path}.topics[${ti}]`, errors);
		});
	}

	if (c.finalAssessment !== undefined) {
		if (!Array.isArray(c.finalAssessment)) {
			errors.push({
				path: `${path}.finalAssessment`,
				message: 'Final assessment must be an array'
			});
		} else {
			(c.finalAssessment as unknown[]).forEach((q, qi) => {
				validateQuestion(q, `${path}.finalAssessment[${qi}]`, errors);
			});
		}
	}
}

function validateTopic(
	topic: unknown,
	path: string,
	errors: ValidationError[]
): void {
	if (!topic || typeof topic !== 'object') {
		errors.push({ path, message: 'Topic must be an object' });
		return;
	}

	const t = topic as Record<string, unknown>;

	if (!t.title || typeof t.title !== 'string' || t.title.trim() === '') {
		errors.push({ path: `${path}.title`, message: 'Topic title is required' });
	}

	if (typeof t.order !== 'number' || t.order < 0) {
		errors.push({ path: `${path}.order`, message: 'Topic order must be a non-negative number' });
	}

	if (!Array.isArray(t.questions)) {
		errors.push({ path: `${path}.questions`, message: 'Questions must be an array' });
	} else {
		if (t.questions.length === 0) {
			errors.push({ path: `${path}.questions`, message: 'At least one question is required' });
		}
		(t.questions as unknown[]).forEach((q, qi) => {
			validateQuestion(q, `${path}.questions[${qi}]`, errors);
		});
	}
}

function validateQuestion(
	question: unknown,
	path: string,
	errors: ValidationError[]
): void {
	if (!question || typeof question !== 'object') {
		errors.push({ path, message: 'Question must be an object' });
		return;
	}

	const q = question as Record<string, unknown>;

	if (q.type !== 'multiple_choice' && q.type !== 'free_text') {
		errors.push({
			path: `${path}.type`,
			message: 'Question type must be "multiple_choice" or "free_text"'
		});
	}

	if (!q.prompt || typeof q.prompt !== 'string' || q.prompt.trim() === '') {
		errors.push({ path: `${path}.prompt`, message: 'Question prompt is required' });
	}

	if (q.type === 'multiple_choice') {
		if (!Array.isArray(q.choices) || q.choices.length < 2) {
			errors.push({
				path: `${path}.choices`,
				message: 'Multiple choice questions require at least 2 choices'
			});
		}
	}

	if (!q.correctAnswer || typeof q.correctAnswer !== 'string' || q.correctAnswer.trim() === '') {
		errors.push({ path: `${path}.correctAnswer`, message: 'Correct answer is required' });
	}

	if (!q.explanation || typeof q.explanation !== 'string' || q.explanation.trim() === '') {
		errors.push({ path: `${path}.explanation`, message: 'Explanation is required' });
	}

	if (typeof q.order !== 'number' || q.order < 0) {
		errors.push({ path: `${path}.order`, message: 'Question order must be a non-negative number' });
	}

	if (
		q.type === 'multiple_choice' &&
		Array.isArray(q.choices) &&
		typeof q.correctAnswer === 'string'
	) {
		if (!q.choices.includes(q.correctAnswer)) {
			errors.push({
				path: `${path}.correctAnswer`,
				message: 'Correct answer must be one of the provided choices'
			});
		}
	}
}

export async function importData(data: ImportData): Promise<{ themeId: string }> {
	const now = new Date().toISOString();
	const themeId = nanoid();

	const theme: LearningTheme = {
		id: themeId,
		title: data.theme.title,
		description: data.theme.description,
		createdAt: now,
		updatedAt: now
	};

	const chapters: Chapter[] = [];
	const topics: Topic[] = [];
	const questions: Question[] = [];

	for (const importChapter of data.chapters) {
		const chapterId = nanoid();

		chapters.push({
			id: chapterId,
			themeId,
			title: importChapter.title,
			description: importChapter.description,
			order: importChapter.order,
			createdAt: now,
			updatedAt: now
		});

		for (const importTopic of importChapter.topics) {
			const topicId = nanoid();

			topics.push({
				id: topicId,
				chapterId,
				title: importTopic.title,
				description: importTopic.description,
				order: importTopic.order,
				createdAt: now,
				updatedAt: now
			});

			for (const importQuestion of importTopic.questions) {
				questions.push(buildQuestion(importQuestion, chapterId, topicId, false, now));
			}
		}

		if (importChapter.finalAssessment) {
			for (const importQuestion of importChapter.finalAssessment) {
				questions.push(buildQuestion(importQuestion, chapterId, undefined, true, now));
			}
		}
	}

	await db.transaction('rw', [db.themes, db.chapters, db.topics, db.questions], async () => {
		await db.themes.add(theme);
		await db.chapters.bulkAdd(chapters);
		await db.topics.bulkAdd(topics);
		await db.questions.bulkAdd(questions);
	});

	return { themeId };
}

function buildQuestion(
	iq: ImportQuestion,
	chapterId: string,
	topicId: string | undefined,
	isFinalAssessment: boolean,
	now: string
): Question {
	return {
		id: nanoid(),
		chapterId,
		topicId,
		type: iq.type,
		prompt: iq.prompt,
		choices: iq.choices,
		correctAnswer: iq.correctAnswer,
		explanation: iq.explanation,
		order: iq.order,
		tags: iq.tags,
		difficulty: iq.difficulty,
		isFinalAssessment,
		createdAt: now,
		updatedAt: now
	};
}

export async function exportChapterAsJson(chapterId: string): Promise<ImportChapter> {
	const chapter = await db.chapters.get(chapterId);
	if (!chapter) throw new Error('Chapter not found');

	const topics = await db.topics.where('chapterId').equals(chapterId).sortBy('order');

	const topicQuestions = await db.questions
		.where('chapterId')
		.equals(chapterId)
		.and((q) => !q.isFinalAssessment)
		.toArray();

	const finalQuestions = await db.questions
		.where('chapterId')
		.equals(chapterId)
		.and((q) => q.isFinalAssessment)
		.sortBy('order');

	const exportTopics: ImportTopic[] = topics.map((t) => {
		const tQuestions = topicQuestions
			.filter((q) => q.topicId === t.id)
			.sort((a, b) => a.order - b.order);

		return {
			title: t.title,
			...(t.description ? { description: t.description } : {}),
			order: t.order,
			questions: tQuestions.map(questionToImport)
		};
	});

	const result: ImportChapter = {
		title: chapter.title,
		...(chapter.description ? { description: chapter.description } : {}),
		order: chapter.order,
		topics: exportTopics
	};

	if (finalQuestions.length > 0) {
		result.finalAssessment = finalQuestions.map(questionToImport);
	}

	return result;
}

function questionToImport(q: Question): ImportQuestion {
	const result: ImportQuestion = {
		type: q.type,
		prompt: q.prompt,
		correctAnswer: q.correctAnswer,
		explanation: q.explanation,
		order: q.order
	};
	if (q.choices) result.choices = q.choices;
	if (q.tags && q.tags.length > 0) result.tags = q.tags;
	if (q.difficulty) result.difficulty = q.difficulty;
	return result;
}

export function validateChapterData(data: unknown): ValidationResult {
	const errors: ValidationError[] = [];
	validateChapter(data, 'chapter', errors);
	return { valid: errors.length === 0, errors };
}

export async function updateChapterFromJson(
	chapterId: string,
	data: ImportChapter
): Promise<void> {
	const chapter = await db.chapters.get(chapterId);
	if (!chapter) throw new Error('Chapter not found');

	const now = new Date().toISOString();

	const newTopics: Topic[] = [];
	const newQuestions: Question[] = [];

	for (const importTopic of data.topics) {
		const topicId = nanoid();

		newTopics.push({
			id: topicId,
			chapterId,
			title: importTopic.title,
			description: importTopic.description,
			order: importTopic.order,
			createdAt: now,
			updatedAt: now
		});

		for (const importQuestion of importTopic.questions) {
			newQuestions.push(buildQuestion(importQuestion, chapterId, topicId, false, now));
		}
	}

	if (data.finalAssessment) {
		for (const importQuestion of data.finalAssessment) {
			newQuestions.push(buildQuestion(importQuestion, chapterId, undefined, true, now));
		}
	}

	await db.transaction('rw', [db.chapters, db.topics, db.questions], async () => {
		await db.questions.where('chapterId').equals(chapterId).delete();
		await db.topics.where('chapterId').equals(chapterId).delete();

		await db.chapters.update(chapterId, {
			title: data.title,
			description: data.description,
			order: data.order,
			updatedAt: now
		});

		await db.topics.bulkAdd(newTopics);
		await db.questions.bulkAdd(newQuestions);
	});
}

export function extractJson(input: string): string {
	const fencePattern = /```json\s*\n([\s\S]*?)```/g;
	let lastMatch: RegExpExecArray | null = null;
	let match: RegExpExecArray | null;
	while ((match = fencePattern.exec(input)) !== null) {
		lastMatch = match;
	}
	if (lastMatch) return lastMatch[1].trim();

	const genericPattern = /```\s*\n([\s\S]*?)```/g;
	while ((match = genericPattern.exec(input)) !== null) {
		lastMatch = match;
	}
	if (lastMatch) {
		const content = lastMatch[1].trim();
		if (content.startsWith('{')) return content;
	}

	return input.trim();
}
