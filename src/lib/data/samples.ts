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
