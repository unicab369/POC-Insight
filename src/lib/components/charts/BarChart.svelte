<script lang="ts">
	import { Chart } from 'chart.js';
	import type { ChartData, ChartOptions } from 'chart.js';

	interface Props {
		data: ChartData<'bar'>;
		options?: ChartOptions<'bar'>;
	}

	let { data, options = {} }: Props = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart<'bar'> | undefined;

	const defaultOptions: ChartOptions<'bar'> = {
		plugins: { legend: { display: true } },
		scales: {
			y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,0.1)' } },
			x: { grid: { display: false } }
		}
	};

	$effect(() => {
		if (!canvas) return;
		chart?.destroy();
		chart = new Chart(canvas, {
			type: 'bar',
			data,
			options: { ...defaultOptions, ...options }
		});
		return () => chart?.destroy();
	});
</script>

<canvas bind:this={canvas}></canvas>
