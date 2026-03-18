<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		subtitle?: string;
		height?: string;
		children: Snippet;
	}

	let { title, subtitle = '', height = '300px', children }: Props = $props();
</script>

<div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
	<div class="mb-4">
		<h3 class="text-sm font-medium text-slate-200">{title}</h3>
		{#if subtitle}
			<p class="text-xs text-slate-500 mt-0.5">{subtitle}</p>
		{/if}
	</div>
	<div style="height: {height}">
		{@render children()}
	</div>
</div>
