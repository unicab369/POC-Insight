<script lang="ts">
	interface TimelineStep {
		label: string;
		description: string;
		indicator?: string;
		icon?: string;
	}

	const iconPaths: Record<string, string> = {
		'search': 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
		'pen-tool': 'M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.586 7.586',
		'code': 'M16 18l6-6-6-6M8 6l-6 6 6 6',
		'check-circle': 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
		'rocket': 'M13 10V3L4 14h7v7l9-11h-7z'
	};

	interface Props {
		steps: TimelineStep[];
		dotColor?: string;
		alternating?: boolean;
		orientation?: 'horizontal' | 'vertical';
		spacing?: number;
		type?: 'line' | 'stack';
		cardWidth?: number;
	}

	let { steps, dotColor = '#818cf8', alternating = false, orientation = 'horizontal', spacing = 40, type = 'line', cardWidth = 208 }: Props = $props();

	function dotClasses(hasIndicator: boolean) {
		const size = hasIndicator ? 'w-7 h-7' : 'w-4 h-4';
		return `${size} shrink-0 rounded-full ring-4 ring-slate-800 flex items-center justify-center z-10`;
	}
</script>

{#snippet dotMarker(step: TimelineStep)}
	<div
		class={dotClasses(!!step.indicator)}
		style="background-color: {dotColor};"
	>
		{#if step.indicator}
			<span class="text-xs font-bold text-white">{step.indicator}</span>
		{/if}
	</div>
{/snippet}

{#snippet stepCard(step: TimelineStep, align: 'left' | 'center' | 'right')}
	<div
		class="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 h-full
			{align === 'center' ? 'text-center' : align === 'right' ? 'text-right ml-auto' : 'text-left mr-auto'}"
		style="width: {cardWidth}px;"
	>
		{#if step.icon && iconPaths[step.icon]}
			<svg
				class="w-4 h-4 text-slate-400 mb-1 {align === 'center' ? 'mx-auto' : align === 'right' ? 'ml-auto' : ''}"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				viewBox="0 0 24 24"
			>
				<path d={iconPaths[step.icon]} />
			</svg>
		{/if}
		<p class="text-sm font-bold text-slate-200">{step.label}</p>
		<p class="text-xs text-slate-400 mt-0.5 leading-relaxed">{step.description}</p>
	</div>
{/snippet}

{#if type === 'stack'}
	{#if orientation === 'horizontal'}
		<div class="overflow-x-auto">
			<div class="flex min-w-max px-4 py-6" style="gap: {spacing}px;">
				{#each steps as step}
					<div class="flex flex-col items-stretch bg-slate-800/60 border border-slate-700/50 rounded-lg overflow-hidden" style="width: {cardWidth}px;">
						<!-- Indicator strip (top) -->
						<div
							class="flex items-center justify-center gap-2 py-3 shrink-0"
							style="background-color: {dotColor};"
						>
							{#if step.indicator}
								<span class="text-lg font-bold text-white">{step.indicator}</span>
							{/if}
							{#if step.icon && iconPaths[step.icon]}
								<svg
									class="w-4 h-4 text-white/70"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									viewBox="0 0 24 24"
								>
									<path d={iconPaths[step.icon]} />
								</svg>
							{/if}
						</div>

						<!-- Content -->
						<div class="p-3 min-w-0 flex-1">
							<p class="text-sm font-bold text-slate-200">{step.label}</p>
							<p class="text-xs text-slate-400 mt-0.5 leading-relaxed">{step.description}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<div class="flex flex-col px-4 py-6" style="gap: {spacing}px;">
			{#each steps as step}
				<div class="flex items-stretch bg-slate-800/60 border border-slate-700/50 rounded-lg overflow-hidden">
					<!-- Indicator strip (left) -->
					<div
						class="flex flex-col items-center justify-center px-4 shrink-0"
						style="background-color: {dotColor};"
					>
						{#if step.indicator}
							<span class="text-lg font-bold text-white">{step.indicator}</span>
						{/if}
						{#if step.icon && iconPaths[step.icon]}
							<svg
								class="w-4 h-4 text-white/70 {step.indicator ? 'mt-1' : ''}"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								viewBox="0 0 24 24"
							>
								<path d={iconPaths[step.icon]} />
							</svg>
						{/if}
					</div>

					<!-- Content -->
					<div class="p-3 min-w-0">
						<p class="text-sm font-bold text-slate-200">{step.label}</p>
						<p class="text-xs text-slate-400 mt-0.5 leading-relaxed">{step.description}</p>
					</div>
				</div>
			{/each}
		</div>
	{/if}
{:else if orientation === 'vertical'}
	{#if alternating}
		<!-- Vertical alternating: labels alternate left/right -->
		<div class="px-4 py-6">
			<div class="relative flex flex-col" style="gap: {spacing}px;">
				<!-- Continuous vertical line inside flex container: top=0 to bottom=0 -->
				<div class="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-slate-600"></div>
				{#each steps as step, i}
					{@const left = i % 2 === 0}
					<div class="relative grid shrink-0 w-full" style="height: 0; grid-template-columns: 1fr auto 1fr;">
						<!-- Left label area -->
						<div class="flex items-center justify-end pr-3 {left ? '' : 'invisible'}">
							<div class="h-max">
								{@render stepCard(step, 'right')}
							</div>
						</div>

						<!-- Dot -->
						<div class="flex items-center justify-center">
							{@render dotMarker(step)}
						</div>

						<!-- Right label area -->
						<div class="flex items-center pl-3 {left ? 'invisible' : ''}">
							<div class="h-max">
								{@render stepCard(step, 'left')}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<!-- Vertical non-alternating: labels all on the right -->
		<div class="px-4 py-6">
			<div class="relative flex flex-col items-center" style="gap: {spacing}px;">
				<!-- Continuous vertical line inside flex container: top=0 to bottom=0 -->
				<div class="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-slate-600"></div>
				{#each steps as step, i}
					<div class="relative grid w-full" style="grid-template-columns: 1fr auto 1fr;">
						<!-- Left spacer -->
						<div></div>

						<!-- Dot -->
						<div class="flex items-center justify-center">
							{@render dotMarker(step)}
						</div>

						<!-- Label on the right -->
						<div class="flex items-center pl-3">
							{@render stepCard(step, 'left')}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
{:else}
	<!-- Horizontal orientation -->
	<div class="overflow-x-auto">
		{#if alternating}
			<div class="px-4 py-6">
				<div class="relative flex items-stretch w-fit mx-auto" style="gap: {spacing}px;">
					<!-- Continuous horizontal line inside flex container: left=0 to right=0 -->
					<div class="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-0.5 bg-slate-600"></div>
					{#each steps as step, i}
						{@const above = i % 2 === 0}
						<div
							class="grid shrink-0"
							style="width: 0; grid-template-rows: 1fr auto 1fr;"
						>
							<!-- Top label area -->
							<div class="self-end pb-3 flex justify-center {above ? '' : 'invisible'}">
								<div class="w-max">
									{@render stepCard(step, 'center')}
								</div>
							</div>

							<!-- Dot -->
							<div class="flex items-center justify-center">
								{@render dotMarker(step)}
							</div>

							<!-- Bottom label area -->
							<div class="self-start pt-3 flex justify-center {above ? 'invisible' : ''}">
								<div class="w-max">
									{@render stepCard(step, 'center')}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{:else}
			<div class="flex items-stretch min-w-max px-4 py-6">
				{#each steps as step, i}
					<div class="flex items-stretch flex-1" style="min-width: {spacing * 3}px;">
						<div class="flex flex-col items-center w-full">
							<!-- Dot + line segment -->
							<div class="flex items-center w-full">
								<div
									class="h-0.5 flex-1"
									class:bg-slate-600={i > 0}
									class:bg-transparent={i === 0}
								></div>
								{@render dotMarker(step)}
								<div
									class="h-0.5 flex-1"
									class:bg-slate-600={i < steps.length - 1}
									class:bg-transparent={i === steps.length - 1}
								></div>
							</div>
							<!-- Label + description -->
							<div class="mt-3 px-2 flex justify-center flex-1">
								{@render stepCard(step, 'center')}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
