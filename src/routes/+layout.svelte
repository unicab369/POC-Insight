<script lang="ts">
	import '../app.css';
	import '$lib/utils/chartDefaults';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>POC Insight</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="flex h-screen bg-slate-950 text-slate-200 font-[Inter,system-ui,sans-serif]">
	<Sidebar />
	<main class="flex-1 overflow-y-auto">
		{@render children()}
	</main>
</div>
