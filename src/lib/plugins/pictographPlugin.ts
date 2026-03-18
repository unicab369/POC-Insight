import type { Chart, Plugin } from 'chart.js';

interface PictographPluginOptions {
	iconSrc?: string;
	iconWidth?: number;
	iconHeight?: number;
	iconPadding?: number;
}

const loadedImages = new Map<string, HTMLImageElement>();

function getImage(src: string): Promise<HTMLImageElement> {
	if (loadedImages.has(src)) {
		return Promise.resolve(loadedImages.get(src)!);
	}
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => {
			loadedImages.set(src, img);
			resolve(img);
		};
		img.onerror = () => resolve(img);
		img.src = src;
	});
}

export const pictographPlugin: Plugin<'bar'> = {
	id: 'pictograph',
	afterDatasetsDraw(chart: Chart<'bar'>) {
		const opts = chart.options.plugins?.pictograph as PictographPluginOptions | undefined;
		if (!opts?.iconSrc) return;

		const { iconSrc, iconWidth = 24, iconHeight = 24, iconPadding = 2 } = opts;

		getImage(iconSrc).then((img) => {
			if (!img.complete || img.naturalWidth === 0) return;

			const ctx = chart.ctx;
			const meta = chart.getDatasetMeta(0);

			meta.data.forEach((bar) => {
				const { x, y, width, base } = bar as any;
				const barHeight = base - y;
				const iconsCount = Math.floor(barHeight / (iconHeight + iconPadding));
				const barWidth = width || 40;

				ctx.save();
				for (let i = 0; i < iconsCount; i++) {
					const drawX = x - iconWidth / 2;
					const drawY = base - (i + 1) * (iconHeight + iconPadding);
					ctx.drawImage(img, drawX, drawY, iconWidth, iconHeight);
				}
				ctx.restore();
			});
		});
	}
};
