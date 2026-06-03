import Dexie, { type EntityTable } from 'dexie';
import type {
	LearningTheme,
	Chapter,
	Topic,
	Question,
	StudySession,
	SessionAnswer,
	QuestionProgress,
	SourceDocument
} from './types';

const db = new Dexie('StudiaDB') as Dexie & {
	themes: EntityTable<LearningTheme, 'id'>;
	chapters: EntityTable<Chapter, 'id'>;
	topics: EntityTable<Topic, 'id'>;
	questions: EntityTable<Question, 'id'>;
	sessions: EntityTable<StudySession, 'id'>;
	sessionAnswers: EntityTable<SessionAnswer, 'id'>;
	questionProgress: EntityTable<QuestionProgress, 'questionId'>;
	sourceDocuments: EntityTable<SourceDocument, 'id'>;
};

db.version(1).stores({
	themes: 'id, title, createdAt',
	chapters: 'id, themeId, order, createdAt',
	topics: 'id, chapterId, order, createdAt',
	questions: 'id, chapterId, topicId, order, isFinalAssessment',
	sessions: 'id, type, createdAt, completedAt',
	sessionAnswers: 'id, sessionId, questionId, answeredAt',
	questionProgress: 'questionId, lastAnsweredAt'
});

// v2: source documents (study guide PDFs/HTML attached per chapter)
db.version(2).stores({
	sourceDocuments: 'id, chapterId, createdAt'
});

export { db };
