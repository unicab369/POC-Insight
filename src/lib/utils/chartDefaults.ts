import {
	Chart,
	LineController,
	BarController,
	PieController,
	DoughnutController,
	RadarController,
	CategoryScale,
	LinearScale,
	TimeScale,
	PointElement,
	LineElement,
	BarElement,
	ArcElement,
	RadialLinearScale,
	Filler,
	Tooltip,
	Legend,
	Title
} from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(
	LineController,
	BarController,
	PieController,
	DoughnutController,
	RadarController,
	CategoryScale,
	LinearScale,
	TimeScale,
	PointElement,
	LineElement,
	BarElement,
	ArcElement,
	RadialLinearScale,
	Filler,
	Tooltip,
	Legend,
	Title
);

Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";
Chart.defaults.color = '#94a3b8';
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyleWidth = 10;
Chart.defaults.plugins.tooltip.backgroundColor = '#1e293b';
Chart.defaults.plugins.tooltip.titleColor = '#f1f5f9';
Chart.defaults.plugins.tooltip.bodyColor = '#cbd5e1';
Chart.defaults.plugins.tooltip.borderColor = '#334155';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;
