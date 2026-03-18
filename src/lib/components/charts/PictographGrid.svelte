<script lang="ts">
	interface PictographItem {
		label: string;
		value: number;
		color: string;
		icon?: string;
	}

	interface Props {
		items: PictographItem[];
		maxIcons?: number;
		iconSize?: number;
	}

	let { items, maxIcons = 10, iconSize = 24 }: Props = $props();

	let maxValue = $derived(Math.max(...items.map((i) => i.value)));

	function getIconCount(value: number): number {
		return Math.round((value / maxValue) * maxIcons);
	}
</script>

<div class="space-y-3">
	{#each items as item}
		<div class="flex items-center gap-3">
			<span class="w-24 text-sm text-slate-400 text-right shrink-0 truncate">{item.label}</span>
			<div class="flex gap-1 flex-wrap items-center">
				{#each Array(getIconCount(item.value)) as _, i}
					{#if item.icon}
						<img
							src={item.icon}
							alt=""
							width={iconSize}
							height={iconSize}
							class="inline-block"
							style="filter: drop-shadow(0 0 1px {item.color})"
						/>
					{:else}
						<span
							class="inline-block rounded-sm"
							style="width: {iconSize}px; height: {iconSize}px; background: {item.color}"
						></span>
					{/if}
				{/each}
				<span class="text-xs text-slate-500 ml-1">{item.value}</span>
			</div>
		</div>
	{/each}
</div>
