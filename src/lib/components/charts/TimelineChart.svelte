<script lang="ts">
	import { Chart } from 'chart.js';
	import type { ChartData, ChartOptions } from 'chart.js';

	interface Props {
		data: ChartData<'line'> | ChartData<'bar'>;
		options?: ChartOptions<'line'> | ChartOptions<'bar'>;
		variant?: 'line' | 'bar';
	}

	let { data, options = {}, variant = 'line' }: Props = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | undefined;

	const defaultOptions: ChartOptions<'line'> = {
		plugins: { legend: { display: true } },
		scales: {
			x: {
				type: 'time',
				time: { unit: 'day', displayFormats: { day: 'MMM d' } },
				grid: { display: false }
			},
			y: {
				beginAtZero: true,
				grid: { color: 'rgba(148,163,184,0.1)' }
			}
		},
		elements: {
			line: { tension: 0.3 },
			point: { radius: 2, hoverRadius: 6 }
		}
	};

	$effect(() => {
		if (!canvas) return;
		chart?.destroy();
		chart = new Chart(canvas, {
			type: variant,
			data: data as any,
			options: { ...defaultOptions, ...options } as any
		});
		return () => chart?.destroy();
	});
</script>

<canvas bind:this={canvas}></canvas>
