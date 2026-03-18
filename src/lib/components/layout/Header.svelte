<script lang="ts">
	import { sidebar } from '$lib/stores/sidebar.svelte';

	interface Props {
		title: string;
		description?: string;
	}

	let { title, description = '' }: Props = $props();
</script>

<header class="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm px-8 py-5 flex items-center gap-4">
	<button
		class="md:hidden p-1.5 -ml-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
		onclick={() => sidebar.toggle()}
		aria-label="Open menu"
	>
		<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
			<path d="M3 12h18M3 6h18M3 18h18" />
		</svg>
	</button>
	<div>
		<h2 class="text-xl font-semibold text-white">{title}</h2>
		{#if description}
			<p class="text-sm text-slate-400 mt-1">{description}</p>
		{/if}
	</div>
</header>
