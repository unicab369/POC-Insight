<script lang="ts">
	import Header from '$lib/components/layout/Header.svelte';
	import ProgressTimeline from '$lib/components/layout/ProgressTimeline.svelte';
	import { chartPalette } from '$lib/utils/colors';

	let timelineShape = $state<'circle' | 'square' | 'diamond'>('circle');
	let timelineColor = $state('#818cf8');
	let timelineAlternating = $state(false);
	let timelineOrientation = $state<'horizontal' | 'vertical'>('horizontal');
	let timelineLineLength = $state(40);

	const shapes: Array<{ value: 'circle' | 'square' | 'diamond'; label: string }> = [
		{ value: 'circle', label: 'Circle' },
		{ value: 'square', label: 'Square' },
		{ value: 'diamond', label: 'Diamond' }
	];

	const projectSteps = [
		{ label: 'Step 1: Research', description: 'Market analysis and user interviews' },
		{ label: 'Step 2: Design', description: 'Wireframes and prototypes' },
		{ label: 'Step 3: Develop', description: 'Frontend and backend implementation' },
		{ label: 'Step 4: Test', description: 'QA and user acceptance testing' },
		{ label: 'Step 5: Launch', description: 'Production deployment' }
	];
</script>

<Header title="Timeline" description="Progress timeline component with live preview" />

<div class="p-8">
	<div class="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
		<!-- Settings panel -->
		<div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-6 h-fit">
			<h3 class="text-sm font-semibold text-slate-200">Settings</h3>

			<!-- Orientation -->
			<div class="space-y-2">
				<span class="text-xs text-slate-400 font-medium uppercase tracking-wider">Orientation</span>
				<div class="flex gap-2">
					{#each [{ value: 'horizontal', label: 'Horizontal' }, { value: 'vertical', label: 'Vertical' }] as o}
						<button
							class="flex-1 px-3 py-2 text-xs rounded-lg transition-all {timelineOrientation === o.value
								? 'bg-slate-700 text-white ring-2 ring-indigo-400'
								: 'bg-slate-800 text-slate-400 hover:text-slate-200'}"
							onclick={() => (timelineOrientation = o.value as 'horizontal' | 'vertical')}
						>
							{o.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Shape -->
			<div class="space-y-2">
				<span class="text-xs text-slate-400 font-medium uppercase tracking-wider">Shape</span>
				<div class="flex gap-2">
					{#each shapes as s}
						<button
							class="flex-1 px-3 py-2 text-xs rounded-lg transition-all {timelineShape === s.value
								? 'bg-slate-700 text-white ring-2 ring-indigo-400'
								: 'bg-slate-800 text-slate-400 hover:text-slate-200'}"
							onclick={() => (timelineShape = s.value)}
						>
							{s.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Color -->
			<div class="space-y-2">
				<span class="text-xs text-slate-400 font-medium uppercase tracking-wider">Color</span>
				<div class="flex flex-wrap gap-2">
					{#each chartPalette as color}
						<button
							aria-label="Select color {color}"
							class="w-7 h-7 rounded-full transition-all {timelineColor === color
								? 'ring-2 ring-offset-2 ring-offset-slate-900 ring-indigo-400 scale-110'
								: 'hover:scale-110'}"
							style="background-color: {color};"
							onclick={() => (timelineColor = color)}
						></button>
					{/each}
				</div>
			</div>

			<!-- Alternating -->
			<div class="space-y-2">
				<span class="text-xs text-slate-400 font-medium uppercase tracking-wider">Alternating</span>
				<button
					class="w-full px-3 py-2 text-xs rounded-lg transition-all {timelineAlternating
						? 'bg-indigo-500 text-white ring-2 ring-indigo-400'
						: 'bg-slate-800 text-slate-400 hover:text-slate-200'}"
					onclick={() => (timelineAlternating = !timelineAlternating)}
				>
					{timelineAlternating ? 'On' : 'Off'}
				</button>
			</div>
		</div>

		<!-- Preview -->
		<div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
			<h3 class="text-sm font-semibold text-slate-200 mb-4">Preview</h3>
			<ProgressTimeline
				steps={projectSteps}
				dotColor={timelineColor}
				shape={timelineShape}
				alternating={timelineAlternating}
				orientation={timelineOrientation}
			/>
		</div>
	</div>
</div>
