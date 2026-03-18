<script lang="ts">
	import { browser } from '$app/environment';
	import Header from '$lib/components/layout/Header.svelte';
	import ChartCard from '$lib/components/layout/ChartCard.svelte';
	import StatCard from '$lib/components/layout/StatCard.svelte';
	import BarChart from '$lib/components/charts/BarChart.svelte';
	import TimelineChart from '$lib/components/charts/TimelineChart.svelte';
	import PieChart from '$lib/components/charts/PieChart.svelte';
	import DoughnutChart from '$lib/components/charts/DoughnutChart.svelte';
	import PictographGrid from '$lib/components/charts/PictographGrid.svelte';
	import {
		revenueVsExpenses,
		cumulativeProfit,
		expenseBreakdown,
		revenueByProduct,
		revenueByRegion,
		financialStats
	} from '$lib/data/financial';
</script>

<Header title="Financial" description="Revenue, expenses, and profitability analysis" />

<div class="p-8 space-y-6">
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

	{#if browser}
		<ChartCard title="Revenue vs Expenses" subtitle="Monthly comparison" height="320px">
			<BarChart
				data={revenueVsExpenses}
				options={{
					plugins: { legend: { position: 'bottom' } },
					scales: {
						y: {
							beginAtZero: true,
							grid: { color: 'rgba(148,163,184,0.1)' },
							ticks: { callback: (value) => '$' + Number(value).toLocaleString() }
						},
						x: { grid: { display: false } }
					}
				}}
			/>
		</ChartCard>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<ChartCard title="Cumulative Profit" subtitle="12-month trend" height="300px">
				<TimelineChart
					data={cumulativeProfit}
					options={{
						scales: {
							x: {
								type: 'time',
								time: { unit: 'month', displayFormats: { month: 'MMM yyyy' } },
								grid: { display: false }
							},
							y: {
								beginAtZero: true,
								grid: { color: 'rgba(148,163,184,0.1)' },
								ticks: { callback: (value) => '$' + Number(value).toLocaleString() }
							}
						}
					}}
				/>
			</ChartCard>

			<ChartCard title="Expense Breakdown" subtitle="By category" height="300px">
				<PieChart data={expenseBreakdown} />
			</ChartCard>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<ChartCard title="Revenue by Product" subtitle="Product line distribution" height="300px">
				<DoughnutChart data={revenueByProduct} />
			</ChartCard>

			<ChartCard title="Revenue by Region" subtitle="Pictograph representation" height="300px">
				<PictographGrid items={revenueByRegion} maxIcons={12} iconSize={22} />
			</ChartCard>
		</div>
	{/if}
</div>
