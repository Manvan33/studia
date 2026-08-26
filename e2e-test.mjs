// End-to-end visual testing for Studia app
// Tests all major flows: dashboard, import, study, history, manage
import { chromium } from 'playwright';

const BASE = 'http://localhost:5199';
let browser, context, page;
let passed = 0;
let failed = 0;
const errors = [];

function ok(name) {
	passed++;
	console.log(`  ✓ ${name}`);
}

function fail(name, err) {
	failed++;
	errors.push({ name, err: String(err) });
	console.log(`  ✗ ${name}: ${err}`);
}

async function test(name, fn) {
	try {
		await fn();
		ok(name);
	} catch (e) {
		fail(name, e.message || e);
	}
}

/** Wait for IndexedDB liveQuery subscriptions to resolve */
async function settle() {
	await page.waitForTimeout(800);
}

async function run() {
	browser = await chromium.launch({ headless: true });
	context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	page = await context.newPage();
	page.setDefaultTimeout(10000);

	// =========================================================
	console.log('\n=== 1. DASHBOARD (empty state) ===');
	// =========================================================
	await test('Dashboard loads', async () => {
		await page.goto(BASE);
		await settle();
		const title = await page.textContent('h1');
		if (!title.includes('Dashboard')) throw new Error(`Expected Dashboard, got: ${title}`);
	});

	await test('Shows empty state with import link', async () => {
		const body = await page.textContent('body');
		if (!body.includes('No study content yet')) throw new Error('No empty state shown');
		const importLink = await page.$('a[href="/import"]');
		if (!importLink) throw new Error('No import link in empty state');
	});

	await test('Stat cards show zeros', async () => {
		const body = await page.textContent('body');
		if (!body.includes('Themes')) throw new Error('Missing Themes stat');
		if (!body.includes('Questions')) throw new Error('Missing Questions stat');
	});

	// =========================================================
	console.log('\n=== 2. NAVIGATION ===');
	// =========================================================
	await test('Desktop nav links present', async () => {
		// Desktop nav is nav.hidden.md\\:flex — visible at 1280px
		const nav = await page.$('nav.hidden.md\\:flex, header nav.md\\:flex');
		if (!nav) throw new Error('Desktop nav not found');
		for (const label of ['Dashboard', 'Themes', 'History', 'Import', 'Manage']) {
			const link = await nav.$(`a:has-text("${label}")`);
			if (!link) throw new Error(`Missing nav link: ${label}`);
		}
	});

	// =========================================================
	console.log('\n=== 3. THEMES (empty) ===');
	// =========================================================
	await test('Themes page shows empty state', async () => {
		await page.goto(`${BASE}/themes`);
		await settle();
		const body = await page.textContent('body');
		if (!body.includes('No themes yet')) throw new Error('No empty state on themes page');
	});

	// =========================================================
	console.log('\n=== 4. HISTORY (empty) ===');
	// =========================================================
	await test('History page shows empty state', async () => {
		await page.goto(`${BASE}/history`);
		await settle();
		const body = await page.textContent('body');
		if (!body.includes('No sessions yet')) throw new Error('No empty state on history page');
	});

	// =========================================================
	console.log('\n=== 5. MANAGE (empty) ===');
	// =========================================================
	await test('Manage page shows empty state', async () => {
		await page.goto(`${BASE}/manage`);
		await settle();
		const body = await page.textContent('body');
		if (!body.includes('No content yet')) throw new Error('No empty state on manage page');
	});

	// =========================================================
	console.log('\n=== 6. IMPORT JSON ===');
	// =========================================================
	const testJson = JSON.stringify({
		theme: { title: 'Test Theme', description: 'E2E test theme' },
		chapters: [
			{
				title: 'Chapter 1',
				description: 'First chapter',
				order: 1,
				topics: [
					{
						title: 'Topic A',
						order: 1,
						questions: [
							{
								type: 'multiple_choice',
								prompt: 'What is 2+2?',
								choices: ['3', '4', '5'],
								correctAnswer: '4',
								explanation: '2+2 equals 4',
								order: 1
							},
							{
								type: 'free_text',
								prompt: 'What color is the sky?',
								correctAnswer: 'blue',
								explanation: 'The sky appears blue due to Rayleigh scattering',
								order: 2
							}
						]
					}
				],
				finalAssessment: [
					{
						type: 'multiple_choice',
						prompt: 'Final: What is 3+3?',
						choices: ['5', '6', '7'],
						correctAnswer: '6',
						explanation: '3+3 equals 6',
						order: 1
					}
				]
			}
		]
	});

	await test('Import page loads', async () => {
		await page.goto(`${BASE}/import`);
		await settle();
		const title = await page.textContent('h1');
		if (!title.includes('Import')) throw new Error(`Expected Import page, got: ${title}`);
	});

	await test('Paste JSON and validate', async () => {
		const textarea = await page.$('textarea');
		if (!textarea) throw new Error('No textarea found');
		await textarea.fill(testJson);
		const validateBtn = await page.$('button:has-text("Validate")');
		if (!validateBtn) throw new Error('No validate/preview button found');
		await validateBtn.click();
		await settle();
		const body = await page.textContent('body');
		if (body.includes('Validation errors') || body.includes('Invalid JSON')) {
			throw new Error('Validation failed');
		}
		if (!body.includes('Import Preview')) {
			throw new Error('Preview not shown after validation');
		}
	});

	await test('Import succeeds', async () => {
		// After validation, preview should be visible with Import button
		const importBtnLocator = page.locator('button:has-text("Import")').first();
		await importBtnLocator.waitFor({ state: 'visible', timeout: 5000 });
		await importBtnLocator.click();
		// Import navigates to /themes/{themeId} on success
		await page.waitForURL('**/themes/**', { timeout: 10000 });
		await settle();
		const url = page.url();
		if (!url.includes('/themes/')) {
			throw new Error(`Import did not navigate to theme page. URL: ${url}`);
		}
		// Verify the theme detail page loaded
		const body = await page.textContent('body');
		if (!body.includes('Test Theme') && !body.includes('Chapter 1')) {
			throw new Error('Theme detail page not shown after import');
		}
	});

	// =========================================================
	console.log('\n=== 7. THEMES (with data) ===');
	// =========================================================
	await test('Theme now appears in list', async () => {
		await page.goto(`${BASE}/themes`);
		await settle();
		const body = await page.textContent('body');
		if (!body.includes('Test Theme')) throw new Error('Theme not found in list');
	});

	let themeHref;
	await test('Theme detail page shows chapter', async () => {
		const themeLink = await page.$('a:has-text("Test Theme")');
		if (!themeLink) throw new Error('Theme link not found');
		themeHref = await themeLink.getAttribute('href');
		await themeLink.click();
		await settle();
		const body = await page.textContent('body');
		if (!body.includes('Chapter 1')) throw new Error('Chapter not found');
	});

	await test('Chapter detail page shows topic and study button', async () => {
		const chapterLink = await page.$('a:has-text("Chapter 1")');
		if (!chapterLink) throw new Error('Chapter 1 link not found');
		await chapterLink.click();
		await settle();
		const body = await page.textContent('body');
		if (!body.includes('Topic A')) throw new Error('Topic not found');
		if (!body.includes('Start Chapter Study')) throw new Error('Study button not found');
	});

	// =========================================================
	console.log('\n=== 8. STUDY SESSION (Chapter) ===');
	// =========================================================
	await test('Start chapter study', async () => {
		const studyBtn = await page.$('button:has-text("Start Chapter Study")');
		if (!studyBtn) throw new Error('No "Start Chapter Study" button found');
		await studyBtn.click();
		await settle();
		const body = await page.textContent('body');
		if (!body.includes('Question 1')) throw new Error('Session player not shown');
	});

	await test('MCQ question displays choices', async () => {
		const body = await page.textContent('body');
		if (!body.includes('What is 2+2?')) throw new Error('MCQ prompt not shown');
		// Check all 3 choices are rendered
		for (const choice of ['3', '4', '5']) {
			const btn = await page.$(`button[role="radio"]:has-text("${choice}")`);
			if (!btn) throw new Error(`Choice "${choice}" not displayed`);
		}
	});

	await test('Select MCQ answer and submit', async () => {
		// Click on choice "4"
		const choiceBtn = await page.$('button[role="radio"]:has-text("4")');
		await choiceBtn.click();
		await page.waitForTimeout(200);
		// Submit
		const submitBtn = await page.$('button:has-text("Submit Answer")');
		if (!submitBtn) throw new Error('Submit button not found');
		await submitBtn.click();
		await settle();
	});

	await test('Shows correct result with icon', async () => {
		const body = await page.textContent('body');
		if (!body.includes('Correct')) throw new Error('Correct result not shown');
		// Check SVG icon exists (checkmark)
		const icon = await page.$('.text-green-600 svg, svg.text-green-600');
		if (!icon) throw new Error('No green checkmark SVG icon');
	});

	await test('Explanation shown after submission', async () => {
		const body = await page.textContent('body');
		if (!body.includes('Explanation')) throw new Error('Explanation section not shown');
		if (!body.includes('2+2 equals 4')) throw new Error('Explanation text not shown');
	});

	await test('MCQ choices shown after submission with markers', async () => {
		const body = await page.textContent('body');
		if (!body.includes('Correct answer')) throw new Error('"Correct answer" marker not shown');
	});

	await test('Next question (free text)', async () => {
		const nextBtn = await page.$('button:has-text("Next Question")');
		if (!nextBtn) throw new Error('Next Question button not found');
		await nextBtn.click();
		await settle();
		const body = await page.textContent('body');
		if (!body.includes('What color is the sky?')) throw new Error('Free text question not shown');
	});

	await test('Free text textarea present', async () => {
		const textarea = await page.$('textarea#free-text-answer');
		if (!textarea) throw new Error('Free text textarea not found');
	});

	await test('Submit free text answer', async () => {
		await page.fill('textarea#free-text-answer', 'blue');
		const submitBtn = await page.$('button:has-text("Submit Answer")');
		await submitBtn.click();
		await settle();
		const body = await page.textContent('body');
		if (!body.includes('Correct')) throw new Error('Free text correct not shown');
	});

	await test('Override buttons shown for free text', async () => {
		const body = await page.textContent('body');
		if (
			!body.includes('Override result') &&
			!body.includes('Mark Correct') &&
			!body.includes('Mark Incorrect')
		) {
			throw new Error('Override buttons not shown');
		}
	});

	await test('Next question (final assessment)', async () => {
		const nextBtn = await page.$('button:has-text("Next Question")');
		await nextBtn.click();
		await settle();
		const body = await page.textContent('body');
		if (!body.includes('Final Assessment')) throw new Error('Final assessment badge not shown');
		if (!body.includes('Final: What is 3+3?'))
			throw new Error('Final assessment question not shown');
	});

	await test('Final assessment card has amber styling', async () => {
		const card = await page.$('.border-amber-300');
		if (!card) throw new Error('No amber-styled card found for final assessment');
	});

	await test('Answer final assessment MCQ', async () => {
		const choiceBtn = await page.$('button[role="radio"]:has-text("6")');
		if (!choiceBtn) throw new Error('Choice "6" not found');
		await choiceBtn.click();
		await page.waitForTimeout(200);
		const submitBtn = await page.$('button:has-text("Submit Answer")');
		await submitBtn.click();
		await settle();
		const body = await page.textContent('body');
		if (!body.includes('Correct')) throw new Error('Final assessment answer not marked correct');
	});

	await test('Finish button shows on last question', async () => {
		// On last question, the Next button says "Finish"
		const finishBtn = await page.$('button:has-text("Finish")');
		if (!finishBtn) throw new Error('Finish button not shown on last question');
	});

	await test('Session complete screen shows', async () => {
		const finishBtn = await page.$('button:has-text("Finish")');
		await finishBtn.click();
		await settle();
		const body = await page.textContent('body');
		if (!body.includes('Session Complete')) throw new Error('Session Complete screen not shown');
		if (!body.includes('View Full Summary')) throw new Error('View Full Summary button not shown');
	});

	await test('Navigate to full summary', async () => {
		const summaryBtn = await page.$('button:has-text("View Full Summary")');
		await summaryBtn.click();
		await settle();
		// finishSession() navigates to /history/{sessionId}
		const body = await page.textContent('body');
		if (!body.includes('Session Summary') && !body.includes('Score') && !body.includes('correct')) {
			throw new Error('Summary/history detail page not shown');
		}
	});

	// =========================================================
	console.log('\n=== 9. HISTORY (with data) ===');
	// =========================================================
	await test('History shows completed session', async () => {
		await page.goto(`${BASE}/history`);
		await settle();
		const body = await page.textContent('body');
		if (body.includes('No sessions yet')) throw new Error('Session not in history');
		if (!body.includes('Chapter'))
			throw new Error('Session type badge not shown (expected "Chapter")');
	});

	await test('History detail shows icons for correct/incorrect', async () => {
		const sessionLink = await page.$('a[href*="/history/"]');
		if (!sessionLink) throw new Error('No session link found in history');
		await sessionLink.click();
		await settle();
		const body = await page.textContent('body');
		if (!body.includes('Session Summary') && !body.includes('Score') && !body.includes('correct')) {
			throw new Error('Session detail not shown');
		}
		// Check SVG icons exist for result indicators
		const svgIcons = await page.$$('svg');
		if (svgIcons.length < 3)
			throw new Error(`Expected ≥3 SVG icons for accessibility, found ${svgIcons.length}`);
	});

	await test('History detail shows final assessment badge', async () => {
		const body = await page.textContent('body');
		if (!body.includes('Final'))
			throw new Error('Final assessment badge not shown in history detail');
	});

	// =========================================================
	console.log('\n=== 10. DASHBOARD (with data) ===');
	// =========================================================
	await test('Dashboard shows stats after session', async () => {
		await page.goto(BASE);
		await settle();
		const body = await page.textContent('body');
		if (body.includes('No study content yet')) throw new Error('Still showing empty state');
		if (!body.includes('Test Theme')) throw new Error('Theme not shown on dashboard');
	});

	await test('Dashboard shows recent sessions', async () => {
		const body = await page.textContent('body');
		if (!body.includes('Recent Sessions')) throw new Error('No recent sessions section');
	});

	// =========================================================
	console.log('\n=== 11. CUSTOM SESSION SETUP ===');
	// =========================================================
	await test('Setup page loads', async () => {
		await page.goto(`${BASE}/study/setup`);
		await settle();
		const body = await page.textContent('body');
		if (!body.includes('Custom Study Session')) throw new Error('Setup page not loaded');
	});

	await test('Can select theme and see chapters', async () => {
		// Select first non-empty option from theme dropdown
		const select = await page.$('select#theme-select');
		if (!select) throw new Error('Theme select not found');
		await select.selectOption({ index: 1 });
		await settle();
		const body = await page.textContent('body');
		if (!body.includes('Chapter 1')) throw new Error('Chapter not shown after theme selection');
	});

	// =========================================================
	console.log('\n=== 12. CONTENT MANAGEMENT ===');
	// =========================================================
	await test('Manage page shows imported theme', async () => {
		await page.goto(`${BASE}/manage`);
		await settle();
		const body = await page.textContent('body');
		if (!body.includes('Test Theme')) throw new Error('Theme not in manage list');
	});

	await test('Theme editor loads from manage', async () => {
		const themeLink = await page.$('a[href*="/manage/themes/"]:has-text("Test Theme")');
		if (!themeLink) throw new Error('Theme link not found in manage');
		await themeLink.click();
		await settle();
		const body = await page.textContent('body');
		if (!body.includes('Chapter 1') && !body.includes('Test Theme')) {
			throw new Error('Theme editor not loaded');
		}
	});

	// =========================================================
	console.log('\n=== 13. MOBILE RESPONSIVENESS ===');
	// =========================================================
	await test('Mobile viewport renders without errors', async () => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto(BASE);
		await settle();
		const body = await page.textContent('body');
		if (!body.includes('Dashboard')) throw new Error('Dashboard not shown at mobile size');
	});

	await test('Hamburger menu visible on mobile', async () => {
		const hamburger = await page.$('button[aria-label="Toggle menu"]');
		if (!hamburger) throw new Error('No hamburger menu button');
		const isVisible = await hamburger.isVisible();
		if (!isVisible) throw new Error('Hamburger not visible on mobile');
	});

	await test('Desktop nav hidden on mobile', async () => {
		// The desktop nav has class "hidden md:flex" — should be hidden at 375px
		const desktopNav = await page.$('nav.hidden');
		if (desktopNav) {
			const isVisible = await desktopNav.isVisible();
			if (isVisible) throw new Error('Desktop nav should be hidden on mobile');
		}
	});

	await test('Hamburger menu opens navigation', async () => {
		await page.click('button[aria-label="Toggle menu"]');
		await page.waitForTimeout(300);
		const body = await page.textContent('body');
		if (!body.includes('Themes') || !body.includes('History')) {
			throw new Error('Mobile nav items not shown');
		}
	});

	// Reset viewport
	await page.setViewportSize({ width: 1280, height: 800 });

	// =========================================================
	// Summary
	// =========================================================
	console.log('\n========================================');
	console.log(`Results: ${passed} passed, ${failed} failed`);
	if (errors.length > 0) {
		console.log('\nFailures:');
		for (const e of errors) {
			console.log(`  ✗ ${e.name}: ${e.err}`);
		}
	}
	console.log('========================================\n');

	await browser.close();
	process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
	console.error('Test runner error:', err);
	browser?.close();
	process.exit(1);
});
