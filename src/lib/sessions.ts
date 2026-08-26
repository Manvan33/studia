import { nanoid } from 'nanoid';
import { db } from './db';
import type {
	StudySession,
	SessionAnswer,
	SessionScoring,
	SessionType,
	Question,
	Chapter,
	Topic,
	TopicBreakdown,
	ChapterBreakdown
} from './types';
import { evaluateMultipleChoice, evaluateFreeText, evaluateMultipleSelect } from './evaluation';

export async function createChapterSession(chapterId: string): Promise<StudySession> {
	const chapter = await db.chapters.get(chapterId);
	if (!chapter) throw new Error('Chapter not found');

	const topics = await db.topics.where('chapterId').equals(chapterId).sortBy('order');
	const topicIds = topics.map((t) => t.id);

	const topicQuestions = await db.questions
		.where('chapterId')
		.equals(chapterId)
		.and((q) => !q.isFinalAssessment)
		.sortBy('order');

	const finalQuestions = await db.questions
		.where('chapterId')
		.equals(chapterId)
		.and((q) => q.isFinalAssessment)
		.sortBy('order');

	const topicOrderMap = new Map<string, number>();
	for (const t of topics) {
		topicOrderMap.set(t.id, t.order);
	}

	const sortedTopicQuestions = topicQuestions.sort((a, b) => {
		const topicOrderA = a.topicId ? (topicOrderMap.get(a.topicId) ?? 0) : 0;
		const topicOrderB = b.topicId ? (topicOrderMap.get(b.topicId) ?? 0) : 0;
		if (topicOrderA !== topicOrderB) return topicOrderA - topicOrderB;
		return a.order - b.order;
	});

	const allQuestionIds = [...sortedTopicQuestions, ...finalQuestions].map((q) => q.id);

	const now = new Date().toISOString();
	const session: StudySession = {
		id: nanoid(),
		type: 'chapter',
		themeIds: [chapter.themeId],
		chapterIds: [chapterId],
		topicIds,
		createdAt: now,
		startedAt: now,
		questionIds: allQuestionIds
	};

	await db.sessions.add(session);
	return session;
}

export async function createCustomSession(opts: {
	chapterIds: string[];
	topicIds?: string[];
	type: SessionType;
	wrongOnly?: boolean;
	unansweredOnly?: boolean;
	finalAssessmentOnly?: boolean;
}): Promise<StudySession> {
	const chapters = await db.chapters.bulkGet(opts.chapterIds);
	const validChapters = chapters.filter((c): c is Chapter => c !== undefined);
	validChapters.sort((a, b) => a.order - b.order);

	const themeIds = [...new Set(validChapters.map((c) => c.themeId))];

	let questions: Question[] = [];

	for (const chapter of validChapters) {
		const topics = await db.topics.where('chapterId').equals(chapter.id).sortBy('order');

		let chapterQuestions: Question[];
		if (opts.finalAssessmentOnly) {
			chapterQuestions = await db.questions
				.where('chapterId')
				.equals(chapter.id)
				.and((q) => q.isFinalAssessment)
				.sortBy('order');
		} else {
			const topicQuestions = await db.questions
				.where('chapterId')
				.equals(chapter.id)
				.and((q) => !q.isFinalAssessment)
				.sortBy('order');

			const topicOrderMap = new Map<string, number>();
			for (const t of topics) {
				topicOrderMap.set(t.id, t.order);
			}

			const sorted = topicQuestions.sort((a, b) => {
				const topicOrderA = a.topicId ? (topicOrderMap.get(a.topicId) ?? 0) : 0;
				const topicOrderB = b.topicId ? (topicOrderMap.get(b.topicId) ?? 0) : 0;
				if (topicOrderA !== topicOrderB) return topicOrderA - topicOrderB;
				return a.order - b.order;
			});

			const finalQuestions = await db.questions
				.where('chapterId')
				.equals(chapter.id)
				.and((q) => q.isFinalAssessment)
				.sortBy('order');

			chapterQuestions = [...sorted, ...finalQuestions];
		}

		if (opts.topicIds && opts.topicIds.length > 0) {
			chapterQuestions = chapterQuestions.filter(
				(q) => !q.topicId || opts.topicIds!.includes(q.topicId)
			);
		}

		questions = [...questions, ...chapterQuestions];
	}

	if (opts.wrongOnly) {
		const wrongQuestionIds = await getWrongQuestionIds();
		questions = questions.filter((q) => wrongQuestionIds.has(q.id));
	}

	if (opts.unansweredOnly) {
		const answeredIds = await getAnsweredQuestionIds();
		questions = questions.filter((q) => !answeredIds.has(q.id));
	}

	const now = new Date().toISOString();
	const session: StudySession = {
		id: nanoid(),
		type: opts.type,
		themeIds: themeIds,
		chapterIds: opts.chapterIds,
		topicIds: opts.topicIds,
		createdAt: now,
		startedAt: now,
		questionIds: questions.map((q) => q.id)
	};

	await db.sessions.add(session);
	return session;
}

async function getWrongQuestionIds(): Promise<Set<string>> {
	const allAnswers = await db.sessionAnswers.where('finalResult').equals('incorrect').toArray();
	return new Set(allAnswers.map((a) => a.questionId));
}

async function getAnsweredQuestionIds(): Promise<Set<string>> {
	const allAnswers = await db.sessionAnswers.toArray();
	return new Set(allAnswers.map((a) => a.questionId));
}

