<script lang="ts">
	import { browser } from '$app/environment';
	import Header from '$lib/components/layout/Header.svelte';
	import ChartCard from '$lib/components/layout/ChartCard.svelte';
	import BarChart from '$lib/components/charts/BarChart.svelte';
	import LineChart from '$lib/components/charts/LineChart.svelte';
	import PieChart from '$lib/components/charts/PieChart.svelte';
	import DoughnutChart from '$lib/components/charts/DoughnutChart.svelte';
	import RadarChart from '$lib/components/charts/RadarChart.svelte';
	import PictographGrid from '$lib/components/charts/PictographGrid.svelte';
	import TimelineChart from '$lib/components/charts/TimelineChart.svelte';
	import { createTimelineData } from '$lib/utils/formatters';
	import {
		populationData,
		temperatureData,
		languageData,
		deviceData,
		productComparison,
		medalCount
	} from '$lib/data/samples';

	// ---- createTimelineData demo with hardcoded data ----
	const serverRequests = createTimelineData(
		[
			{
				label: 'API Requests',
				color: '#6366f1',
				values: [
					{ date: '2025-03-01', value: 1200 },
					{ date: '2025-03-02', value: 1450 },
					{ date: '2025-03-03', value: 1380 },
					{ date: '2025-03-04', value: 1520 },
					{ date: '2025-03-05', value: 1690 },
					{ date: '2025-03-06', value: 1420 },
					{ date: '2025-03-07', value: 980 },
					{ date: '2025-03-08', value: 1100 },
					{ date: '2025-03-09', value: 1550 },
					{ date: '2025-03-10', value: 1780 },
					{ date: '2025-03-11', value: 1620 },
					{ date: '2025-03-12', value: 1830 },
					{ date: '2025-03-13', value: 1750 },
					{ date: '2025-03-14', value: 1200 }
				]
			},
			{
				label: 'Errors',
				color: '#ef4444',
				values: [
					{ date: '2025-03-01', value: 23 },
					{ date: '2025-03-02', value: 18 },
					{ date: '2025-03-03', value: 45 },
					{ date: '2025-03-04', value: 12 },
					{ date: '2025-03-05', value: 8 },
					{ date: '2025-03-06', value: 35 },
					{ date: '2025-03-07', value: 15 },
					{ date: '2025-03-08', value: 10 },
					{ date: '2025-03-09', value: 22 },
					{ date: '2025-03-10', value: 30 },
					{ date: '2025-03-11', value: 14 },
					{ date: '2025-03-12', value: 19 },
					{ date: '2025-03-13', value: 25 },
					{ date: '2025-03-14', value: 11 }
				]
			}
		],
		{ unit: 'day', variant: 'line' }
	);

	const monthlyRevenue = createTimelineData(
		[
			{
				label: 'Monthly Revenue',
				color: '#22c55e',
				values: [
					{ date: '2024-04-01', value: 32000 },
					{ date: '2024-05-01', value: 35500 },
					{ date: '2024-06-01', value: 38000 },
					{ date: '2024-07-01', value: 36200 },
					{ date: '2024-08-01', value: 41000 },
					{ date: '2024-09-01', value: 43500 },
					{ date: '2024-10-01', value: 47000 },
					{ date: '2024-11-01', value: 44800 },
					{ date: '2024-12-01', value: 51000 },
					{ date: '2025-01-01', value: 48500 },
					{ date: '2025-02-01', value: 53200 },
					{ date: '2025-03-01', value: 56800 }
				]
			}
		],
		{ unit: 'month', variant: 'bar', yPrefix: '$' }
	);
</script>

<Header title="Samples" description="Chart type showcase with sample datasets" />

<div class="p-8 space-y-6">
	{#if browser}
		<!-- createTimelineData demos -->
		<ChartCard title="Server Requests (Timeline Demo)" subtitle="Built with createTimelineData()" height="300px">
			<TimelineChart
				data={serverRequests.data}
				options={serverRequests.options}
				variant={serverRequests.variant}
			/>
		</ChartCard>

		<ChartCard title="Monthly Revenue (Timeline Demo)" subtitle="Bar variant with $ prefix" height="300px">
			<TimelineChart
				data={monthlyRevenue.data}
				options={monthlyRevenue.options}
				variant={monthlyRevenue.variant}
			/>
		</ChartCard>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<ChartCard title="World Population" subtitle="Top 8 countries (millions)" height="320px">
				<BarChart
					data={populationData}
					options={{ plugins: { legend: { display: false } } }}
				/>
			</ChartCard>

			<ChartCard
				title="Average Temperatures"
				subtitle="New York vs Sydney (°F)"
				height="320px"
			>
				<LineChart data={temperatureData} />
			</ChartCard>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<ChartCard
				title="Programming Languages"
				subtitle="Popularity distribution"
				height="320px"
			>
				<PieChart data={languageData} />
			</ChartCard>

			<ChartCard title="Device Usage" subtitle="Traffic by device type" height="320px">
				<DoughnutChart data={deviceData} />
			</ChartCard>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<ChartCard title="Product Comparison" subtitle="Multi-axis evaluation" height="340px">
				<RadarChart data={productComparison} />
			</ChartCard>

			<ChartCard title="Olympic Medal Count" subtitle="Top countries" height="340px">
				<PictographGrid items={medalCount} maxIcons={12} iconSize={22} />
			</ChartCard>
		</div>
	{/if}
</div>
