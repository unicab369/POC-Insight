<script lang="ts">
	import { Chart } from 'chart.js';
	import type { ChartData, ChartOptions } from 'chart.js';

	interface Props {
		data: ChartData<'line'>;
		options?: ChartOptions<'line'>;
	}

	let { data, options = {} }: Props = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart<'line'> | undefined;

	const defaultOptions: ChartOptions<'line'> = {
		plugins: { legend: { display: true } },
		scales: {
			y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,0.1)' } },
			x: { grid: { display: false } }
		},
		elements: {
			line: { tension: 0.3 },
			point: { radius: 3, hoverRadius: 6 }
		}
	};

	$effect(() => {
		if (!canvas) return;
		chart?.destroy();
		chart = new Chart(canvas, {
			type: 'line',
			data,
			options: { ...defaultOptions, ...options }
		});
		return () => chart?.destroy();
	});
</script>

<canvas bind:this={canvas}></canvas>
