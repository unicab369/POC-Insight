<script lang="ts">
	import Header from '$lib/components/layout/Header.svelte';
	import ProgressTimeline from '$lib/components/layout/ProgressTimeline.svelte';
	import { chartPalette } from '$lib/utils/colors';
	import { projectSteps } from '$lib/data/samples';

	let timelineType = $state<'line' | 'stack'>('line');
	let timelineColor = $state('#818cf8');
	let timelineAlternating = $state(false);
	let timelineOrientation = $state<'horizontal' | 'vertical'>('horizontal');
	let timelineSpacing = $state(200);
	let timelineCardWidth = $state(208);
</script>

<Header title="Timeline" description="Progress timeline component with live preview" />

<div class="p-8">
	<div class="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
		<!-- Settings panel -->
		<div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-6 h-fit">
			<h3 class="text-sm font-semibold text-slate-200">Settings</h3>

			<!-- Type -->
			<div class="space-y-2">
				<span class="text-xs text-slate-400 font-medium uppercase tracking-wider">Type</span>
				<div class="flex gap-2">
					{#each [{ value: 'line', label: 'Line' }, { value: 'stack', label: 'Stack' }] as t}
						<button
							class="flex-1 px-3 py-2 text-xs rounded-lg transition-all {timelineType === t.value
								? 'bg-slate-700 text-white ring-2 ring-indigo-400'
								: 'bg-slate-800 text-slate-400 hover:text-slate-200'}"
							onclick={() => (timelineType = t.value as 'line' | 'stack')}
						>
							{t.label}
						</button>
					{/each}
				</div>
			</div>

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

			<!-- Alternating (Line type only) -->
			{#if timelineType === 'line'}
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
			{/if}

			<!-- Spacing -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<span class="text-xs text-slate-400 font-medium uppercase tracking-wider">Spacing</span>
					<span class="text-xs text-slate-300 tabular-nums">{timelineSpacing}px</span>
				</div>
				<input
					type="range"
					min="0"
					max="300"
					bind:value={timelineSpacing}
					class="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-slate-700
						[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
						[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-400
						[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md"
				/>
			</div>

			<!-- Card Width -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<span class="text-xs text-slate-400 font-medium uppercase tracking-wider">Card Width</span>
					<span class="text-xs text-slate-300 tabular-nums">{timelineCardWidth}px</span>
				</div>
				<input
					type="range"
					min="150"
					max="300"
					bind:value={timelineCardWidth}
					class="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-slate-700
						[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
						[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-400
						[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md"
				/>
			</div>
		</div>

		<!-- Preview -->
		<div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
			<h3 class="text-sm font-semibold text-slate-200 mb-4">Preview</h3>
			<ProgressTimeline
				steps={projectSteps}
				type={timelineType}
				dotColor={timelineColor}
				alternating={timelineAlternating}
				orientation={timelineOrientation}
				spacing={timelineSpacing}
				cardWidth={timelineCardWidth}
			/>
		</div>
	</div>
</div>
