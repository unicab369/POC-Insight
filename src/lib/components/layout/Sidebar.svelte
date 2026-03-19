<script lang="ts">
	import { page } from '$app/state';
	import { sidebar } from '$lib/stores/sidebar.svelte';

	const navItems = [
		{ href: '/', label: 'Dashboard', icon: 'grid' },
		{ href: '/analytics', label: 'Analytics', icon: 'trending-up' },
		{ href: '/financial', label: 'Financial', icon: 'dollar-sign' },
		{ href: '/projects', label: 'Projects', icon: 'folder' },
		{ href: '/timeline', label: 'Timeline', icon: 'timeline' },
		{ href: '/samples', label: 'Samples', icon: 'bar-chart' },
		{ href: '/slideshow', label: 'Slideshow', icon: 'slideshow' }
	];

	const iconPaths: Record<string, string> = {
		'grid': 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
		'trending-up': 'M23 6l-9.5 9.5-5-5L1 18',
		'dollar-sign': 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
		'folder': 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
		'timeline': 'M12 2v20M5 6h14M5 12h14M5 18h14',
		'bar-chart': 'M12 20V10M18 20V4M6 20v-4',
		'slideshow': 'M4 3h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1zM8 21h8M12 17v4'
	};

	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}

	function handleNavClick() {
		sidebar.open = false;
	}
</script>

<!-- Mobile overlay -->
{#if sidebar.open}
	<button
		class="fixed inset-0 bg-black/50 z-40 md:hidden"
		onclick={() => (sidebar.open = false)}
		aria-label="Close sidebar"
	></button>
{/if}

<!-- Sidebar -->
<aside
	class="fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0
		transition-transform duration-200 ease-in-out
		md:static md:translate-x-0
		{sidebar.open ? 'translate-x-0' : '-translate-x-full'}"
>
	<div class="p-6 border-b border-slate-800">
		<h1 class="text-xl font-bold text-white tracking-tight">
			<span class="text-indigo-400">POC</span> Insight
		</h1>
		<p class="text-xs text-slate-500 mt-1">Data Visualization Dashboard</p>
	</div>

	<nav class="flex-1 p-4 space-y-1">
		{#each navItems as item}
			<a
				href={item.href}
				onclick={handleNavClick}
				class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors {isActive(item.href)
					? 'bg-indigo-500/10 text-indigo-400'
					: 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}"
			>
				<svg
					class="w-5 h-5 shrink-0"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					viewBox="0 0 24 24"
				>
					<path d={iconPaths[item.icon]} />
				</svg>
				{item.label}
			</a>
		{/each}
	</nav>

	<div class="p-4 border-t border-slate-800">
		<p class="text-xs text-slate-600 text-center">SvelteKit + Chart.js</p>
	</div>
</aside>
