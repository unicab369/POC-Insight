<script lang="ts">
	interface TimelineStep {
		label: string;
		description: string;
	}

	interface Props {
		steps: TimelineStep[];
		dotColor?: string;
		shape?: 'circle' | 'square' | 'diamond';
		alternating?: boolean;
		orientation?: 'horizontal' | 'vertical';
		lineLength?: number;
	}

	let { steps, dotColor = '#818cf8', shape = 'circle', alternating = false, orientation = 'horizontal', lineLength = 40 }: Props = $props();

	function dotClasses(s: typeof shape) {
		const base = 'w-4 h-4 shrink-0 ring-4 ring-slate-800';
		if (s === 'square') return `${base} rounded-sm`;
		if (s === 'diamond') return `${base} rounded-sm rotate-45`;
		return `${base} rounded-full`;
	}
</script>

{#if orientation === 'vertical'}
	{#if alternating}
		<!-- Vertical alternating: labels alternate left/right -->
		<div class="flex flex-col px-4 py-6">
			{#each steps as step, i}
				{@const left = i % 2 === 0}
				<div class="grid" style="grid-template-columns: 1fr auto 1fr;">
					<!-- Left label area -->
					<div class="flex items-center justify-end pr-3 {left ? '' : 'invisible'}">
						<div class="text-right">
							<p class="text-sm font-bold text-slate-200">{step.label}</p>
							<p class="text-xs text-slate-400 mt-0.5">{step.description}</p>
						</div>
					</div>

					<!-- Dot + vertical line segments -->
					<div class="flex flex-col items-center">
						<div
							class="w-0.5"
							style="height: {lineLength}px;"
							class:bg-slate-600={i > 0}
							class:bg-transparent={i === 0}
						></div>
						<div
							class={dotClasses(shape)}
							style="background-color: {dotColor};"
						></div>
						<div
							class="w-0.5"
							style="height: {lineLength}px;"
							class:bg-slate-600={i < steps.length - 1}
							class:bg-transparent={i === steps.length - 1}
						></div>
					</div>

					<!-- Right label area -->
					<div class="flex items-center pl-3 {left ? 'invisible' : ''}">
						<div class="text-left">
							<p class="text-sm font-bold text-slate-200">{step.label}</p>
							<p class="text-xs text-slate-400 mt-0.5">{step.description}</p>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<!-- Vertical non-alternating: labels all on the right -->
		<div class="flex flex-col items-center px-4 py-6">
			{#each steps as step, i}
				<div class="grid w-full" style="grid-template-columns: 1fr auto 1fr;">
					<!-- Left spacer -->
					<div></div>

					<!-- Dot + vertical line segments -->
					<div class="flex flex-col items-center">
						<div
							class="w-0.5"
							style="height: {lineLength}px;"
							class:bg-slate-600={i > 0}
							class:bg-transparent={i === 0}
						></div>
						<div
							class={dotClasses(shape)}
							style="background-color: {dotColor};"
						></div>
						<div
							class="w-0.5"
							style="height: {lineLength}px;"
							class:bg-slate-600={i < steps.length - 1}
							class:bg-transparent={i === steps.length - 1}
						></div>
					</div>

					<!-- Label on the right -->
					<div class="flex items-center pl-3">
						<div class="text-left">
							<p class="text-sm font-bold text-slate-200">{step.label}</p>
							<p class="text-xs text-slate-400 mt-0.5">{step.description}</p>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
{:else}
	<!-- Horizontal orientation (existing behavior) -->
	<div class="overflow-x-auto">
		{#if alternating}
			<div class="flex items-stretch min-w-max px-4 py-6">
				{#each steps as step, i}
					{@const above = i % 2 === 0}
					<div
						class="flex-1 grid"
						style="min-width: {lineLength * 3}px; grid-template-rows: 1fr auto 1fr;"
					>
						<!-- Top label area -->
						<div class="text-center px-2 self-end pb-3 {above ? '' : 'invisible'}">
							<p class="text-sm font-bold text-slate-200">{step.label}</p>
							<p class="text-xs text-slate-400 mt-0.5">{step.description}</p>
						</div>

						<!-- Dot + line segment -->
						<div class="flex items-center w-full">
							<div
								class="h-0.5 flex-1"
								class:bg-slate-600={i > 0}
								class:bg-transparent={i === 0}
							></div>
							<div
								class={dotClasses(shape)}
								style="background-color: {dotColor};"
							></div>
							<div
								class="h-0.5 flex-1"
								class:bg-slate-600={i < steps.length - 1}
								class:bg-transparent={i === steps.length - 1}
							></div>
						</div>

						<!-- Bottom label area -->
						<div class="text-center px-2 self-start pt-3 {above ? 'invisible' : ''}">
							<p class="text-sm font-bold text-slate-200">{step.label}</p>
							<p class="text-xs text-slate-400 mt-0.5">{step.description}</p>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="flex items-start min-w-max px-4 py-6">
				{#each steps as step, i}
					<div class="flex items-start flex-1" style="min-width: {lineLength * 3}px;">
						<div class="flex flex-col items-center w-full">
							<!-- Dot + line segment -->
							<div class="flex items-center w-full">
								<div
									class="h-0.5 flex-1"
									class:bg-slate-600={i > 0}
									class:bg-transparent={i === 0}
								></div>
								<div
									class={dotClasses(shape)}
									style="background-color: {dotColor};"
								></div>
								<div
									class="h-0.5 flex-1"
									class:bg-slate-600={i < steps.length - 1}
									class:bg-transparent={i === steps.length - 1}
								></div>
							</div>
							<!-- Label + description -->
							<div class="mt-3 text-center px-2">
								<p class="text-sm font-bold text-slate-200">{step.label}</p>
								<p class="text-xs text-slate-400 mt-0.5">{step.description}</p>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
