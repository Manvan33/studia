<script lang="ts">
	import { db } from '$lib/db';
	import type { StudySession } from '$lib/types';
	import { liveQuery } from 'dexie';

	let sessions = $state<StudySession[]>([]);

	$effect(() => {
		const sub = liveQuery(() => db.sessions.orderBy('createdAt').reverse().toArray()).subscribe({
			next: (v) => (sessions = v)
		});
		return () => sub.unsubscribe();
	});

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatDuration(ms: number | undefined): string {
		if (!ms) return '—';
		const minutes = Math.floor(ms / 60000);
		const seconds = Math.floor((ms % 60000) / 1000);
		return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
	}
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-bold text-gray-900">Session History</h1>

	{#if sessions.length === 0}
		<div class="rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
			<p class="text-lg font-medium text-gray-600">No sessions yet</p>
			<p class="mt-1 text-sm text-gray-400">Complete a study session to see your history</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each sessions as session}
				<a
					href="/history/{session.id}"
					class="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
				>
					<div class="flex items-center justify-between">
						<div>
							<span
								class="inline-block rounded-full px-2 py-0.5 text-xs font-medium {session.type ===
								'chapter'
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
						{#if session.scoring}
							<div class="text-right">
								<span class="text-lg font-bold text-gray-900"
									>{session.scoring.scorePercentage}%</span
								>
								<p class="text-xs text-gray-500">
									{session.scoring.correct}/{session.scoring.total} correct &middot;
									{formatDuration(session.scoring.durationMs)}
								</p>
							</div>
						{:else if !session.completedAt}
							<span class="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700"
								>In Progress</span
							>
						{/if}
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
