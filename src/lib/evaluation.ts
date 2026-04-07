import type { AnswerResult } from './types';

export function evaluateMultipleChoice(userAnswer: string, correctAnswer: string): AnswerResult {
	return userAnswer === correctAnswer ? 'correct' : 'incorrect';
}

export function evaluateFreeText(userAnswer: string, correctAnswer: string): AnswerResult {
	const normalize = (s: string) =>
		s
			.trim()
			.toLowerCase()
			.replace(/\s+/g, ' ')
			.replace(/[^\w\s]/g, '');

	return normalize(userAnswer) === normalize(correctAnswer) ? 'correct' : 'incorrect';
}

export function evaluateMultipleSelect(
	userAnswers: string[],
	correctAnswers: string[]
): AnswerResult {
	if (userAnswers.length !== correctAnswers.length) return 'incorrect';
	const sortedUser = [...userAnswers].sort();
	const sortedCorrect = [...correctAnswers].sort();
	return sortedUser.every((val, i) => val === sortedCorrect[i]) ? 'correct' : 'incorrect';
}
