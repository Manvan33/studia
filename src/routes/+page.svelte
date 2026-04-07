<script lang="ts">
	import { db } from '$lib/db';
	import type { LearningTheme, StudySession } from '$lib/types';
	import { liveQuery } from 'dexie';

	let themes = $state<LearningTheme[]>([]);
	let sessions = $state<StudySession[]>([]);
	let questionCount = $state(0);

	$effect(() => {
		const sub1 = liveQuery(() => db.themes.toArray()).subscribe({
			next: (v) => (themes = v)
		});
		const sub2 = liveQuery(() =>
			db.sessions.orderBy('createdAt').reverse().limit(5).toArray()
		).subscribe({
			next: (v) => (sessions = v)
		});
		const sub3 = liveQuery(() => db.questions.count()).subscribe({
			next: (v) => (questionCount = v)
		});

		return () => {
			sub1.unsubscribe();
			sub2.unsubscribe();
			sub3.unsubscribe();
		};
	});

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
		<p class="mt-1 text-sm text-gray-500">Your study overview at a glance</p>
	</div>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		<div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
			<p class="text-sm font-medium text-gray-500">Themes</p>
			<p class="mt-1 text-3xl font-bold text-primary-700">{themes.length}</p>
		</div>
		<div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
			<p class="text-sm font-medium text-gray-500">Questions</p>
			<p class="mt-1 text-3xl font-bold text-primary-700">{questionCount}</p>
		</div>
		<div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
			<p class="text-sm font-medium text-gray-500">Sessions</p>
			<p class="mt-1 text-3xl font-bold text-primary-700">{sessions.length}</p>
		</div>
	</div>

	{#if themes.length === 0}
		<div class="rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
			<p class="text-lg font-medium text-gray-600">No study content yet</p>
			<p class="mt-1 text-sm text-gray-400">Import a JSON study guide to get started</p>
			<a
				href="/import"
				class="mt-4 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
			>
				Import Content
			</a>
		</div>
	{:else}
		<div>
			<h2 class="mb-3 text-lg font-semibold text-gray-800">Your Themes</h2>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{#each themes as theme}
					<a
						href="/themes/{theme.id}"
						class="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
					>
						<h3 class="font-semibold text-gray-900">{theme.title}</h3>
						{#if theme.description}
							<p class="mt-1 text-sm text-gray-500">{theme.description}</p>
						{/if}
					</a>
				{/each}
			</div>
		</div>

		{#if sessions.length > 0}
			<div>
				<div class="mb-3 flex items-center justify-between">
					<h2 class="text-lg font-semibold text-gray-800">Recent Sessions</h2>
					<a href="/history" class="text-sm text-primary-600 hover:text-primary-700">View all</a>
				</div>
				<div class="space-y-2">
					{#each sessions as session}
						<a
							href="/history/{session.id}"
							class="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 transition-shadow hover:shadow-sm"
						>
							<div>
								<span
									class="inline-block rounded-full px-2 py-0.5 text-xs font-medium {session.type === 'chapter'
										? 'bg-blue-100 text-blue-700'
										: session.type === 'custom'
											? 'bg-purple-100 text-purple-700'
											: session.type === 'wrong_only'
												? 'bg-red-100 text-red-700'
												: 'bg-amber-100 text-amber-700'}"
								>
									{session.type.replace('_', ' ')}
								</span>
								<span class="ml-2 text-sm text-gray-500">{formatDate(session.createdAt)}</span>
							</div>
							<div class="text-right">
								{#if session.scoring}
									<span class="text-sm font-semibold text-gray-900"
										>{session.scoring.scorePercentage}%</span
									>
									<span class="ml-2 text-xs text-gray-400"
										>{session.scoring.correct}/{session.scoring.total}</span
									>
								{:else if session.completedAt}
									<span class="text-xs text-gray-400">Completed</span>
								{:else}
									<span class="text-xs text-warning-500">In progress</span>
								{/if}
							</div>
						</a>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
