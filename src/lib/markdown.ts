import { marked } from 'marked';

marked.setOptions({
	breaks: true,
	gfm: true
});

/**
 * Render markdown to HTML with basic XSS sanitization.
 * Safe for this local-only app — strips script tags and event handlers.
 */
export function renderMarkdown(text: string): string {
	if (!text) return '';
	const html = marked.parse(text, { async: false }) as string;
	return sanitize(html);
}

function sanitize(html: string): string {
	return html
		.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
		.replace(/on\w+="[^"]*"/gi, '')
		.replace(/on\w+='[^']*'/gi, '');
}
