<script lang="ts">
	import { Chart } from 'chart.js';
	import type { ChartData, ChartOptions } from 'chart.js';

	interface Props {
		data: ChartData<'radar'>;
		options?: ChartOptions<'radar'>;
	}

	let { data, options = {} }: Props = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart<'radar'> | undefined;

	const defaultOptions: ChartOptions<'radar'> = {
		plugins: { legend: { position: 'bottom' } },
		scales: {
			r: {
				beginAtZero: true,
				grid: { color: 'rgba(148,163,184,0.1)' },
				angleLines: { color: 'rgba(148,163,184,0.1)' },
				pointLabels: { color: '#94a3b8' }
			}
		}
	};

	$effect(() => {
		if (!canvas) return;
		chart?.destroy();
		chart = new Chart(canvas, {
			type: 'radar',
			data,
			options: { ...defaultOptions, ...options }
		});
		return () => chart?.destroy();
	});
</script>

<canvas bind:this={canvas}></canvas>
