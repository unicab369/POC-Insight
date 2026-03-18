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
	}

	let { steps, dotColor = '#818cf8', alternating = false, orientation = 'horizontal', spacing = 40, type = 'line' }: Props = $props();

	function dotClasses(hasIndicator: boolean) {
		const size = hasIndicator ? 'w-7 h-7' : 'w-4 h-4';
		return `${size} shrink-0 rounded-full ring-4 ring-slate-800 flex items-center justify-center`;
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
		class="max-w-52 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2
			{align === 'center' ? 'text-center' : align === 'right' ? 'text-right ml-auto' : 'text-left mr-auto'}"
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
					<div class="flex flex-col items-stretch bg-slate-800/60 border border-slate-700/50 rounded-lg overflow-hidden w-48">
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
						<div class="p-3 min-w-0">
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
		<div class="relative px-4 py-6">
			<div class="grid" style="grid-template-columns: 1fr auto 1fr;">
				<div></div>
				<!-- Continuous vertical line behind dots -->
				<div class="flex justify-center">
					<div class="absolute w-0.5 bg-slate-600" style="top: calc(1.5rem + {spacing / 2}px); bottom: calc(1.5rem + {spacing / 2}px);"></div>
				</div>
				<div></div>
			</div>
			<div class="relative flex flex-col" style="gap: {spacing}px;">
				{#each steps as step, i}
					{@const left = i % 2 === 0}
					<div class="grid" style="grid-template-columns: 1fr auto 1fr;">
						<!-- Left label area -->
						<div class="flex items-center justify-end pr-3 {left ? '' : 'invisible'}">
							{@render stepCard(step, 'right')}
						</div>

						<!-- Dot -->
						<div class="flex items-center justify-center">
							{@render dotMarker(step)}
						</div>

						<!-- Right label area -->
						<div class="flex items-center pl-3 {left ? 'invisible' : ''}">
							{@render stepCard(step, 'left')}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<!-- Vertical non-alternating: labels all on the right -->
		<div class="relative px-4 py-6">
			<div class="grid w-full" style="grid-template-columns: 1fr auto 1fr;">
				<div></div>
				<!-- Continuous vertical line behind dots -->
				<div class="flex justify-center">
					<div class="absolute w-0.5 bg-slate-600" style="top: calc(1.5rem + {spacing / 2}px); bottom: calc(1.5rem + {spacing / 2}px);"></div>
				</div>
				<div></div>
			</div>
			<div class="relative flex flex-col items-center" style="gap: {spacing}px;">
				{#each steps as step, i}
					<div class="grid w-full" style="grid-template-columns: 1fr auto 1fr;">
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
			<div class="flex items-stretch min-w-max px-4 py-6">
				{#each steps as step, i}
					{@const above = i % 2 === 0}
					<div
						class="flex-1 grid"
						style="min-width: {spacing * 3}px; grid-template-rows: 1fr auto 1fr;"
					>
						<!-- Top label area -->
						<div class="px-2 self-end pb-3 flex justify-center {above ? '' : 'invisible'}">
							{@render stepCard(step, 'center')}
						</div>

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

						<!-- Bottom label area -->
						<div class="px-2 self-start pt-3 flex justify-center {above ? 'invisible' : ''}">
							{@render stepCard(step, 'center')}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="flex items-start min-w-max px-4 py-6">
				{#each steps as step, i}
					<div class="flex items-start flex-1" style="min-width: {spacing * 3}px;">
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
							<div class="mt-3 px-2 flex justify-center">
								{@render stepCard(step, 'center')}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
