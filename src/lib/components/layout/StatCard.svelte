<script lang="ts">
	interface Props {
		label: string;
		value: string;
		change?: string;
		changeType?: 'positive' | 'negative' | 'neutral';
	}

	let { label, value, change = '', changeType = 'neutral' }: Props = $props();

	const changeColors = {
		positive: 'text-emerald-400',
		negative: 'text-red-400',
		neutral: 'text-slate-400'
	};
</script>

<div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
	<p class="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
	<p class="text-2xl font-bold text-white mt-2">{value}</p>
	{#if change}
		<p class="text-xs mt-2 {changeColors[changeType]}">
			{#if changeType === 'positive'}&#9650;{:else if changeType === 'negative'}&#9660;{/if}
			{change}
		</p>
	{/if}
</div>
