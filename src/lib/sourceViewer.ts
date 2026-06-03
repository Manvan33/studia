import type { SourceLocator } from './types';

export interface SourceViewerRequest {
	chapterId: string;
	documentId?: string;
	locator?: SourceLocator;
	quote?: string;
}

type Listener = (req: SourceViewerRequest | null) => void;

let current: SourceViewerRequest | null = null;
const listeners = new Set<Listener>();

export const sourceViewer = {
	/** Open the side panel for a given chapter / document / locator. */
	show(req: SourceViewerRequest) {
		current = req;
		listeners.forEach((l) => l(current));
	},
	close() {
		current = null;
		listeners.forEach((l) => l(null));
	},
	subscribe(l: Listener): () => void {
		listeners.add(l);
		l(current);
		return () => listeners.delete(l);
	},
	get current() {
		return current;
	}
};
