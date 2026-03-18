import { chartPalette, chartPaletteAlpha, withAlpha } from '$lib/utils/colors';

export const taskCompletion = {
	labels: ['Auth System', 'Dashboard UI', 'API Gateway', 'Mobile App', 'DevOps Pipeline', 'Documentation'],
	datasets: [
		{
			label: 'Completion %',
			data: [95, 78, 85, 62, 73, 40],
			backgroundColor: chartPaletteAlpha(0.6).slice(0, 6),
			borderColor: chartPalette.slice(0, 6),
			borderWidth: 1,
			borderRadius: 4
		}
	]
};

export const sprintVelocity = {
	datasets: [
		{
			label: 'Story Points',
			data: [
				{ x: '2024-09-16', y: 28 },
				{ x: '2024-09-30', y: 32 },
				{ x: '2024-10-14', y: 35 },
				{ x: '2024-10-28', y: 30 },
				{ x: '2024-11-11', y: 38 },
				{ x: '2024-11-25', y: 42 },
				{ x: '2024-12-09', y: 45 },
				{ x: '2024-12-23', y: 25 },
				{ x: '2025-01-06', y: 40 },
				{ x: '2025-01-20', y: 43 },
				{ x: '2025-02-03', y: 41 },
				{ x: '2025-02-17', y: 38 },
				{ x: '2025-03-03', y: 44 },
				{ x: '2025-03-17', y: 42 }
			],
			backgroundColor: withAlpha(chartPalette[2], 0.6),
			borderColor: chartPalette[2],
			borderWidth: 2
		}
	]
};

export const teamSkills = {
	labels: ['Frontend', 'Backend', 'DevOps', 'Testing', 'Design', 'Architecture'],
	datasets: [
		{
			label: 'Team Alpha',
			data: [85, 78, 65, 72, 55, 80],
			backgroundColor: withAlpha(chartPalette[0], 0.2),
			borderColor: chartPalette[0],
			borderWidth: 2,
			pointBackgroundColor: chartPalette[0],
			pointBorderColor: '#fff',
			pointHoverRadius: 6
		},
		{
			label: 'Team Beta',
			data: [70, 88, 82, 68, 75, 72],
			backgroundColor: withAlpha(chartPalette[1], 0.2),
			borderColor: chartPalette[1],
			borderWidth: 2,
			pointBackgroundColor: chartPalette[1],
			pointBorderColor: '#fff',
			pointHoverRadius: 6
		}
	]
};

export const projectStatus = {
	labels: ['Completed', 'In Progress', 'Planning', 'On Hold', 'Cancelled'],
	datasets: [
		{
			data: [12, 8, 5, 3, 1],
			backgroundColor: [
				withAlpha(chartPalette[3], 0.8),
				withAlpha(chartPalette[0], 0.8),
				withAlpha(chartPalette[4], 0.8),
				withAlpha(chartPalette[9], 0.8),
				withAlpha(chartPalette[5], 0.8)
			],
			borderColor: [chartPalette[3], chartPalette[0], chartPalette[4], chartPalette[9], chartPalette[5]],
			borderWidth: 2
		}
	]
};

export const bugStatus = [
	{ label: 'Critical', value: 3, color: '#ef4444' },
	{ label: 'High', value: 8, color: '#f97316' },
	{ label: 'Medium', value: 15, color: '#eab308' },
	{ label: 'Low', value: 22, color: '#3b82f6' },
	{ label: 'Resolved', value: 47, color: '#22c55e' }
];

export const projectStats = [
	{ label: 'Active Projects', value: '13', change: '+2 this month', changeType: 'positive' as const },
	{ label: 'Sprint Velocity', value: '42 pts', change: '+5 from last', changeType: 'positive' as const },
	{ label: 'Team Members', value: '24', change: '+3 new hires', changeType: 'positive' as const },
	{ label: 'Bug Count', value: '48', change: '-12 resolved', changeType: 'negative' as const }
];
