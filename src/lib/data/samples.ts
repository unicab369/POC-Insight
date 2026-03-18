import { chartPalette, chartPaletteAlpha, withAlpha } from '$lib/utils/colors';

export const populationData = {
	labels: ['China', 'India', 'USA', 'Indonesia', 'Pakistan', 'Brazil', 'Nigeria', 'Bangladesh'],
	datasets: [
		{
			label: 'Population (millions)',
			data: [1412, 1408, 331, 273, 225, 213, 211, 166],
			backgroundColor: chartPaletteAlpha(0.6).slice(0, 8),
			borderColor: chartPalette.slice(0, 8),
			borderWidth: 2,
			borderRadius: 6
		}
	]
};

export const temperatureData = {
	labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
	datasets: [
		{
			label: 'New York',
			data: [33, 36, 45, 55, 66, 75, 80, 79, 71, 60, 49, 38],
			backgroundColor: withAlpha(chartPalette[0], 0.2),
			borderColor: chartPalette[0],
			borderWidth: 2,
			fill: true,
			tension: 0.4
		},
		{
			label: 'Sydney',
			data: [79, 79, 75, 68, 62, 57, 55, 58, 62, 67, 72, 77],
			backgroundColor: withAlpha(chartPalette[7], 0.2),
			borderColor: chartPalette[7],
			borderWidth: 2,
			fill: true,
			tension: 0.4
		}
	]
};

export const languageData = {
	labels: ['JavaScript', 'Python', 'Java', 'TypeScript', 'C#', 'PHP', 'Other'],
	datasets: [
		{
			label: 'Popularity (%)',
			data: [24, 21, 16, 12, 9, 6, 12],
			backgroundColor: chartPaletteAlpha(0.8).slice(0, 7),
			borderColor: chartPalette.slice(0, 7),
			borderWidth: 2
		}
	]
};

export const deviceData = {
	labels: ['Desktop', 'Mobile', 'Tablet', 'Smart TV', 'Other'],
	datasets: [
		{
			label: 'Usage (%)',
			data: [42, 38, 12, 5, 3],
			backgroundColor: chartPaletteAlpha(0.8).slice(0, 5),
			borderColor: chartPalette.slice(0, 5),
			borderWidth: 2
		}
	]
};

export const productComparison = {
	labels: ['Performance', 'Reliability', 'Features', 'Support', 'Price', 'UX'],
	datasets: [
		{
			label: 'Product A',
			data: [85, 90, 75, 80, 60, 88],
			backgroundColor: withAlpha(chartPalette[0], 0.2),
			borderColor: chartPalette[0],
			borderWidth: 2,
			pointBackgroundColor: chartPalette[0],
			pointBorderColor: '#fff',
			pointHoverRadius: 6
		},
		{
			label: 'Product B',
			data: [75, 80, 90, 70, 85, 78],
			backgroundColor: withAlpha(chartPalette[3], 0.2),
			borderColor: chartPalette[3],
			borderWidth: 2,
			pointBackgroundColor: chartPalette[3],
			pointBorderColor: '#fff',
			pointHoverRadius: 6
		},
		{
			label: 'Product C',
			data: [70, 75, 85, 95, 90, 82],
			backgroundColor: withAlpha(chartPalette[7], 0.2),
			borderColor: chartPalette[7],
			borderWidth: 2,
			pointBackgroundColor: chartPalette[7],
			pointBorderColor: '#fff',
			pointHoverRadius: 6
		}
	]
};

export const medalCount = [
	{ label: 'USA', value: 113, color: '#fbbf24' },
	{ label: 'China', value: 88, color: '#ef4444' },
	{ label: 'UK', value: 65, color: '#3b82f6' },
	{ label: 'Japan', value: 58, color: '#dc2626' },
	{ label: 'Australia', value: 46, color: '#22c55e' }
];

export const projectSteps = [
	{ indicator: '1', icon: 'search', label: 'Research', description: 'Conduct in-depth market analysis, competitor benchmarking, and stakeholder interviews to identify key pain points and validate the product hypothesis before moving forward' },
	{ indicator: '2', icon: 'pen-tool', label: 'Design', description: 'Create low-fidelity wireframes, interactive prototypes, and a comprehensive design system covering typography, color palette, spacing, and reusable component patterns for consistency' },
	{ indicator: '3', icon: 'code', label: 'Develop', description: 'Build the frontend with SvelteKit and Tailwind CSS, implement REST API endpoints, set up the database schema, and integrate third-party services for authentication and payments' },
	{ indicator: '4', icon: 'check-circle', label: 'Test', description: 'Run automated unit and integration test suites, perform manual QA across browsers and devices, conduct user acceptance testing sessions, and resolve all critical and major defects' },
	{ indicator: '5', icon: 'rocket', label: 'Launch', description: 'Deploy to production infrastructure with CI/CD pipelines, configure monitoring and alerting dashboards, execute the go-to-market communications plan, and begin collecting user feedback' }
];
