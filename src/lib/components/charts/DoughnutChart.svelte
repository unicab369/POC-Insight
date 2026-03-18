<script lang="ts">
	import { Chart } from 'chart.js';
	import type { ChartData, ChartOptions } from 'chart.js';

	interface Props {
		data: ChartData<'doughnut'>;
		options?: ChartOptions<'doughnut'>;
	}

	let { data, options = {} }: Props = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart<'doughnut'> | undefined;

	const defaultOptions: ChartOptions<'doughnut'> = {
		cutout: '60%',
		plugins: {
			legend: { position: 'bottom', labels: { padding: 16 } }
		}
	};

	$effect(() => {
		if (!canvas) return;
		chart?.destroy();
		chart = new Chart(canvas, {
			type: 'doughnut',
			data,
			options: { ...defaultOptions, ...options }
		});
		return () => chart?.destroy();
	});
</script>

<canvas bind:this={canvas}></canvas>
