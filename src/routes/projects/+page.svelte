<script lang="ts">
	import { browser } from '$app/environment';
	import Header from '$lib/components/layout/Header.svelte';
	import ChartCard from '$lib/components/layout/ChartCard.svelte';
	import StatCard from '$lib/components/layout/StatCard.svelte';
	import BarChart from '$lib/components/charts/BarChart.svelte';
	import TimelineChart from '$lib/components/charts/TimelineChart.svelte';
	import RadarChart from '$lib/components/charts/RadarChart.svelte';
	import PieChart from '$lib/components/charts/PieChart.svelte';
	import PictographGrid from '$lib/components/charts/PictographGrid.svelte';
	import {
		taskCompletion,
		sprintVelocity,
		teamSkills,
		projectStatus,
		bugStatus,
		projectStats
	} from '$lib/data/projects';
</script>

<Header title="Projects" description="Project management and team performance" />

<div class="p-8 space-y-6">
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
		{#each projectStats as stat}
			<StatCard
				label={stat.label}
				value={stat.value}
				change={stat.change}
				changeType={stat.changeType}
			/>
		{/each}
	</div>

	{#if browser}
		<ChartCard title="Task Completion" subtitle="By project" height="300px">
			<BarChart
				data={taskCompletion}
				options={{
					indexAxis: 'y',
					plugins: { legend: { display: false } },
					scales: {
						x: {
							beginAtZero: true,
							max: 100,
							grid: { color: 'rgba(148,163,184,0.1)' },
							ticks: { callback: (value) => value + '%' }
						},
						y: { grid: { display: false } }
					}
				}}
			/>
		</ChartCard>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<ChartCard title="Sprint Velocity" subtitle="Story points per sprint" height="300px">
				<TimelineChart
					data={sprintVelocity}
					variant="bar"
					options={{
						scales: {
							x: {
								type: 'time',
								time: { unit: 'week', displayFormats: { week: 'MMM d' } },
								grid: { display: false }
							},
							y: {
								beginAtZero: true,
								grid: { color: 'rgba(148,163,184,0.1)' }
							}
						}
					}}
				/>
			</ChartCard>

			<ChartCard title="Team Skills" subtitle="Team Alpha vs Team Beta" height="300px">
				<RadarChart data={teamSkills} />
			</ChartCard>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<ChartCard title="Project Status" subtitle="Distribution overview" height="300px">
				<PieChart data={projectStatus} />
			</ChartCard>

			<ChartCard title="Bug Status" subtitle="By severity" height="300px">
				<PictographGrid items={bugStatus} maxIcons={15} iconSize={18} />
			</ChartCard>
		</div>
	{/if}
</div>
