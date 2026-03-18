import { chartPalette, chartPaletteAlpha, withAlpha } from '$lib/utils/colors';

function generatePast30Days(): string[] {
	const dates: string[] = [];
	const today = new Date('2025-03-18');
	for (let i = 29; i >= 0; i--) {
		const date = new Date(today);
		date.setDate(date.getDate() - i);
		dates.push(date.toISOString().split('T')[0]);
	}
	return dates;
}

const pageViewValues = [
	3200, 2800, 2900, 3100, 3400, 3800, 4200,
	3900, 3400, 3600, 3800, 4100, 4400, 4800,
	4500, 4100, 4200, 4300, 4600, 4900, 5000,
	4700, 4300, 4400, 4500, 4700, 4800, 4900,
	4600, 4400
];

const dates30 = generatePast30Days();

export const dailyPageViews = {
	datasets: [
		{
			label: 'Page Views',
			data: dates30.map((date, i) => ({ x: date, y: pageViewValues[i] })),
			backgroundColor: withAlpha(chartPalette[0], 0.2),
			borderColor: chartPalette[0],
			borderWidth: 2,
			fill: true,
			tension: 0.4,
			pointRadius: 3,
			pointHoverRadius: 5
		}
	]
};

export const topPages = {
	labels: ['Home', 'Products', 'Blog', 'About', 'Contact', 'Pricing', 'Docs', 'Login'],
	datasets: [
		{
			label: 'Page Views',
			data: [4500, 3800, 3200, 2100, 1800, 2900, 2400, 950],
			backgroundColor: chartPaletteAlpha(0.6).slice(0, 8),
			borderColor: chartPalette.slice(0, 8),
			borderWidth: 2,
			borderRadius: 6
		}
	]
};

export const trafficSources = {
	labels: ['Organic Search', 'Direct', 'Social Media', 'Referral', 'Email', 'Paid Ads'],
	datasets: [
		{
			label: 'Traffic Share',
			data: [35, 25, 18, 12, 7, 3],
			backgroundColor: chartPaletteAlpha(0.8).slice(0, 6),
			borderColor: chartPalette.slice(0, 6),
			borderWidth: 2,
			hoverOffset: 10
		}
	]
};

export const engagementMetrics = {
	labels: ['Bounce Rate', 'Session Duration', 'Pages/Session', 'Return Rate', 'Conversion', 'Satisfaction'],
	datasets: [
		{
			label: 'This Month',
			data: [68, 75, 82, 71, 65, 78],
			backgroundColor: withAlpha(chartPalette[0], 0.2),
			borderColor: chartPalette[0],
			borderWidth: 2,
			pointBackgroundColor: chartPalette[0],
			pointBorderColor: '#fff',
			pointRadius: 4,
			pointHoverRadius: 6
		},
		{
			label: 'Last Month',
			data: [72, 68, 75, 65, 58, 70],
			backgroundColor: withAlpha(chartPalette[1], 0.2),
			borderColor: chartPalette[1],
			borderWidth: 2,
			pointBackgroundColor: chartPalette[1],
			pointBorderColor: '#fff',
			pointRadius: 4,
			pointHoverRadius: 6
		}
	]
};

export const activeUsers = [
	{ label: 'Americas', value: 45800, color: chartPalette[0] },
	{ label: 'Europe', value: 38200, color: chartPalette[1] },
	{ label: 'Asia Pacific', value: 52400, color: chartPalette[3] },
	{ label: 'Middle East', value: 18600, color: chartPalette[4] },
	{ label: 'Africa', value: 12300, color: chartPalette[5] }
];

export const analyticsStats = [
	{ label: 'Total Visitors', value: '167,300', change: '+12.5%', changeType: 'positive' as const },
	{ label: 'Page Views', value: '423,800', change: '+8.2%', changeType: 'positive' as const },
	{ label: 'Avg. Session', value: '3m 24s', change: '+5.8%', changeType: 'positive' as const },
	{ label: 'Bounce Rate', value: '42.3%', change: '-3.1%', changeType: 'negative' as const }
];
