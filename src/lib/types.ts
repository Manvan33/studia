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

export type QuestionType = 'multiple_choice' | 'free_text';

export interface Question {
	id: string;
	chapterId: string;
	topicId?: string;
	type: QuestionType;
	prompt: string;
	context?: string;
	choices?: string[];
	correctAnswer: string;
	explanation: string;
	order: number;
	tags?: string[];
	difficulty?: string;
	isFinalAssessment: boolean;
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
	correctAnswer: string;
	explanation: string;
	order: number;
	tags?: string[];
	difficulty?: string;
}

export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
}

export interface ValidationError {
	path: string;
	message: string;
}
