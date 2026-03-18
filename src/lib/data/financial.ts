import { chartPalette, chartPaletteAlpha, withAlpha } from '$lib/utils/colors';

export const revenueVsExpenses = {
	labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
	datasets: [
		{
			label: 'Revenue',
			data: [45000, 52000, 48000, 58000, 61000, 59000, 63000, 60000, 65000, 62000, 64000, 63000],
			backgroundColor: withAlpha(chartPalette[0], 0.6),
			borderColor: chartPalette[0],
			borderWidth: 2
		},
		{
			label: 'Expenses',
			data: [32000, 35000, 33000, 38000, 40000, 39000, 42000, 41000, 45000, 43000, 44000, 43000],
			backgroundColor: withAlpha(chartPalette[1], 0.6),
			borderColor: chartPalette[1],
			borderWidth: 2
		}
	]
};

function generatePast12Months() {
	const months: string[] = [];
	for (let i = 11; i >= 0; i--) {
		const date = new Date(2025, 2 - i, 1);
		months.push(date.toISOString().split('T')[0]);
	}
	return months;
}

const profitValues = [15000, 32000, 48000, 67000, 85000, 98000, 118000, 135000, 152000, 170000, 188000, 200000];
const months12 = generatePast12Months();

export const cumulativeProfit = {
	datasets: [
		{
			label: 'Cumulative Profit',
			data: months12.map((date, i) => ({ x: date, y: profitValues[i] })),
			borderColor: chartPalette[3],
			backgroundColor: withAlpha(chartPalette[3], 0.2),
			borderWidth: 3,
			fill: true,
			tension: 0.4
		}
	]
};

export const expenseBreakdown = {
	labels: ['Salaries', 'Marketing', 'Infrastructure', 'R&D', 'Operations', 'Legal'],
	datasets: [
		{
			data: [180000, 65000, 45000, 85000, 42000, 28000],
			backgroundColor: chartPaletteAlpha(0.8).slice(0, 6),
			borderColor: chartPalette.slice(0, 6),
			borderWidth: 2
		}
	]
};

export const revenueByProduct = {
	labels: ['SaaS Platform', 'Consulting', 'API Access', 'Enterprise', 'Training'],
	datasets: [
		{
			data: [285000, 142000, 95000, 218000, 68000],
			backgroundColor: chartPaletteAlpha(0.8).slice(0, 5),
			borderColor: chartPalette.slice(0, 5),
			borderWidth: 2
		}
	]
};

export const revenueByRegion = [
	{ label: 'North America', value: 385000, color: chartPalette[0] },
	{ label: 'Europe', value: 268000, color: chartPalette[1] },
	{ label: 'Asia Pacific', value: 195000, color: chartPalette[2] },
	{ label: 'Latin America', value: 89000, color: chartPalette[4] },
	{ label: 'Other', value: 51000, color: chartPalette[5] }
];

export const financialStats = [
	{ label: 'Total Revenue', value: '$756,000', change: '+12.5%', changeType: 'positive' as const },
	{ label: 'Net Profit', value: '$311,000', change: '+18.2%', changeType: 'positive' as const },
	{ label: 'MRR', value: '$63,000', change: '+8.7%', changeType: 'positive' as const },
	{ label: 'Burn Rate', value: '$43,500', change: '-5.3%', changeType: 'positive' as const }
];
