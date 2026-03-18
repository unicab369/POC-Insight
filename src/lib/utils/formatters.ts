export function formatCurrency(value: number): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	}).format(value);
}

export function formatNumber(value: number): string {
	return new Intl.NumberFormat('en-US').format(value);
}

export function formatCompact(value: number): string {
	return new Intl.NumberFormat('en-US', {
		notation: 'compact',
		maximumFractionDigits: 1
	}).format(value);
}

export function formatPercent(value: number): string {
	return new Intl.NumberFormat('en-US', {
		style: 'percent',
		minimumFractionDigits: 1,
		maximumFractionDigits: 1
	}).format(value / 100);
}

// --- Timeline builder ---

export interface TimelineDatasetInput {
	label: string;
	values: { date: string; value: number }[];
	color: string;
	fill?: boolean;
}

export interface TimelineConfig {
	unit?: 'day' | 'week' | 'month' | 'quarter' | 'year';
	displayFormat?: string;
	variant?: 'line' | 'bar';
	yPrefix?: string;
	ySuffix?: string;
	stacked?: boolean;
	tension?: number;
}

function hexToRgba(hex: string, alpha: number): string {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Build Chart.js-ready `data`, `options`, and `variant` for a TimelineChart.
 *
 * Usage:
 *   const timeline = createTimelineData([ ... datasets ], { unit: 'month', yPrefix: '$' });
 *   <TimelineChart data={timeline.data} options={timeline.options} variant={timeline.variant} />
 */
export function createTimelineData(
	datasets: TimelineDatasetInput[],
	config: TimelineConfig = {}
) {
	const chartDatasets = datasets.map((ds) => ({
		label: ds.label,
		data: ds.values.map((v) => ({ x: v.date, y: v.value })),
		borderColor: ds.color,
		backgroundColor: ds.fill !== false ? hexToRgba(ds.color, 0.2) : 'transparent',
		borderWidth: 2,
		fill: ds.fill !== false,
		tension: config.tension ?? 0.3,
		pointRadius: 2,
		pointHoverRadius: 6
	}));

	const unit = config.unit ?? 'day';
	const formatMap: Record<string, string> = {
		day: 'MMM d',
		week: 'MMM d',
		month: 'MMM yyyy',
		quarter: 'QQQ yyyy',
		year: 'yyyy'
	};

	const options: Record<string, any> = {
		plugins: { legend: { display: datasets.length > 1 } },
		scales: {
			x: {
				type: 'time' as const,
				time: {
					unit,
					displayFormats: { [unit]: config.displayFormat ?? formatMap[unit] }
				},
				grid: { display: false },
				stacked: config.stacked ?? false
			},
			y: {
				beginAtZero: true,
				grid: { color: 'rgba(148,163,184,0.1)' },
				stacked: config.stacked ?? false,
				...(config.yPrefix || config.ySuffix
					? {
							ticks: {
								callback: (value: number) =>
									`${config.yPrefix ?? ''}${value.toLocaleString()}${config.ySuffix ?? ''}`
							}
						}
					: {})
			}
		},
		elements: {
			line: { tension: config.tension ?? 0.3 },
			point: { radius: 2, hoverRadius: 6 }
		}
	};

	return {
		data: { datasets: chartDatasets },
		options,
		variant: (config.variant ?? 'line') as 'line' | 'bar'
	};
}
