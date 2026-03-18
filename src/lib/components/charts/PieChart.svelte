<script lang="ts">
	import { Chart } from 'chart.js';
	import type { ChartData, ChartOptions } from 'chart.js';

	interface Props {
		data: ChartData<'pie'>;
		options?: ChartOptions<'pie'>;
	}

	let { data, options = {} }: Props = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart<'pie'> | undefined;

	const defaultOptions: ChartOptions<'pie'> = {
		plugins: {
			legend: { position: 'bottom', labels: { padding: 16 } }
		}
	};

	$effect(() => {
		if (!canvas) return;
		chart?.destroy();
		chart = new Chart(canvas, {
			type: 'pie',
			data,
			options: { ...defaultOptions, ...options }
		});
		return () => chart?.destroy();
	});
</script>

<canvas bind:this={canvas}></canvas>