export async function submitAnswer(
	sessionId: string,
	questionId: string,
	userAnswer: string,
	skipped: boolean = false
): Promise<SessionAnswer> {
	const question = await db.questions.get(questionId);
	if (!question) throw new Error('Question not found');

	let autoMatchedResult = null;
	if (!skipped) {
		if (question.type === 'multiple_select' && question.correctAnswers) {
			const userSelections: string[] = JSON.parse(userAnswer);
			autoMatchedResult = evaluateMultipleSelect(userSelections, question.correctAnswers);
		} else if (question.type === 'multiple_choice') {
			autoMatchedResult = evaluateMultipleChoice(userAnswer, question.correctAnswer);
		} else {
			autoMatchedResult = evaluateFreeText(userAnswer, question.correctAnswer);
		}
	}

	const answer: SessionAnswer = {
		id: nanoid(),
		sessionId,
		questionId,
		userAnswer,
		autoMatchedResult,
		finalResult: autoMatchedResult,
		skipped,
		answeredAt: new Date().toISOString()
	};

	await db.sessionAnswers.add(answer);
	await updateQuestionProgress(questionId, answer.finalResult, skipped);

	return answer;
}

export async function overrideAnswer(
	answerId: string,
	override: 'correct' | 'incorrect'
): Promise<void> {
	await db.sessionAnswers.update(answerId, {
		manuallyOverriddenResult: override,
		finalResult: override
	});

	const answer = await db.sessionAnswers.get(answerId);
	if (answer) {
		await updateQuestionProgress(answer.questionId, override, false);
	}
}

async function updateQuestionProgress(
	questionId: string,
	result: 'correct' | 'incorrect' | null,
	skipped: boolean
): Promise<void> {
	if (skipped) return;

	const existing = await db.questionProgress.get(questionId);
	const now = new Date().toISOString();

	if (existing) {
		await db.questionProgress.update(questionId, {
			timesSeen: existing.timesSeen + 1,
			timesCorrect: existing.timesCorrect + (result === 'correct' ? 1 : 0),
			timesIncorrect: existing.timesIncorrect + (result === 'incorrect' ? 1 : 0),
			lastAnsweredAt: now
		});
	} else {
		await db.questionProgress.add({
			questionId,
			timesSeen: 1,
			timesCorrect: result === 'correct' ? 1 : 0,
			timesIncorrect: result === 'incorrect' ? 1 : 0,
			lastAnsweredAt: now
		});
	}
}

export async function completeSession(sessionId: string): Promise<SessionScoring> {
	const session = await db.sessions.get(sessionId);
	if (!session) throw new Error('Session not found');

	const answers = await db.sessionAnswers.where('sessionId').equals(sessionId).toArray();
	const questions = await db.questions.bulkGet(session.questionIds);
	const validQuestions = questions.filter((q): q is Question => q !== undefined);

	let correct = 0;
	let incorrect = 0;
	let skipped = 0;

	const perTopicMap = new Map<string, TopicBreakdown>();
	const perChapterMap = new Map<string, ChapterBreakdown>();

	const topicCache = new Map<string, Topic>();
	const chapterCache = new Map<string, Chapter>();

	for (const q of validQuestions) {
		const answer = answers.find((a) => a.questionId === q.id);

		if (!answer || answer.skipped) {
			skipped++;
		} else if (answer.finalResult === 'correct') {
			correct++;
		} else {
			incorrect++;
		}

		if (q.topicId) {
			if (!topicCache.has(q.topicId)) {
				const topic = await db.topics.get(q.topicId);
				if (topic) topicCache.set(q.topicId, topic);
			}
			const topic = topicCache.get(q.topicId);
			if (topic) {
				const existing = perTopicMap.get(q.topicId) ?? {
					topicId: q.topicId,
					topicTitle: topic.title,
					total: 0,
					correct: 0,
					incorrect: 0,
					skipped: 0
				};
				existing.total++;
				if (!answer || answer.skipped) existing.skipped++;
				else if (answer.finalResult === 'correct') existing.correct++;
				else existing.incorrect++;
				perTopicMap.set(q.topicId, existing);
			}
		}

		if (!chapterCache.has(q.chapterId)) {
			const chapter = await db.chapters.get(q.chapterId);
			if (chapter) chapterCache.set(q.chapterId, chapter);
		}
		const chapter = chapterCache.get(q.chapterId);
		if (chapter) {
			const existing = perChapterMap.get(q.chapterId) ?? {
				chapterId: q.chapterId,
				chapterTitle: chapter.title,
				total: 0,
				correct: 0,
				incorrect: 0,
				skipped: 0
			};
			existing.total++;
			if (!answer || answer.skipped) existing.skipped++;
			else if (answer.finalResult === 'correct') existing.correct++;
			else existing.incorrect++;
			perChapterMap.set(q.chapterId, existing);
		}
	}

	const total = validQuestions.length;
	const startedAt = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
	const durationMs = Date.now() - startedAt;

	const scoring: SessionScoring = {
		total,
		correct,
		incorrect,
		skipped,
		scorePercentage: total > 0 ? Math.round((correct / total) * 100) : 0,
		durationMs,
		perTopicBreakdown: Object.fromEntries(perTopicMap),
		perChapterBreakdown: Object.fromEntries(perChapterMap)
	};

	await db.sessions.update(sessionId, {
		completedAt: new Date().toISOString(),
		scoring
	});

	return scoring;
}
