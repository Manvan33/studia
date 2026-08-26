import { db } from './db';
import type {
	StudySession,
	QuestionProgress,
	Chapter,
	Topic,
	Question,
	SessionAnswer
} from './types';

export interface ProgressStats {
	totalSessions: number;
	completedSessions: number;
	averageScore: number;
	recentSessions: StudySession[];
	weakTopics: WeakItem[];
	weakChapters: WeakItem[];
	frequentlyMissed: MissedQuestion[];
	chapterCompletionStatus: ChapterStatus[];
	finalAssessmentPerformance: FinalAssessmentStat[];
}

export interface WeakItem {
	id: string;
	title: string;
	correctRate: number;
	total: number;
	correct: number;
}

export interface MissedQuestion {
	questionId: string;
	prompt: string;
	timesIncorrect: number;
	timesSeen: number;
	topicTitle: string;
	chapterTitle: string;
}

export interface ChapterStatus {
	chapterId: string;
	chapterTitle: string;
	totalQuestions: number;
	answeredQuestions: number;
	correctRate: number;
	hasBeenStudied: boolean;
}

export interface FinalAssessmentStat {
	chapterId: string;
	chapterTitle: string;
	totalQuestions: number;
	correct: number;
	attempted: boolean;
}

export async function getProgressStats(): Promise<ProgressStats> {
	const allSessions = await db.sessions.toArray();
	const completedSessions = allSessions.filter((s) => s.completedAt);
	const allProgress = await db.questionProgress.toArray();
	const allQuestions = await db.questions.toArray();
	const allChapters = await db.chapters.toArray();
	const allTopics = await db.topics.toArray();
	const allAnswers = await db.sessionAnswers.toArray();

	const scores = completedSessions
		.map((s) => s.scoring?.scorePercentage)
		.filter((s): s is number => s !== undefined);

	const averageScore =
		scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

	const recentSessions = completedSessions
		.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
		.slice(0, 5);

	const weakTopics = computeWeakTopics(allProgress, allQuestions, allTopics);
	const weakChapters = computeWeakChapters(allProgress, allQuestions, allChapters);
	const frequentlyMissed = computeFrequentlyMissed(
		allProgress,
		allQuestions,
		allTopics,
		allChapters
	);
	const chapterCompletionStatus = computeChapterCompletion(allQuestions, allChapters, allProgress);
	const finalAssessmentPerformance = computeFinalAssessmentPerformance(
		allQuestions,
		allChapters,
		allAnswers
	);

	return {
		totalSessions: allSessions.length,
		completedSessions: completedSessions.length,
		averageScore,
		recentSessions,
		weakTopics,
		weakChapters,
		frequentlyMissed,
		chapterCompletionStatus,
		finalAssessmentPerformance
	};
}

function computeWeakTopics(
	progress: QuestionProgress[],
	questions: Question[],
	topics: Topic[]
): WeakItem[] {
	const topicStats = new Map<string, { correct: number; total: number }>();

	for (const p of progress) {
		const q = questions.find((q) => q.id === p.questionId);
		if (!q?.topicId) continue;

		const existing = topicStats.get(q.topicId) ?? { correct: 0, total: 0 };
		existing.total += p.timesSeen;
		existing.correct += p.timesCorrect;
		topicStats.set(q.topicId, existing);
	}

	return Array.from(topicStats.entries())
		.map(([topicId, stats]) => {
			const topic = topics.find((t) => t.id === topicId);
			return {
				id: topicId,
				title: topic?.title ?? 'Unknown',
				correctRate: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
				total: stats.total,
				correct: stats.correct
			};
		})
		.filter((t) => t.total >= 2)
		.sort((a, b) => a.correctRate - b.correctRate)
		.slice(0, 5);
}

function computeWeakChapters(
	progress: QuestionProgress[],
	questions: Question[],
	chapters: Chapter[]
): WeakItem[] {
	const chapterStats = new Map<string, { correct: number; total: number }>();

	for (const p of progress) {
		const q = questions.find((q) => q.id === p.questionId);
		if (!q) continue;

		const existing = chapterStats.get(q.chapterId) ?? { correct: 0, total: 0 };
		existing.total += p.timesSeen;
		existing.correct += p.timesCorrect;
		chapterStats.set(q.chapterId, existing);
	}

	return Array.from(chapterStats.entries())
		.map(([chapterId, stats]) => {
			const chapter = chapters.find((c) => c.id === chapterId);
			return {
				id: chapterId,
				title: chapter?.title ?? 'Unknown',
				correctRate: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
				total: stats.total,
				correct: stats.correct
			};
		})
		.filter((c) => c.total >= 2)
		.sort((a, b) => a.correctRate - b.correctRate)
		.slice(0, 5);
}

function computeFrequentlyMissed(
	progress: QuestionProgress[],
	questions: Question[],
	topics: Topic[],
	chapters: Chapter[]
): MissedQuestion[] {
	return progress
		.filter((p) => p.timesIncorrect >= 2)
		.sort((a, b) => b.timesIncorrect - a.timesIncorrect)
		.slice(0, 10)
		.map((p) => {
			const q = questions.find((q) => q.id === p.questionId);
			const topic = q?.topicId ? topics.find((t) => t.id === q.topicId) : undefined;
			const chapter = q ? chapters.find((c) => c.id === q.chapterId) : undefined;

			return {
				questionId: p.questionId,
				prompt: q?.prompt ?? 'Unknown',
				timesIncorrect: p.timesIncorrect,
				timesSeen: p.timesSeen,
				topicTitle: topic?.title ?? 'Final Assessment',
				chapterTitle: chapter?.title ?? 'Unknown'
			};
		});
}

function computeChapterCompletion(
	questions: Question[],
	chapters: Chapter[],
	progress: QuestionProgress[]
): ChapterStatus[] {
	const progressMap = new Map(progress.map((p) => [p.questionId, p]));

	return chapters
		.sort((a, b) => a.order - b.order)
		.map((chapter) => {
			const chapterQuestions = questions.filter((q) => q.chapterId === chapter.id);
			const answered = chapterQuestions.filter((q) => progressMap.has(q.id));
			const correctCount = answered.reduce(
				(sum, q) => sum + ((progressMap.get(q.id)?.timesCorrect ?? 0) > 0 ? 1 : 0),
				0
			);

			return {
				chapterId: chapter.id,
				chapterTitle: chapter.title,
				totalQuestions: chapterQuestions.length,
				answeredQuestions: answered.length,
				correctRate: answered.length > 0 ? Math.round((correctCount / answered.length) * 100) : 0,
				hasBeenStudied: answered.length > 0
			};
		});
}

function computeFinalAssessmentPerformance(
	questions: Question[],
	chapters: Chapter[],
	answers: SessionAnswer[]
): FinalAssessmentStat[] {
	return chapters
		.sort((a, b) => a.order - b.order)
		.map((chapter) => {
			const faQuestions = questions.filter(
				(q) => q.chapterId === chapter.id && q.isFinalAssessment
			);
			const faAnswers = answers.filter(
				(a) =>
					faQuestions.some((q) => q.id === a.questionId) &&
					!a.skipped &&
					a.finalResult === 'correct'
			);
			const attempted = answers.some((a) => faQuestions.some((q) => q.id === a.questionId));

			return {
				chapterId: chapter.id,
				chapterTitle: chapter.title,
				totalQuestions: faQuestions.length,
				correct: faAnswers.length,
				attempted
			};
		})
		.filter((s) => s.totalQuestions > 0);
}
