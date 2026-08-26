import test from 'node:test';
import assert from 'node:assert';
import { renderMarkdown } from './markdown.ts';

test('renderMarkdown: returns empty string for null/undefined/empty input', () => {
	// @ts-ignore
	assert.strictEqual(renderMarkdown(null), '');
	// @ts-ignore
	assert.strictEqual(renderMarkdown(undefined), '');
	assert.strictEqual(renderMarkdown(''), '');
});

test('renderMarkdown: basic markdown rendering', () => {
	// We expect the output to contain HTML tags if marked is working correctly.
	// Since we are primarily testing sanitization, we check that it doesn't break basic content.
	const input = 'Hello **world**';
	const output = renderMarkdown(input);
	assert.ok(output.includes('Hello'));
	assert.ok(output.includes('world'));
});

test('renderMarkdown: sanitizes simple script tags', () => {
	const input = 'Before <script>alert("xss")</script> After';
	const output = renderMarkdown(input);
	assert.ok(!output.includes('<script'));
	assert.ok(!output.includes('alert'));
});

test('renderMarkdown: sanitizes script tags with attributes', () => {
	const input = '<script src="http://evil.com/xss.js"></script>';
	const output = renderMarkdown(input);
	assert.strictEqual(output, '');
});

test('renderMarkdown: sanitizes nested script tags or complex content', () => {
	const input = '<script>const s = "<script></script>";</script>';
	const output = renderMarkdown(input);
	assert.ok(!output.includes('<script'));
	assert.ok(!output.includes('</script>'));
});

test('renderMarkdown: sanitizes event handlers (double quotes)', () => {
	const input = '<img src="x" onerror="alert(1)" onload="clean()">';
	const output = renderMarkdown(input);
	assert.ok(!output.includes('onerror'));
	assert.ok(!output.includes('onload'));
	assert.ok(output.includes('src="x"'));
});

test('renderMarkdown: sanitizes event handlers (single quotes)', () => {
	const input = "<button onclick='doEvil()'>Click me</button>";
	const output = renderMarkdown(input);
	assert.ok(!output.includes('onclick'));
	assert.ok(output.includes('Click me'));
});

test('renderMarkdown: sanitizes event handlers (case insensitive)', () => {
	const input = '<a onMouseOver="run()">Link</a>';
	const output = renderMarkdown(input);
	assert.ok(!output.includes('onMouseOver'));
	assert.ok(output.includes('Link'));
});

test('renderMarkdown: preserves legitimate attributes', () => {
	const input = '<a href="https://example.com" class="link" id="test">Example</a>';
	const output = renderMarkdown(input);
	assert.ok(output.includes('href="https://example.com"'));
	assert.ok(output.includes('class="link"'));
	assert.ok(output.includes('id="test"'));
});

test('renderMarkdown: handles mixed content', () => {
	const input = 'Check out this <script>alert(1)</script> <img src="safe.png" onload="evil()">';
	const output = renderMarkdown(input);
	assert.ok(!output.includes('<script'));
	assert.ok(!output.includes('onload'));
	assert.ok(output.includes('src="safe.png"'));
});
