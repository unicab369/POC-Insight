<script lang="ts">
	import { Chart } from 'chart.js';
	import { pictographPlugin } from '$lib/plugins/pictographPlugin';
	import type { ChartData, ChartOptions } from 'chart.js';

	interface Props {
		data: ChartData<'bar'>;
		options?: ChartOptions<'bar'>;
		iconSrc?: string;
	}

	let { data, options = {}, iconSrc = '/icons/circle.svg' }: Props = $props();

	Chart.register(pictographPlugin);

	let canvas: HTMLCanvasElement;
	let chart: Chart<'bar'> | undefined;

	const defaultOptions: ChartOptions<'bar'> = {
		plugins: {
			legend: { display: false },
			pictograph: { iconSrc, iconWidth: 20, iconHeight: 20, iconPadding: 2 }
		} as any,
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
			options: {
				...defaultOptions,
				...options,
				plugins: {
					...defaultOptions.plugins,
					...options.plugins,
					pictograph: { ...(defaultOptions.plugins as any)?.pictograph, iconSrc }
				}
			} as any
		});
		return () => chart?.destroy();
	});
</script>

<canvas bind:this={canvas}></canvas>
