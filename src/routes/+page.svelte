<script lang="ts">
	import { browser } from '$app/environment';
	import Header from '$lib/components/layout/Header.svelte';
	import StatCard from '$lib/components/layout/StatCard.svelte';
	import ChartCard from '$lib/components/layout/ChartCard.svelte';
	import LineChart from '$lib/components/charts/LineChart.svelte';
	import BarChart from '$lib/components/charts/BarChart.svelte';
	import DoughnutChart from '$lib/components/charts/DoughnutChart.svelte';
	import { analyticsStats, dailyPageViews, trafficSources } from '$lib/data/analytics';
	import { revenueVsExpenses, financialStats } from '$lib/data/financial';
</script>

<svelte:head>
	<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
</svelte:head>

<svelte:document onwheel={(e) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }} />

<Header title="Dashboard" description="Overview of key metrics and trends" />

<div class="p-8 space-y-6">
	<!-- Stat Cards -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
		{#each analyticsStats as stat}
			<StatCard
				label={stat.label}
				value={stat.value}
				change={stat.change}
				changeType={stat.changeType}
			/>
		{/each}
	</div>

	{#if browser}
		<!-- Chart Row -->
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<ChartCard title="Traffic Overview" subtitle="Daily page views (30 days)" height="280px">
				<LineChart
					data={dailyPageViews}
					options={{
						plugins: { legend: { display: false } },
						scales: {
							x: { display: false },
							y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,0.1)' } }
						}
					}}
				/>
			</ChartCard>

			<ChartCard title="Monthly Revenue" subtitle="Revenue vs Expenses" height="280px">
				<BarChart
					data={revenueVsExpenses}
					options={{
						plugins: { legend: { position: 'bottom' } },
						scales: {
							y: {
								beginAtZero: true,
								grid: { color: 'rgba(148,163,184,0.1)' },
								ticks: {
									callback: (value) => '$' + Number(value).toLocaleString()
								}
							},
							x: { grid: { display: false } }
						}
					}}
				/>
			</ChartCard>

			<ChartCard title="Traffic Sources" subtitle="Distribution by channel" height="280px">
				<DoughnutChart data={trafficSources} />
			</ChartCard>
		</div>

		<!-- Bottom row with financial stats -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
			{#each financialStats as stat}
				<StatCard
					label={stat.label}
					value={stat.value}
					change={stat.change}
					changeType={stat.changeType}
				/>
			{/each}
		</div>
	{/if}
</div>
