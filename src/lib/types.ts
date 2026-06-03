export interface LearningTheme {
	id: string;
	title: string;
	description?: string;
	createdAt: string;
	updatedAt: string;
}

export interface Chapter {
	id: string;
	themeId: string;
	title: string;
	description?: string;
	order: number;
	createdAt: string;
	updatedAt: string;
}

export interface Topic {
	id: string;
	chapterId: string;
	title: string;
	description?: string;
	order: number;
	createdAt: string;
	updatedAt: string;
}

export type QuestionType = 'multiple_choice' | 'free_text' | 'multiple_select';

/**
 * Reference back to the original study guide for the correct answer.
 * Used to display a verbatim justification next to the explanation,
 * and to deep-link into an attached SourceDocument (PDF or HTML).
 */
export interface SourceRef {
	/** Verbatim excerpt from the source material that justifies the correct answer. */
	quote: string;
	/** Optional structured locators within the source document. */
	locator?: SourceLocator;
}

export interface SourceLocator {
	/** 1-based page number for PDF sources. */
	page?: number;
	/** Section title or heading text (free-form). */
	section?: string;
	/** HTML fragment id (anchor) for HTML sources. */
	anchor?: string;
}

export interface Question {
	id: string;
	chapterId: string;
	topicId?: string;
	type: QuestionType;
	prompt: string;
	context?: string;
	choices?: string[];
	correctAnswer: string;
	correctAnswers?: string[];
	explanation: string;
	order: number;
	tags?: string[];
	difficulty?: string;
	isFinalAssessment: boolean;
	sourceRef?: SourceRef;
	createdAt: string;
	updatedAt: string;
}

/**
 * Original study guide document attached to a chapter (PDF or HTML).
 * Stored locally in IndexedDB as a Blob — never uploaded.
 */
export type SourceDocumentKind = 'pdf' | 'html';

export interface SourceDocument {
	id: string;
	chapterId: string;
	title: string;
	kind: SourceDocumentKind;
	mime: string;
	size: number;
	blob: Blob;
	createdAt: string;
	updatedAt: string;
}

export type SessionType = 'chapter' | 'custom' | 'wrong_only' | 'final_assessment';

export interface StudySession {
	id: string;
	type: SessionType;
	themeIds: string[];
	chapterIds: string[];
	topicIds?: string[];
	createdAt: string;
	startedAt?: string;
	completedAt?: string;
	questionIds: string[];
	scoring?: SessionScoring;
}

export interface SessionScoring {
	total: number;
	correct: number;
	incorrect: number;
	skipped: number;
	scorePercentage: number;
	durationMs?: number;
	perTopicBreakdown?: Record<string, TopicBreakdown>;
	perChapterBreakdown?: Record<string, ChapterBreakdown>;
}

export interface TopicBreakdown {
	topicId: string;
	topicTitle: string;
	total: number;
	correct: number;
	incorrect: number;
	skipped: number;
}

export interface ChapterBreakdown {
	chapterId: string;
	chapterTitle: string;
	total: number;
	correct: number;
	incorrect: number;
	skipped: number;
}

export type AnswerResult = 'correct' | 'incorrect';

export interface SessionAnswer {
	id: string;
	sessionId: string;
	questionId: string;
	userAnswer: string;
	autoMatchedResult: AnswerResult | null;
	manuallyOverriddenResult?: AnswerResult;
	finalResult: AnswerResult | null;
	skipped: boolean;
	answeredAt: string;
}

export interface QuestionProgress {
	questionId: string;
	timesSeen: number;
	timesCorrect: number;
	timesIncorrect: number;
	lastAnsweredAt?: string;
}

export interface ImportData {
	theme: {
		title: string;
		description?: string;
	};
	chapters: ImportChapter[];
}

export interface ImportChapter {
	title: string;
	description?: string;
	order: number;
	topics: ImportTopic[];
	finalAssessment?: ImportQuestion[];
}

export interface ImportTopic {
	title: string;
	description?: string;
	order: number;
	questions: ImportQuestion[];
}

export interface ImportQuestion {
	type: QuestionType;
	prompt: string;
	context?: string;
	choices?: string[];
	correctAnswer?: string;
	correctAnswers?: string[];
	explanation: string;
	order: number;
	tags?: string[];
	difficulty?: string;
	sourceRef?: SourceRef;
}

export interface DatabaseBackup {
	version: 1 | 2;
	exportedAt: string;
	includesSessions: boolean;
	includesSourceDocuments?: boolean;
	data: {
		themes: LearningTheme[];
		chapters: Chapter[];
		topics: Topic[];
		questions: Question[];
		sessions?: StudySession[];
		sessionAnswers?: SessionAnswer[];
		questionProgress?: QuestionProgress[];
		/** Source documents serialised as base64 (only when includesSourceDocuments). */
		sourceDocuments?: SerializedSourceDocument[];
	};
}

export interface SerializedSourceDocument {
	id: string;
	chapterId: string;
	title: string;
	kind: SourceDocumentKind;
	mime: string;
	size: number;
	/** Base64-encoded blob data. */
	dataBase64: string;
	createdAt: string;
	updatedAt: string;
}

export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
}

export interface ValidationError {
	path: string;
	message: string;
}
