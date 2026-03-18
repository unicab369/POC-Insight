export const colors = {
	primary: '#6366f1',
	primaryLight: '#818cf8',
	secondary: '#8b5cf6',
	success: '#22c55e',
	warning: '#f59e0b',
	danger: '#ef4444',
	info: '#06b6d4',
	neutral: '#64748b'
};

export const chartPalette = [
	'#6366f1', // indigo
	'#8b5cf6', // violet
	'#06b6d4', // cyan
	'#22c55e', // green
	'#f59e0b', // amber
	'#ef4444', // red
	'#ec4899', // pink
	'#f97316', // orange
	'#14b8a6', // teal
	'#64748b'  // slate
];

export const chartPaletteAlpha = (alpha = 0.2) =>
	chartPalette.map((c) => {
		const r = parseInt(c.slice(1, 3), 16);
		const g = parseInt(c.slice(3, 5), 16);
		const b = parseInt(c.slice(5, 7), 16);
		return `rgba(${r},${g},${b},${alpha})`;
	});

export function withAlpha(hex: string, alpha: number): string {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return `rgba(${r},${g},${b},${alpha})`;
}
