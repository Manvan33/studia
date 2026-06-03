import { nanoid } from 'nanoid';
import { db } from './db';
import type { SourceDocument, SourceDocumentKind } from './types';

const MAX_SOURCE_BYTES = 50 * 1024 * 1024; // 50 MB local cap

const ALLOWED_KINDS: Record<string, SourceDocumentKind> = {
	'application/pdf': 'pdf',
	'text/html': 'html'
};

export function detectKind(file: File): SourceDocumentKind | null {
	if (file.type && ALLOWED_KINDS[file.type]) return ALLOWED_KINDS[file.type];
	const lower = file.name.toLowerCase();
	if (lower.endsWith('.pdf')) return 'pdf';
	if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
	return null;
}

/** Add a study guide document attached to a chapter. */
export async function addSourceDocument(
	chapterId: string,
	file: File,
	title?: string
): Promise<SourceDocument> {
	const kind = detectKind(file);
	if (!kind) {
		throw new Error('Unsupported file type. Only PDF and HTML are accepted.');
	}
	if (file.size > MAX_SOURCE_BYTES) {
		throw new Error(
			`File is too large (${Math.round(file.size / 1024 / 1024)} MB). Limit is ${MAX_SOURCE_BYTES / 1024 / 1024} MB.`
		);
	}

	const now = new Date().toISOString();
	const doc: SourceDocument = {
		id: nanoid(),
		chapterId,
		title: (title ?? file.name).trim() || file.name,
		kind,
		mime: file.type || (kind === 'pdf' ? 'application/pdf' : 'text/html'),
		size: file.size,
		blob: new Blob([await file.arrayBuffer()], {
			type: file.type || (kind === 'pdf' ? 'application/pdf' : 'text/html')
		}),
		createdAt: now,
		updatedAt: now
	};
	await db.sourceDocuments.add(doc);
	return doc;
}

export async function listSourceDocuments(chapterId: string): Promise<SourceDocument[]> {
	return db.sourceDocuments.where('chapterId').equals(chapterId).sortBy('createdAt');
}

export async function getSourceDocument(id: string): Promise<SourceDocument | undefined> {
	return db.sourceDocuments.get(id);
}

export async function deleteSourceDocument(id: string): Promise<void> {
	await db.sourceDocuments.delete(id);
}

export async function renameSourceDocument(id: string, title: string): Promise<void> {
	const trimmed = title.trim();
	if (!trimmed) throw new Error('Title cannot be empty');
	await db.sourceDocuments.update(id, { title: trimmed, updatedAt: new Date().toISOString() });
}

/**
 * Best-effort lossless extraction of plain text from a source document.
 * Used to validate that an LLM-supplied quote is a substring of the original
 * material. Returns null if the document cannot be read as text on its own.
 */
export async function readSourceText(doc: SourceDocument): Promise<string | null> {
	if (doc.kind === 'html') {
		const html = await doc.blob.text();
		// Strip tags + scripts/styles. Done after parsing as inert HTML to avoid
		// executing any embedded scripts.
		const parser = new DOMParser();
		const parsed = parser.parseFromString(html, 'text/html');
		parsed.querySelectorAll('script, style, noscript').forEach((node) => node.remove());
		return parsed.body?.textContent ?? parsed.documentElement.textContent ?? '';
	}
	// PDFs need pdfjs-dist which is loaded only by the viewer; we don't load it
	// here for validation purposes to keep this module light.
	return null;
}

/** Normalise whitespace so quote validation tolerates line breaks/indentation. */
export function normaliseForQuoteMatch(text: string): string {
	return text.replace(/\s+/g, ' ').trim().toLowerCase();
}
