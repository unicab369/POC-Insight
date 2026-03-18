<script lang="ts">
	import { browser } from '$app/environment';
	import Header from '$lib/components/layout/Header.svelte';
	import ChartCard from '$lib/components/layout/ChartCard.svelte';
	import StatCard from '$lib/components/layout/StatCard.svelte';
	import TimelineChart from '$lib/components/charts/TimelineChart.svelte';
	import BarChart from '$lib/components/charts/BarChart.svelte';
	import DoughnutChart from '$lib/components/charts/DoughnutChart.svelte';
	import RadarChart from '$lib/components/charts/RadarChart.svelte';
	import PictographGrid from '$lib/components/charts/PictographGrid.svelte';
	import {
		dailyPageViews,
		topPages,
		trafficSources,
		engagementMetrics,
		activeUsers,
		analyticsStats
	} from '$lib/data/analytics';
</script>

<Header title="Analytics" description="Web traffic and user engagement insights" />

<div class="p-8 space-y-6">
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
		<ChartCard title="Daily Page Views" subtitle="Last 30 days" height="300px">
			<TimelineChart data={dailyPageViews} />
		</ChartCard>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<ChartCard title="Top Pages" subtitle="Views by page" height="300px">
				<BarChart data={topPages} options={{ plugins: { legend: { display: false } } }} />
			</ChartCard>

			<ChartCard title="Traffic Sources" subtitle="Distribution by channel" height="300px">
				<DoughnutChart data={trafficSources} />
			</ChartCard>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<ChartCard title="Engagement Metrics" subtitle="This month vs last month" height="320px">
				<RadarChart data={engagementMetrics} />
			</ChartCard>

			<ChartCard title="Active Users by Region" subtitle="Pictograph representation" height="320px">
				<PictographGrid items={activeUsers} maxIcons={15} iconSize={20} />
			</ChartCard>
		</div>
	{/if}
</div>
