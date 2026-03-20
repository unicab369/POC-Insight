<script lang="ts">
	import { goto } from '$app/navigation';

	interface TextBox {
		id: number;
		x: number;
		y: number;
		width: number;
		height: number;
		text: string;
		fontFamily?: string;
		fontSize?: number;
		bold?: boolean;
		italic?: boolean;
		underline?: boolean;
		align?: 'left' | 'center' | 'right';
		textColor?: string;
		highlight?: string;
		bgColor?: string;
	}

	interface SlideImage {
		id: number;
		src: string;
		name: string;
		x: number;
		y: number;
		width: number;
		height: number;
	}

	interface SlideShape {
		id: number;
		type: 'line' | 'arrow' | 'square' | 'rounded-square' | 'circle' | 'triangle' | 'diamond' | 'star';
		x: number;
		y: number;
		width: number;
		height: number;
		text: string;
		fillColor: string;
		borderColor: string;
		borderWidth: number;
		textColor: string;
		fontSize: number;
		fontFamily?: string;
		bold?: boolean;
		italic?: boolean;
		underline?: boolean;
		align?: 'left' | 'center' | 'right';
		highlight?: string;
	}

	interface TableCell {
		text: string;
		fontFamily?: string;
		fontSize?: number;
		bold?: boolean;
		italic?: boolean;
		underline?: boolean;
		align?: 'left' | 'center' | 'right';
		textColor?: string;
		highlight?: string;
		bgColor?: string;
	}

	interface SlideTable {
		id: number;
		x: number; y: number; width: number; height: number;
		rows: number; cols: number;
		cells: TableCell[][];
		borderColor: string;
	}

	interface Slide {
		id: number;
		title: string;
		description: string;
		isLanding: boolean;
		images: SlideImage[];
		textboxes: TextBox[];
		shapes: SlideShape[];
		tables: SlideTable[];
	}

	const STORAGE_KEY = 'poc-slideshow';

	function loadFromStorage() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) return JSON.parse(raw);
		} catch { /* ignore */ }
		return null;
	}

	const saved = loadFromStorage();

	let nextId = $state(saved?.nextId ?? 2);
	let nextImageId = $state(saved?.nextImageId ?? 1);
	let nextTextboxId = $state(saved?.nextTextboxId ?? 1);
	let nextShapeId = $state(saved?.nextShapeId ?? 1);
	let nextTableId = $state(saved?.nextTableId ?? 1);
	let slides = $state<Slide[]>(
		saved?.slides ?? [
			{ id: 1, title: 'Welcome to the Presentation', description: 'Click to edit this description', isLanding: true, images: [], textboxes: [], shapes: [], tables: [] }
		]
	);
	let selectedSlideId = $state(saved?.selectedSlideId ?? 1);

	// Ensure shapes/tables arrays exist on all slides (migration from old data)
	for (const s of slides) {
		if (!s.shapes) s.shapes = [];
		if (!s.tables) s.tables = [];
	}

	$effect(() => {
		const data = {
			slides: $state.snapshot(slides),
			selectedSlideId,
			nextId,
			nextImageId,
			nextTextboxId,
			nextShapeId,
			nextTableId
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	});
	let editingField = $state<'title' | 'description' | null>(null);

	// Image selection state
	let selectedImageId = $state<number | null>(null);
	let activeImageId = $state<number | null>(null);
	let imageToolbarAnchorRect = $state<{ top: number; left: number; width: number } | null>(null);
	let showCameraModal = $state(false);
	let videoEl = $state<HTMLVideoElement | null>(null);
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let fileInputEl = $state<HTMLInputElement | null>(null);
	let cameraStream = $state<MediaStream | null>(null);

	let selectedSlide = $derived(slides.find((s) => s.id === selectedSlideId));

	// Tool state
	let activeTool = $state<'textbox' | 'image' | 'shape' | null>(null);

	// Shape state
	let showShapePicker = $state(false);
	let selectedShapeType = $state<SlideShape['type'] | null>(null);
	let selectedShapeId = $state<number | null>(null);
	let editingShapeId = $state<number | null>(null);
	let shapeToolbarAnchorRect = $state<{ top: number; left: number; width: number } | null>(null);

	// Table state
	let showTablePicker = $state(false);
	let tablePickerHoverRows = $state(0);
	let tablePickerHoverCols = $state(0);
	let selectedTableId = $state<number | null>(null);
	let editingTableId = $state<number | null>(null);
	let selectedCellRow = $state<number | null>(null);
	let selectedCellCol = $state<number | null>(null);
	let cellSelectionEndRow = $state<number | null>(null);
	let cellSelectionEndCol = $state<number | null>(null);
	let isDraggingCellSelection = $state(false);
	let tableToolbarAnchorRect = $state<{top: number; left: number; width: number} | null>(null);

	// Drawing state
	let isDrawing = $state(false);
	let drawStart = $state<{ x: number; y: number } | null>(null);
	let drawCurrent = $state<{ x: number; y: number } | null>(null);
	let slideCanvasEl = $state<HTMLDivElement | null>(null);
	let canvasWrapperEl = $state<HTMLDivElement | null>(null);

	// Canvas zoom
	let canvasZoom = $state(1);
	function handleCanvasWheel(e: WheelEvent) {
		if (!e.ctrlKey && !e.metaKey) return;
		e.preventDefault();
		const delta = e.deltaY > 0 ? -0.03 : 0.03;
		canvasZoom = Math.min(3, Math.max(0.25, canvasZoom + delta));
	}

	// Textbox selection/editing
	let selectedTextboxId = $state<number | null>(null);
	let editingTextboxId = $state<number | null>(null);
	let skipNextDeselect = false;
	let elementWasSelected = false;

	// Element dragging — uses pointer capture to bypass scroll containers
	function startElementDragPointer(kind: 'textbox' | 'image' | 'shape' | 'table', id: number, e: PointerEvent) {
		if (!slideCanvasEl || !selectedSlide) return;
		const item = kind === 'textbox'
			? selectedSlide.textboxes.find((t) => t.id === id)
			: kind === 'image'
				? selectedSlide.images.find((i) => i.id === id)
				: kind === 'shape'
					? selectedSlide.shapes.find((s) => s.id === id)
					: selectedSlide.tables.find((t) => t.id === id);
		if (!item) return;
		e.stopPropagation();

		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);

		const rect = slideCanvasEl.getBoundingClientRect();
		const mx = ((e.clientX - rect.left) / rect.width) * 100;
		const my = ((e.clientY - rect.top) / rect.height) * 100;
		const offX = mx - item.x;
		const offY = my - item.y;
		const startClientX = e.clientX;
		const startClientY = e.clientY;
		let dragging = false;

		const onMove = (ev: PointerEvent) => {
			if (!dragging) {
				const dx = ev.clientX - startClientX;
				const dy = ev.clientY - startClientY;
				if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
				dragging = true;
				elementWasSelected = false;
				saveHistory();
				if (canvasWrapperEl) canvasWrapperEl.style.overflow = 'hidden';
			}
			if (!slideCanvasEl || !selectedSlide) return;
			const it = kind === 'textbox'
				? selectedSlide.textboxes.find((t) => t.id === id)
				: kind === 'image'
					? selectedSlide.images.find((i) => i.id === id)
					: kind === 'shape'
						? selectedSlide.shapes.find((s) => s.id === id)
						: selectedSlide.tables.find((t) => t.id === id);
			if (!it) return;
			const r = slideCanvasEl.getBoundingClientRect();
			const cx = ((ev.clientX - r.left) / r.width) * 100;
			const cy = ((ev.clientY - r.top) / r.height) * 100;
			it.x = Math.max(0, Math.min(100 - it.width, cx - offX));
			it.y = Math.max(0, Math.min(100 - it.height, cy - offY));
			if (kind === 'textbox') refreshToolbarPosition();
			else if (kind === 'image') refreshImageToolbarPosition();
			else if (kind === 'shape') refreshShapeToolbarPosition();
			else refreshTableToolbarPosition();
		};

		const onUp = (ev: PointerEvent) => {
			el.releasePointerCapture(ev.pointerId);
			el.removeEventListener('pointermove', onMove);
			el.removeEventListener('pointerup', onUp);
			if (canvasWrapperEl) canvasWrapperEl.style.overflow = '';
			if (!dragging && elementWasSelected) {
				if (kind === 'textbox') {
					editingTextboxId = id;
					showFormattingToolbar = true;
				} else if (kind === 'shape') {
					editingShapeId = id;
				} else if (kind === 'table') {
					editingTableId = id;
				}
				elementWasSelected = false;
			}
		};

		el.addEventListener('pointermove', onMove);
		el.addEventListener('pointerup', onUp);
	}

	// Textbox resizing — uses pointer capture for reliable drag
	function handleResizePointerDown(tbId: number, corner: 'tl' | 'tr' | 'bl' | 'br', e: PointerEvent) {
		if (!slideCanvasEl) return;
		const tb = selectedSlide?.textboxes.find((t) => t.id === tbId);
		if (!tb) return;
		e.preventDefault();
		e.stopPropagation();
		if (canvasWrapperEl) canvasWrapperEl.style.overflow = 'hidden';

		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);

		const rect = slideCanvasEl.getBoundingClientRect();
		const startX = ((e.clientX - rect.left) / rect.width) * 100;
		const startY = ((e.clientY - rect.top) / rect.height) * 100;
		const startTb = { x: tb.x, y: tb.y, w: tb.width, h: tb.height };
		saveHistory();

		const onMove = (ev: PointerEvent) => {
			if (!slideCanvasEl || !selectedSlide) return;
			const t = selectedSlide.textboxes.find((t) => t.id === tbId);
			if (!t) return;
			const r = slideCanvasEl.getBoundingClientRect();
			const dx = ((ev.clientX - r.left) / r.width) * 100 - startX;
			const dy = ((ev.clientY - r.top) / r.height) * 100 - startY;
			const MIN = 5;
			if (corner === 'br') {
				t.width = Math.max(MIN, startTb.w + dx);
				t.height = Math.max(MIN, startTb.h + dy);
			} else if (corner === 'bl') {
				const nw = Math.max(MIN, startTb.w - dx);
				t.x = startTb.x + startTb.w - nw;
				t.width = nw;
				t.height = Math.max(MIN, startTb.h + dy);
			} else if (corner === 'tr') {
				t.width = Math.max(MIN, startTb.w + dx);
				const nh = Math.max(MIN, startTb.h - dy);
				t.y = startTb.y + startTb.h - nh;
				t.height = nh;
			} else if (corner === 'tl') {
				const nw = Math.max(MIN, startTb.w - dx);
				const nh = Math.max(MIN, startTb.h - dy);
				t.x = startTb.x + startTb.w - nw;
				t.y = startTb.y + startTb.h - nh;
				t.width = nw;
				t.height = nh;
			}
			refreshToolbarPosition();
		};

		const onUp = (ev: PointerEvent) => {
			el.releasePointerCapture(ev.pointerId);
			el.removeEventListener('pointermove', onMove);
			el.removeEventListener('pointerup', onUp);
			if (canvasWrapperEl) canvasWrapperEl.style.overflow = '';
		};

		el.addEventListener('pointermove', onMove);
		el.addEventListener('pointerup', onUp);
	}

	// Image resizing — uses pointer capture
	function handleImageResizePointerDown(imgId: number, corner: 'tl' | 'tr' | 'bl' | 'br', e: PointerEvent) {
		if (!slideCanvasEl) return;
		const img = selectedSlide?.images.find((i) => i.id === imgId);
		if (!img) return;
		e.preventDefault();
		e.stopPropagation();
		if (canvasWrapperEl) canvasWrapperEl.style.overflow = 'hidden';

		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);

		const rect = slideCanvasEl.getBoundingClientRect();
		const startX = ((e.clientX - rect.left) / rect.width) * 100;
		const startY = ((e.clientY - rect.top) / rect.height) * 100;
		const startImg = { x: img.x, y: img.y, w: img.width, h: img.height };
		saveHistory();

		const onMove = (ev: PointerEvent) => {
			if (!slideCanvasEl || !selectedSlide) return;
			const i = selectedSlide.images.find((i) => i.id === imgId);
			if (!i) return;
			const r = slideCanvasEl.getBoundingClientRect();
			const dx = ((ev.clientX - r.left) / r.width) * 100 - startX;
			const dy = ((ev.clientY - r.top) / r.height) * 100 - startY;
			const MIN = 5;
			if (corner === 'br') {
				i.width = Math.max(MIN, startImg.w + dx);
				i.height = Math.max(MIN, startImg.h + dy);
			} else if (corner === 'bl') {
				const nw = Math.max(MIN, startImg.w - dx);
				i.x = startImg.x + startImg.w - nw;
				i.width = nw;
				i.height = Math.max(MIN, startImg.h + dy);
			} else if (corner === 'tr') {
				i.width = Math.max(MIN, startImg.w + dx);
				const nh = Math.max(MIN, startImg.h - dy);
				i.y = startImg.y + startImg.h - nh;
				i.height = nh;
			} else if (corner === 'tl') {
				const nw = Math.max(MIN, startImg.w - dx);
				const nh = Math.max(MIN, startImg.h - dy);
				i.x = startImg.x + startImg.w - nw;
				i.y = startImg.y + startImg.h - nh;
				i.width = nw;
				i.height = nh;
			}
			refreshImageToolbarPosition();
		};

		const onUp = (ev: PointerEvent) => {
			el.releasePointerCapture(ev.pointerId);
			el.removeEventListener('pointermove', onMove);
			el.removeEventListener('pointerup', onUp);
			if (canvasWrapperEl) canvasWrapperEl.style.overflow = '';
		};

		el.addEventListener('pointermove', onMove);
		el.addEventListener('pointerup', onUp);
	}

	function refreshImageToolbarPosition() {
		if (selectedImageId == null || !slideCanvasEl) return;
		const imgEl = slideCanvasEl.querySelector(`[data-image-id="${selectedImageId}"]`) as HTMLElement | null;
		if (imgEl) {
			const rect = imgEl.getBoundingClientRect();
			imageToolbarAnchorRect = { top: rect.top, left: rect.left, width: rect.width };
		}
	}

	function captureImageToolbarAnchor(node: HTMLElement) {
		const parent = node.closest('[data-image]') as HTMLElement;
		if (parent) {
			const rect = parent.getBoundingClientRect();
			imageToolbarAnchorRect = { top: rect.top, left: rect.left, width: rect.width };
		}
		return {
			destroy() {
				imageToolbarAnchorRect = null;
			}
		};
	}

	$effect(() => {
		if (selectedImageId == null) return;
		const vv = window.visualViewport;
		if (!vv) return;
		const handler = () => refreshImageToolbarPosition();
		vv.addEventListener('resize', handler);
		vv.addEventListener('scroll', handler);
		return () => {
			vv.removeEventListener('resize', handler);
			vv.removeEventListener('scroll', handler);
		};
	});

	// Formatting toolbar state
	let showFormattingToolbar = $state(false);
	let activePickerTarget = $state<'text' | 'highlight' | 'bg' | 'fill' | 'stroke' | 'layers' | null>(null);
	let toolbarAnchorRect = $state<{ top: number; left: number; width: number } | null>(null);

	function refreshToolbarPosition() {
		const targetId = editingTextboxId ?? selectedTextboxId;
		if (!targetId || !slideCanvasEl) return;
		const tbEl = slideCanvasEl.querySelector(`[data-textbox-id="${targetId}"]`) as HTMLElement | null;
		if (tbEl) {
			const rect = tbEl.getBoundingClientRect();
			toolbarAnchorRect = { top: rect.top, left: rect.left, width: rect.width };
		}
	}

	$effect(() => {
		if (selectedTextboxId == null) return;
		const vv = window.visualViewport;
		if (!vv) return;
		const handler = () => refreshToolbarPosition();
		vv.addEventListener('resize', handler);
		vv.addEventListener('scroll', handler);
		return () => {
			vv.removeEventListener('resize', handler);
			vv.removeEventListener('scroll', handler);
		};
	});

	function captureToolbarAnchor(node: HTMLElement) {
		const parent = node.closest('[data-textbox]') as HTMLElement;
		if (parent) {
			const rect = parent.getBoundingClientRect();
			toolbarAnchorRect = { top: rect.top, left: rect.left, width: rect.width };
		}
		return {
			destroy() {
				toolbarAnchorRect = null;
			}
		};
	}

	const fontOptions = [
		{ label: 'Sans-serif', value: 'sans-serif' },
		{ label: 'Serif', value: 'serif' },
		{ label: 'Monospace', value: 'monospace' },
		{ label: 'Georgia', value: 'Georgia, serif' },
		{ label: 'Verdana', value: 'Verdana, sans-serif' },
		{ label: 'Trebuchet MS', value: "'Trebuchet MS', sans-serif" }
	];

	const presetColors = [
		'#0f172a', '#ffffff', '#ef4444', '#3b82f6', '#22c55e', '#eab308',
		'#a855f7', '#ec4899', '#f97316', '#06b6d4', '#64748b', '#10b981'
	];

	function hexToRgba(hex: string, alpha: number): string {
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		return `rgba(${r},${g},${b},${alpha})`;
	}

	function parseColorAndOpacity(color: string | undefined): { hex: string; opacity: number } {
		if (!color || color === 'transparent') return { hex: '#000000', opacity: 0 };
		const rgbaMatch = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
		if (rgbaMatch) {
			const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0');
			const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0');
			const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0');
			return { hex: `#${r}${g}${b}`, opacity: rgbaMatch[4] != null ? parseFloat(rgbaMatch[4]) : 1 };
		}
		if (color.startsWith('#')) return { hex: color, opacity: 1 };
		return { hex: color, opacity: 1 };
	}

	function applyBgColorWithOpacity(hex: string, opacity: number) {
		if (opacity === 0) {
			updateTextboxStyle('bgColor', 'transparent');
		} else if (opacity === 1) {
			updateTextboxStyle('bgColor', hex);
		} else {
			updateTextboxStyle('bgColor', hexToRgba(hex, opacity));
		}
	}

	function getEditingTextbox(): TextBox | undefined {
		if (!selectedSlide || editingTextboxId == null) return undefined;
		return selectedSlide.textboxes.find((t) => t.id === editingTextboxId);
	}

	function getSelectedTextbox(): TextBox | undefined {
		if (!selectedSlide || selectedTextboxId == null) return undefined;
		return selectedSlide.textboxes.find((t) => t.id === selectedTextboxId);
	}

	function updateTextboxStyle<K extends keyof TextBox>(key: K, value: TextBox[K]) {
		const tb = getSelectedTextbox();
		if (!tb) return;
		saveHistory();
		tb[key] = value;
	}

	function buildTextStyle(tb: TextBox): string {
		return `font-family:${tb.fontFamily ?? 'sans-serif'};font-size:${tb.fontSize ?? 14}px;font-weight:${tb.bold ? 'bold' : 'normal'};font-style:${tb.italic ? 'italic' : 'normal'};text-decoration:${tb.underline ? 'underline' : 'none'};text-align:${tb.align ?? 'left'};color:${tb.textColor ?? '#ffffff'};background:${tb.highlight ?? 'transparent'};`;
	}

	function buildShapeTextStyle(s: SlideShape): string {
		return `font-family:${s.fontFamily ?? 'sans-serif'};font-size:${s.fontSize}px;font-weight:${s.bold ? 'bold' : 'normal'};font-style:${s.italic ? 'italic' : 'normal'};text-decoration:${s.underline ? 'underline' : 'none'};text-align:${s.align ?? 'center'};color:${s.textColor};background:${s.highlight ?? 'transparent'};line-height:1.3;`;
	}

	let drawRect = $derived.by(() => {
		if (!drawStart || !drawCurrent) return null;
		return {
			x: Math.min(drawStart.x, drawCurrent.x),
			y: Math.min(drawStart.y, drawCurrent.y),
			width: Math.abs(drawCurrent.x - drawStart.x),
			height: Math.abs(drawCurrent.y - drawStart.y)
		};
	});

	// Undo/Redo history
	interface HistoryEntry {
		slides: Slide[];
		selectedSlideId: number;
	}

	let undoStack = $state<HistoryEntry[]>([]);
	let redoStack = $state<HistoryEntry[]>([]);

	function saveHistory() {
		undoStack.push({
			slides: structuredClone($state.snapshot(slides)),
			selectedSlideId
		});
		redoStack = [];
	}

	function undo() {
		if (undoStack.length === 0) return;
		const entry = undoStack.pop()!;
		redoStack.push({
			slides: structuredClone($state.snapshot(slides)),
			selectedSlideId
		});
		slides = entry.slides;
		selectedSlideId = entry.selectedSlideId;
		editingField = null;
		selectedTextboxId = null;
		editingTextboxId = null;
		showFormattingToolbar = false;
		activePickerTarget = null;
		selectedImageId = null;
		activeImageId = null;
		selectedShapeId = null;
		editingShapeId = null;
		selectedTableId = null;
		editingTableId = null;
		selectedCellRow = null;
		selectedCellCol = null;
		cellSelectionEndRow = null;
		cellSelectionEndCol = null;
		tableToolbarAnchorRect = null;
	}

	function redo() {
		if (redoStack.length === 0) return;
		const entry = redoStack.pop()!;
		undoStack.push({
			slides: structuredClone($state.snapshot(slides)),
			selectedSlideId
		});
		slides = entry.slides;
		selectedSlideId = entry.selectedSlideId;
		editingField = null;
		selectedTextboxId = null;
		editingTextboxId = null;
		showFormattingToolbar = false;
		activePickerTarget = null;
		selectedImageId = null;
		activeImageId = null;
		selectedShapeId = null;
		editingShapeId = null;
		selectedTableId = null;
		editingTableId = null;
		selectedCellRow = null;
		selectedCellCol = null;
		cellSelectionEndRow = null;
		cellSelectionEndCol = null;
		tableToolbarAnchorRect = null;
	}

	function addSlide() {
		saveHistory();
		const id = nextId++;
		slides.push({
			id,
			title: `Slide ${slides.length + 1}`,
			description: 'Click to edit this description',
			isLanding: false,
			images: [],
			textboxes: [],
			shapes: [],
			tables: []
		});
		selectedSlideId = id;
	}

	function deleteSlide(id: number) {
		const index = slides.findIndex((s) => s.id === id);
		if (index === -1) return;
		saveHistory();
		slides.splice(index, 1);
		if (selectedSlideId === id) {
			selectedSlideId = slides[Math.min(index, slides.length - 1)].id;
		}
	}

	function startEditing(field: 'title' | 'description') {
		if (activeTool) return;
		editingField = field;
		selectedTextboxId = null;
		editingTextboxId = null;
		selectedImageId = null;
		activeImageId = null;
		selectedShapeId = null;
		editingShapeId = null;
		selectedTableId = null;
		editingTableId = null;
		selectedCellRow = null;
		selectedCellCol = null;
		cellSelectionEndRow = null;
		cellSelectionEndCol = null;
	}

	function stopEditing() {
		editingField = null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === 'Escape') {
			stopEditing();
		}
	}

	function fillImage(imageId: number, src: string, name: string) {
		const slide = slides.find((s) => s.id === selectedSlideId);
		if (!slide) return;
		const image = slide.images.find((img) => img.id === imageId);
		if (!image) return;
		saveHistory();
		image.src = src;
		image.name = name;
		activeImageId = null;
	}

	function removeImageFromSlide(imageId: number) {
		const slide = slides.find((s) => s.id === selectedSlideId);
		if (!slide) return;
		saveHistory();
		const idx = slide.images.findIndex((img) => img.id === imageId);
		if (idx !== -1) slide.images.splice(idx, 1);
		if (selectedImageId === imageId) selectedImageId = null;
		if (activeImageId === imageId) activeImageId = null;
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (activeImageId == null) { input.value = ''; return; }
		const targetId = activeImageId;
		const reader = new FileReader();
		reader.onload = () => {
			fillImage(targetId, reader.result as string, file.name);
		};
		reader.readAsDataURL(file);
		input.value = '';
	}

	function openFilePicker() {
		if (activeImageId == null) return;
		fileInputEl?.click();
	}

	async function openCamera() {
		if (activeImageId == null) return;
		showCameraModal = true;
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
			cameraStream = stream;
			await new Promise((r) => setTimeout(r, 50));
			if (videoEl) {
				videoEl.srcObject = stream;
				videoEl.play();
			}
		} catch {
			alert('Could not access camera. Please check your permissions.');
			closeCamera();
		}
	}

	function capturePhoto() {
		if (!videoEl || !canvasEl || activeImageId == null) return;
		canvasEl.width = videoEl.videoWidth;
		canvasEl.height = videoEl.videoHeight;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;
		ctx.drawImage(videoEl, 0, 0);
		const dataUrl = canvasEl.toDataURL('image/png');
		fillImage(activeImageId, dataUrl, `Photo ${activeImageId}`);
		closeCamera();
	}

	function closeCamera() {
		if (cameraStream) {
			cameraStream.getTracks().forEach((t) => t.stop());
			cameraStream = null;
		}
		showCameraModal = false;
	}

	function toggleTextboxTool() {
		if (activeTool === 'textbox') {
			activeTool = null;
		} else {
			activeTool = 'textbox';
			selectedTextboxId = null;
			editingTextboxId = null;
			selectedImageId = null;
			activeImageId = null;
			editingField = null;
			selectedTableId = null;
			editingTableId = null;
			selectedCellRow = null;
			selectedCellCol = null;
			cellSelectionEndRow = null;
			cellSelectionEndCol = null;
		}
	}

	function toggleImageTool() {
		if (activeTool === 'image') {
			activeTool = null;
		} else {
			activeTool = 'image';
			selectedTextboxId = null;
			editingTextboxId = null;
			selectedImageId = null;
			activeImageId = null;
			editingField = null;
			selectedTableId = null;
			editingTableId = null;
			selectedCellRow = null;
			selectedCellCol = null;
			cellSelectionEndRow = null;
			cellSelectionEndCol = null;
		}
	}

	function getRelativePos(e: MouseEvent): { x: number; y: number } | null {
		if (!slideCanvasEl) return null;
		const rect = slideCanvasEl.getBoundingClientRect();
		return {
			x: ((e.clientX - rect.left) / rect.width) * 100,
			y: ((e.clientY - rect.top) / rect.height) * 100
		};
	}

	function handleCanvasMousedown(e: MouseEvent) {
		if (activeTool !== 'textbox' && activeTool !== 'image' && activeTool !== 'shape') return;
		if ((e.target as HTMLElement).closest('[data-textbox]')) return;
		if ((e.target as HTMLElement).closest('[data-image]')) return;
		if ((e.target as HTMLElement).closest('[data-shape]')) return;
		if ((e.target as HTMLElement).closest('[data-table]')) return;
		const pos = getRelativePos(e);
		if (!pos) return;
		e.preventDefault();

		if (activeTool === 'textbox' && selectedSlide) {
			saveHistory();
			const id = nextTextboxId++;
			const w = 30, h = 12;
			const x = Math.max(0, Math.min(pos.x - w / 2, 100 - w));
			const y = Math.max(0, Math.min(pos.y - h / 2, 100 - h));
			selectedSlide.textboxes.push({ id, x, y, width: w, height: h, text: '' });
			selectedTextboxId = id;
			editingTextboxId = id;
			showFormattingToolbar = true;
			activePickerTarget = null;
			activeTool = null;
			skipNextDeselect = true;
			return;
		}

		if (activeTool === 'image' && selectedSlide) {
			saveHistory();
			const id = nextImageId++;
			const size = 20;
			const x = Math.max(0, Math.min(pos.x - size / 2, 100 - size));
			const y = Math.max(0, Math.min(pos.y - size / 2, 100 - size));
			selectedSlide.images.push({ id, src: '', name: '', x, y, width: size, height: size });
			selectedImageId = id;
			activeImageId = id;
			selectedTextboxId = null;
			editingTextboxId = null;
			showFormattingToolbar = false;
			activeTool = null;
			skipNextDeselect = true;
			return;
		}

		if (activeTool === 'shape' && selectedSlide && selectedShapeType) {
			saveHistory();
			const id = nextShapeId++;
			const isLine = selectedShapeType === 'line' || selectedShapeType === 'arrow';
			const w = isLine ? 25 : 15;
			const h = isLine ? 2 : 24;
			const x = Math.max(0, Math.min(pos.x - w / 2, 100 - w));
			const y = Math.max(0, Math.min(pos.y - h / 2, 100 - h));
			selectedSlide.shapes.push({
				id, type: selectedShapeType, x, y, width: w, height: h,
				text: '',
				fillColor: 'transparent',
				borderColor: '#6366f1',
				borderWidth: 2,
				textColor: '#ffffff',
				fontSize: 14
			});
			selectedShapeId = id;
			selectedTextboxId = null;
			editingTextboxId = null;
			showFormattingToolbar = false;
			selectedImageId = null;
			activeImageId = null;
			activeTool = null;
			selectedShapeType = null;
			skipNextDeselect = true;
			return;
		}
	}

	function handleCanvasMousemove(e: MouseEvent) {
		if (!isDrawing) return;
		const pos = getRelativePos(e);
		if (!pos) return;
		drawCurrent = pos;
	}

	function handleCanvasMouseup() {
		isDrawing = false;
		drawStart = null;
		drawCurrent = null;
	}

	function selectTextbox(id: number, e: MouseEvent) {
		e.stopPropagation();
		if (activeTool) return;
		selectedTextboxId = id;
		activePickerTarget = null;
		editingField = null;
		selectedImageId = null;
		activeImageId = null;
		imageToolbarAnchorRect = null;
		selectedShapeId = null;
		editingShapeId = null;
		shapeToolbarAnchorRect = null;
		selectedTableId = null;
		editingTableId = null;
		selectedCellRow = null;
		selectedCellCol = null;
		cellSelectionEndRow = null;
		cellSelectionEndCol = null;
		tableToolbarAnchorRect = null;
	}

	function selectImage(id: number, e: MouseEvent) {
		e.stopPropagation();
		if (activeTool) return;
		selectedImageId = id;
		activeImageId = id;
		selectedTextboxId = null;
		editingTextboxId = null;
		showFormattingToolbar = false;
		activePickerTarget = null;
		toolbarAnchorRect = null;
		editingField = null;
		selectedShapeId = null;
		editingShapeId = null;
		shapeToolbarAnchorRect = null;
		selectedTableId = null;
		editingTableId = null;
		selectedCellRow = null;
		selectedCellCol = null;
		cellSelectionEndRow = null;
		cellSelectionEndCol = null;
		tableToolbarAnchorRect = null;
	}

	function deleteImage(id: number) {
		removeImageFromSlide(id);
	}

	function startEditingTextbox(id: number, e: MouseEvent) {
		e.stopPropagation();
		if (activeTool) return;
		selectedTextboxId = id;
		editingTextboxId = id;
		editingField = null;
		showFormattingToolbar = true;
		activePickerTarget = null;
	}

	function deleteTextbox(id: number) {
		if (!selectedSlide) return;
		saveHistory();
		const index = selectedSlide.textboxes.findIndex((t) => t.id === id);
		if (index !== -1) selectedSlide.textboxes.splice(index, 1);
		selectedTextboxId = null;
		editingTextboxId = null;
	}

	// Shape functions
	function toggleShapePicker() {
		showShapePicker = !showShapePicker;
		if (!showShapePicker && activeTool === 'shape') {
			activeTool = null;
			selectedShapeType = null;
		}
	}

	function pickShapeType(type: SlideShape['type']) {
		selectedShapeType = type;
		activeTool = 'shape';
		showShapePicker = false;
		selectedTextboxId = null;
		editingTextboxId = null;
		selectedImageId = null;
		activeImageId = null;
		selectedShapeId = null;
		editingShapeId = null;
		editingField = null;
		selectedTableId = null;
		editingTableId = null;
		selectedCellRow = null;
		selectedCellCol = null;
		cellSelectionEndRow = null;
		cellSelectionEndCol = null;
	}

	function selectShape(id: number, e: MouseEvent) {
		e.stopPropagation();
		if (activeTool) return;
		selectedShapeId = id;
		editingShapeId = null;
		activePickerTarget = null;
		selectedTextboxId = null;
		editingTextboxId = null;
		showFormattingToolbar = false;
		toolbarAnchorRect = null;
		selectedImageId = null;
		activeImageId = null;
		imageToolbarAnchorRect = null;
		editingField = null;
		selectedTableId = null;
		editingTableId = null;
		selectedCellRow = null;
		selectedCellCol = null;
		cellSelectionEndRow = null;
		cellSelectionEndCol = null;
		tableToolbarAnchorRect = null;
	}

	function startEditingShape(id: number, e: MouseEvent) {
		e.stopPropagation();
		if (activeTool) return;
		selectedShapeId = id;
		editingShapeId = id;
		activePickerTarget = null;
		editingField = null;
	}

	function deleteShape(id: number) {
		if (!selectedSlide) return;
		saveHistory();
		const idx = selectedSlide.shapes.findIndex((s) => s.id === id);
		if (idx !== -1) selectedSlide.shapes.splice(idx, 1);
		selectedShapeId = null;
		editingShapeId = null;
		shapeToolbarAnchorRect = null;
		activePickerTarget = null;
	}

	function refreshShapeToolbarPosition() {
		if (selectedShapeId == null || !slideCanvasEl) return;
		const el = slideCanvasEl.querySelector(`[data-shape-id="${selectedShapeId}"]`) as HTMLElement | null;
		if (el) {
			const rect = el.getBoundingClientRect();
			shapeToolbarAnchorRect = { top: rect.top, left: rect.left, width: rect.width };
		}
	}

	function captureShapeToolbarAnchor(node: HTMLElement) {
		const parent = node.closest('[data-shape]') as HTMLElement;
		if (parent) {
			const rect = parent.getBoundingClientRect();
			shapeToolbarAnchorRect = { top: rect.top, left: rect.left, width: rect.width };
		}
		return {
			destroy() {
				shapeToolbarAnchorRect = null;
			}
		};
	}

	$effect(() => {
		if (selectedShapeId == null) return;
		const vv = window.visualViewport;
		if (!vv) return;
		const handler = () => refreshShapeToolbarPosition();
		vv.addEventListener('resize', handler);
		vv.addEventListener('scroll', handler);
		return () => {
			vv.removeEventListener('resize', handler);
			vv.removeEventListener('scroll', handler);
		};
	});

	function handleShapeResizePointerDown(shapeId: number, corner: 'tl' | 'tr' | 'bl' | 'br', e: PointerEvent) {
		if (!slideCanvasEl) return;
		const shape = selectedSlide?.shapes.find((s) => s.id === shapeId);
		if (!shape) return;
		e.preventDefault();
		e.stopPropagation();

		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);

		const rect = slideCanvasEl.getBoundingClientRect();
		const startX = ((e.clientX - rect.left) / rect.width) * 100;
		const startY = ((e.clientY - rect.top) / rect.height) * 100;
		const startShape = { x: shape.x, y: shape.y, w: shape.width, h: shape.height };
		saveHistory();

		const onMove = (ev: PointerEvent) => {
			if (!slideCanvasEl || !selectedSlide) return;
			const s = selectedSlide.shapes.find((s) => s.id === shapeId);
			if (!s) return;
			const r = slideCanvasEl.getBoundingClientRect();
			const dx = ((ev.clientX - r.left) / r.width) * 100 - startX;
			const dy = ((ev.clientY - r.top) / r.height) * 100 - startY;
			const MIN = 3;
			if (corner === 'br') {
				s.width = Math.max(MIN, startShape.w + dx);
				s.height = Math.max(MIN, startShape.h + dy);
			} else if (corner === 'bl') {
				const nw = Math.max(MIN, startShape.w - dx);
				s.x = startShape.x + startShape.w - nw;
				s.width = nw;
				s.height = Math.max(MIN, startShape.h + dy);
			} else if (corner === 'tr') {
				s.width = Math.max(MIN, startShape.w + dx);
				const nh = Math.max(MIN, startShape.h - dy);
				s.y = startShape.y + startShape.h - nh;
				s.height = nh;
			} else if (corner === 'tl') {
				const nw = Math.max(MIN, startShape.w - dx);
				const nh = Math.max(MIN, startShape.h - dy);
				s.x = startShape.x + startShape.w - nw;
				s.y = startShape.y + startShape.h - nh;
				s.width = nw;
				s.height = nh;
			}
			refreshShapeToolbarPosition();
		};

		const onUp = (ev: PointerEvent) => {
			el.releasePointerCapture(ev.pointerId);
			el.removeEventListener('pointermove', onMove);
			el.removeEventListener('pointerup', onUp);
		};

		el.addEventListener('pointermove', onMove);
		el.addEventListener('pointerup', onUp);
	}

	// Table functions
	function toggleTablePicker() {
		showTablePicker = !showTablePicker;
	}

	function insertTable(rows: number, cols: number) {
		if (!selectedSlide) return;
		saveHistory();
		const id = nextTableId++;
		const w = 50;
		const h = rows * 5;
		const x = (100 - w) / 2;
		const y = (100 - h) / 2;
		const cells: TableCell[][] = [];
		for (let r = 0; r < rows; r++) {
			const row: TableCell[] = [];
			for (let c = 0; c < cols; c++) {
				row.push({ text: '' });
			}
			cells.push(row);
		}
		selectedSlide.tables.push({ id, x, y, width: w, height: h, rows, cols, cells, borderColor: '#475569' });
		selectedTableId = id;
		editingTableId = null;
		selectedCellRow = null;
		selectedCellCol = null;
		cellSelectionEndRow = null;
		cellSelectionEndCol = null;
		selectedTextboxId = null;
		editingTextboxId = null;
		showFormattingToolbar = false;
		selectedImageId = null;
		activeImageId = null;
		selectedShapeId = null;
		editingShapeId = null;
		showTablePicker = false;
		skipNextDeselect = true;
	}

	function selectTable(id: number, e: MouseEvent | PointerEvent) {
		e.stopPropagation();
		if (activeTool) return;
		selectedTableId = id;
		editingTableId = null;
		selectedCellRow = null;
		selectedCellCol = null;
		cellSelectionEndRow = null;
		cellSelectionEndCol = null;
		activePickerTarget = null;
		selectedTextboxId = null;
		editingTextboxId = null;
		showFormattingToolbar = false;
		toolbarAnchorRect = null;
		selectedImageId = null;
		activeImageId = null;
		imageToolbarAnchorRect = null;
		selectedShapeId = null;
		editingShapeId = null;
		shapeToolbarAnchorRect = null;
		editingField = null;
	}

	function startEditingTable(id: number, e: MouseEvent | PointerEvent) {
		e.stopPropagation();
		if (activeTool) return;
		selectedTableId = id;
		editingTableId = id;
		activePickerTarget = null;
		editingField = null;
	}

	function selectCell(row: number, col: number) {
		selectedCellRow = row;
		selectedCellCol = col;
		cellSelectionEndRow = row;
		cellSelectionEndCol = col;
	}

	function getCellSelectionBounds(): { minRow: number; maxRow: number; minCol: number; maxCol: number } | null {
		if (selectedCellRow == null || selectedCellCol == null) return null;
		const endR = cellSelectionEndRow ?? selectedCellRow;
		const endC = cellSelectionEndCol ?? selectedCellCol;
		return {
			minRow: Math.min(selectedCellRow, endR),
			maxRow: Math.max(selectedCellRow, endR),
			minCol: Math.min(selectedCellCol, endC),
			maxCol: Math.max(selectedCellCol, endC)
		};
	}

	function isCellInSelection(row: number, col: number): boolean {
		const b = getCellSelectionBounds();
		if (!b) return false;
		return row >= b.minRow && row <= b.maxRow && col >= b.minCol && col <= b.maxCol;
	}

	function isMultiCellSelection(): boolean {
		const b = getCellSelectionBounds();
		if (!b) return false;
		return b.minRow !== b.maxRow || b.minCol !== b.maxCol;
	}

	function deleteTable(id: number) {
		if (!selectedSlide) return;
		saveHistory();
		const idx = selectedSlide.tables.findIndex((t) => t.id === id);
		if (idx !== -1) selectedSlide.tables.splice(idx, 1);
		selectedTableId = null;
		editingTableId = null;
		selectedCellRow = null;
		selectedCellCol = null;
		cellSelectionEndRow = null;
		cellSelectionEndCol = null;
		tableToolbarAnchorRect = null;
		activePickerTarget = null;
	}

	function getSelectedTable(): SlideTable | undefined {
		if (!selectedSlide || selectedTableId == null) return undefined;
		return selectedSlide.tables.find((t) => t.id === selectedTableId);
	}

	function getSelectedCell(): TableCell | undefined {
		const table = getSelectedTable();
		if (!table || selectedCellRow == null || selectedCellCol == null) return undefined;
		return table.cells[selectedCellRow]?.[selectedCellCol];
	}

	function updateTableCellStyle<K extends keyof TableCell>(key: K, value: TableCell[K]) {
		const table = getSelectedTable();
		const bounds = getCellSelectionBounds();
		if (!table || !bounds) return;
		saveHistory();
		for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
			for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
				const cell = table.cells[r]?.[c];
				if (cell) cell[key] = value;
			}
		}
	}

	function buildTableCellStyle(cell: TableCell): string {
		return `font-family:${cell.fontFamily ?? 'sans-serif'};font-size:${cell.fontSize ?? 14}px;font-weight:${cell.bold ? 'bold' : 'normal'};font-style:${cell.italic ? 'italic' : 'normal'};text-decoration:${cell.underline ? 'underline' : 'none'};text-align:${cell.align ?? 'left'};color:${cell.textColor ?? '#ffffff'};background:${cell.highlight ?? 'transparent'};`;
	}

	function handleTableResizePointerDown(tableId: number, corner: 'tl' | 'tr' | 'bl' | 'br', e: PointerEvent) {
		if (!slideCanvasEl) return;
		const table = selectedSlide?.tables.find((t) => t.id === tableId);
		if (!table) return;
		e.preventDefault();
		e.stopPropagation();

		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);

		const rect = slideCanvasEl.getBoundingClientRect();
		const startX = ((e.clientX - rect.left) / rect.width) * 100;
		const startY = ((e.clientY - rect.top) / rect.height) * 100;
		const startTable = { x: table.x, y: table.y, w: table.width, h: table.height };
		saveHistory();

		const onMove = (ev: PointerEvent) => {
			if (!slideCanvasEl || !selectedSlide) return;
			const t = selectedSlide.tables.find((t) => t.id === tableId);
			if (!t) return;
			const r = slideCanvasEl.getBoundingClientRect();
			const dx = ((ev.clientX - r.left) / r.width) * 100 - startX;
			const dy = ((ev.clientY - r.top) / r.height) * 100 - startY;
			const MIN = 5;
			if (corner === 'br') {
				t.width = Math.max(MIN, startTable.w + dx);
				t.height = Math.max(MIN, startTable.h + dy);
			} else if (corner === 'bl') {
				const nw = Math.max(MIN, startTable.w - dx);
				t.x = startTable.x + startTable.w - nw;
				t.width = nw;
				t.height = Math.max(MIN, startTable.h + dy);
			} else if (corner === 'tr') {
				t.width = Math.max(MIN, startTable.w + dx);
				const nh = Math.max(MIN, startTable.h - dy);
				t.y = startTable.y + startTable.h - nh;
				t.height = nh;
			} else if (corner === 'tl') {
				const nw = Math.max(MIN, startTable.w - dx);
				const nh = Math.max(MIN, startTable.h - dy);
				t.x = startTable.x + startTable.w - nw;
				t.y = startTable.y + startTable.h - nh;
				t.width = nw;
				t.height = nh;
			}
			refreshTableToolbarPosition();
		};

		const onUp = (ev: PointerEvent) => {
			el.releasePointerCapture(ev.pointerId);
			el.removeEventListener('pointermove', onMove);
			el.removeEventListener('pointerup', onUp);
		};

		el.addEventListener('pointermove', onMove);
		el.addEventListener('pointerup', onUp);
	}

	function refreshTableToolbarPosition() {
		if (selectedTableId == null || !slideCanvasEl) return;
		const el = slideCanvasEl.querySelector(`[data-table-id="${selectedTableId}"]`) as HTMLElement | null;
		if (el) {
			const rect = el.getBoundingClientRect();
			tableToolbarAnchorRect = { top: rect.top, left: rect.left, width: rect.width };
		}
	}

	function captureTableToolbarAnchor(node: HTMLElement) {
		const parent = node.closest('[data-table]') as HTMLElement;
		if (parent) {
			const rect = parent.getBoundingClientRect();
			tableToolbarAnchorRect = { top: rect.top, left: rect.left, width: rect.width };
		}
		return {
			destroy() {
				tableToolbarAnchorRect = null;
			}
		};
	}

	$effect(() => {
		if (selectedTableId == null) return;
		const vv = window.visualViewport;
		if (!vv) return;
		const handler = () => refreshTableToolbarPosition();
		vv.addEventListener('resize', handler);
		vv.addEventListener('scroll', handler);
		return () => {
			vv.removeEventListener('resize', handler);
			vv.removeEventListener('scroll', handler);
		};
	});

	function getSelectedShape(): SlideShape | undefined {
		if (!selectedSlide || selectedShapeId == null) return undefined;
		return selectedSlide.shapes.find((s) => s.id === selectedShapeId);
	}

	function updateShapeStyle<K extends keyof SlideShape>(key: K, value: SlideShape[K]) {
		const shape = getSelectedShape();
		if (!shape) return;
		saveHistory();
		shape[key] = value;
	}

	// Unified toolbar helpers for textbox/shape
	function toolbarSet(key: string, value: any) {
		if (getSelectedCell()) updateTableCellStyle(key as any, value);
		else if (getSelectedTextbox()) updateTextboxStyle(key as any, value);
		else if (getSelectedShape()) updateShapeStyle(key as any, value);
	}

	function moveLayer(action: 'front' | 'back' | 'forward' | 'backward') {
		if (!selectedSlide) return;
		let arr: any[] | null = null;
		let id: number | null = null;
		if (selectedTextboxId != null) { arr = selectedSlide.textboxes; id = selectedTextboxId; }
		else if (selectedShapeId != null) { arr = selectedSlide.shapes; id = selectedShapeId; }
		else if (selectedImageId != null) { arr = selectedSlide.images; id = selectedImageId; }
		else if (selectedTableId != null) { arr = selectedSlide.tables; id = selectedTableId; }
		if (!arr || id == null) return;
		const idx = arr.findIndex((el: any) => el.id === id);
		if (idx === -1) return;
		saveHistory();
		const [item] = arr.splice(idx, 1);
		if (action === 'front') arr.push(item);
		else if (action === 'back') arr.unshift(item);
		else if (action === 'forward' && idx < arr.length) arr.splice(idx + 1, 0, item);
		else if (action === 'backward' && idx > 0) arr.splice(idx - 1, 0, item);
		else arr.splice(idx, 0, item);
	}

	function deselectAll() {
		if (activeTool) return;
		if (skipNextDeselect) { skipNextDeselect = false; return; }
		selectedTextboxId = null;
		editingTextboxId = null;
		showFormattingToolbar = false;
		activePickerTarget = null;
		selectedImageId = null;
		activeImageId = null;
		imageToolbarAnchorRect = null;
		selectedShapeId = null;
		editingShapeId = null;
		shapeToolbarAnchorRect = null;
		selectedTableId = null;
		editingTableId = null;
		selectedCellRow = null;
		selectedCellCol = null;
		cellSelectionEndRow = null;
		cellSelectionEndCol = null;
		tableToolbarAnchorRect = null;
	}

	function close() {
		closeCamera();
		goto('/');
	}
</script>

<svelte:window
	onclick={(e) => {
		const target = e.target as HTMLElement;
		if (!target.closest('[data-editable]') && !target.closest('[data-textbox]') && !target.closest('[data-image]') && !target.closest('[data-shape]') && !target.closest('[data-table]')) {
			stopEditing();
		}
		if (activePickerTarget && !target.closest('[data-toolbar]')) {
			activePickerTarget = null;
		}
		if (showShapePicker && !target.closest('[data-shape-picker]') && !target.closest('[data-shape-btn]')) {
			showShapePicker = false;
		}
		if (showTablePicker && !target.closest('[data-table-picker]') && !target.closest('[data-table-btn]')) {
			showTablePicker = false;
		}
	}}
	onkeydown={(e) => {
		if (e.key === 'Escape') {
			if (showTablePicker) { showTablePicker = false; return; }
			if (showShapePicker) { showShapePicker = false; return; }
			if (activePickerTarget) { activePickerTarget = null; return; }
			if (selectedCellRow != null) { selectedCellRow = null; selectedCellCol = null; cellSelectionEndRow = null; cellSelectionEndCol = null; tableToolbarAnchorRect = null; return; }
			if (editingTableId) { editingTableId = null; return; }
			if (selectedTableId) { selectedTableId = null; tableToolbarAnchorRect = null; return; }
			if (editingShapeId) { editingShapeId = null; return; }
			if (selectedShapeId) { selectedShapeId = null; shapeToolbarAnchorRect = null; return; }
			if (activeImageId) { activeImageId = null; return; }
			if (selectedImageId) { selectedImageId = null; return; }
			if (editingTextboxId) { editingTextboxId = null; showFormattingToolbar = false; return; }
			if (selectedTextboxId) { selectedTextboxId = null; return; }
			if (activeTool) { activeTool = null; selectedShapeType = null; return; }
			if (editingField) { stopEditing(); return; }
			close();
		}
		if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
			e.preventDefault();
			undo();
		}
		if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
			e.preventDefault();
			redo();
		}
		if (e.key === 'Delete' || e.key === 'Backspace') {
			if (selectedTableId && !editingTableId) {
				e.preventDefault();
				deleteTable(selectedTableId);
				return;
			}
			if (selectedShapeId && !editingShapeId) {
				e.preventDefault();
				deleteShape(selectedShapeId);
				return;
			}
			if (selectedImageId && !activeImageId) {
				e.preventDefault();
				deleteImage(selectedImageId);
				return;
			}
			if (selectedTextboxId && !editingTextboxId) {
				e.preventDefault();
				deleteTextbox(selectedTextboxId);
			}
		}
	}}
	onmousemove={(e) => { handleCanvasMousemove(e); }}
	onmouseup={() => { handleCanvasMouseup(); }}
/>

<!-- Fullscreen overlay -->
<div class="fixed inset-0 z-[100] flex flex-col bg-slate-950">
	<!-- Top Toolbar (full width) -->
	<div class="h-12 shrink-0 bg-slate-900 border-b border-slate-800 flex items-center px-3 gap-1 overflow-visible relative z-[110]">
		<!-- Close button -->
		<button
			class="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
			onclick={(e) => { e.stopPropagation(); close(); }}
			aria-label="Close slideshow"
			title="Close"
		>
			<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>

		<div class="w-px h-6 bg-slate-400 mx-1"></div>

		<!-- Undo / Redo -->
		<button
			class="p-2 rounded-lg transition-colors {undoStack.length > 0 ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-600 cursor-not-allowed'}"
			onclick={undo}
			disabled={undoStack.length === 0}
			aria-label="Undo"
			title="Undo"
		>
			<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
				<path d="M3 7v6h6" /><path d="M3 13a9 9 0 013.27-6.73A9 9 0 0121 12a9 9 0 01-9 9 9 9 0 01-6.18-2.45" />
			</svg>
		</button>
		<button
			class="p-2 rounded-lg transition-colors {redoStack.length > 0 ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-600 cursor-not-allowed'}"
			onclick={redo}
			disabled={redoStack.length === 0}
			aria-label="Redo"
			title="Redo"
		>
			<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
				<path d="M21 7v6h-6" /><path d="M21 13a9 9 0 00-3.27-6.73A9 9 0 003 12a9 9 0 009 9 9 9 0 006.18-2.45" />
			</svg>
		</button>

		<div class="w-px h-6 bg-slate-400 mx-1"></div>

		<!-- Insert: Textbox -->
		<button
			class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors {activeTool === 'textbox'
				? 'bg-indigo-500/20 text-indigo-400'
				: 'text-slate-400 hover:text-white hover:bg-slate-700'}"
			onclick={toggleTextboxTool}
			aria-label="Insert textbox"
			title="Insert Textbox"
		>
			<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
				<path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h8M8 16h4" />
			</svg>
			<span class="hidden lg:inline">Textbox</span>
		</button>

		<!-- Insert: Image -->
		<button
			class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors {activeTool === 'image'
				? 'bg-indigo-500/20 text-indigo-400'
				: 'text-slate-400 hover:text-white hover:bg-slate-700'}"
			onclick={toggleImageTool}
			aria-label="Insert image"
			title="Insert Image"
		>
			<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
				<rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
			</svg>
			<span class="hidden lg:inline">Image</span>
		</button>
		<input
			type="file"
			accept="image/*"
			class="hidden"
			bind:this={fileInputEl}
			onchange={handleFileSelect}
		/>

		<!-- Insert: Shape -->
		<div class="relative" data-shape-btn>
			<button
				class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors {showShapePicker || activeTool === 'shape'
					? 'bg-indigo-500/20 text-indigo-400'
					: 'text-slate-400 hover:text-white hover:bg-slate-700'}"
				onclick={toggleShapePicker}
				aria-label="Insert shape"
				title="Insert Shape"
			>
				<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
					<rect x="3" y="10" width="13" height="13" rx="2" />
					<circle cx="15" cy="8" r="7" />
				</svg>
				<span class="hidden lg:inline">Shape</span>
			</button>

			{#if showShapePicker}
				<div
					class="absolute top-full left-0 mt-1 p-3 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 grid grid-cols-4 gap-2 w-[280px]"
					data-shape-picker data-shape-btn
					onclick={(e) => e.stopPropagation()}
				>
					<button class="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-slate-700 transition-colors" title="Line" onclick={() => pickShapeType('line')}>
						<svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><line x1="4" y1="12" x2="20" y2="12"/></svg>
						<span class="text-[10px] text-slate-400">Line</span>
					</button>
					<button class="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-slate-700 transition-colors" title="Arrow" onclick={() => pickShapeType('arrow')}>
						<svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="16,8 20,12 16,16"/></svg>
						<span class="text-[10px] text-slate-400">Arrow</span>
					</button>
					<button class="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-slate-700 transition-colors" title="Square" onclick={() => pickShapeType('square')}>
						<svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><rect x="4" y="4" width="16" height="16"/></svg>
						<span class="text-[10px] text-slate-400">Square</span>
					</button>
					<button class="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-slate-700 transition-colors" title="Rounded" onclick={() => pickShapeType('rounded-square')}>
						<svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="4"/></svg>
						<span class="text-[10px] text-slate-400">Rounded</span>
					</button>
					<button class="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-slate-700 transition-colors" title="Circle" onclick={() => pickShapeType('circle')}>
						<svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><ellipse cx="12" cy="12" rx="8" ry="8"/></svg>
						<span class="text-[10px] text-slate-400">Circle</span>
					</button>
					<button class="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-slate-700 transition-colors" title="Triangle" onclick={() => pickShapeType('triangle')}>
						<svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><polygon points="12,4 22,20 2,20"/></svg>
						<span class="text-[10px] text-slate-400">Triangle</span>
					</button>
					<button class="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-slate-700 transition-colors" title="Diamond" onclick={() => pickShapeType('diamond')}>
						<svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><polygon points="12,3 21,12 12,21 3,12"/></svg>
						<span class="text-[10px] text-slate-400">Diamond</span>
					</button>
					<button class="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-slate-700 transition-colors" title="Star" onclick={() => pickShapeType('star')}>
						<svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
						<span class="text-[10px] text-slate-400">Star</span>
					</button>
				</div>
			{/if}
		</div>

		<!-- Insert: Table -->
		<div class="relative" data-table-btn>
			<button
				class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors {showTablePicker
					? 'bg-indigo-500/20 text-indigo-400'
					: 'text-slate-400 hover:text-white hover:bg-slate-700'}"
				onclick={toggleTablePicker}
				aria-label="Insert table"
				title="Insert Table"
			>
				<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
					<rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
				</svg>
				<span class="hidden lg:inline">Table</span>
			</button>

			{#if showTablePicker}
				<div
					class="absolute top-full left-0 mt-1 p-3 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 w-[180px]"
					data-table-picker data-table-btn
					onclick={(e) => e.stopPropagation()}
				>
					<p class="text-[10px] text-slate-400 uppercase tracking-wider mb-2 text-center">
						{tablePickerHoverRows > 0 && tablePickerHoverCols > 0 ? `${tablePickerHoverCols} x ${tablePickerHoverRows}` : 'Select size'}
					</p>
					<div class="grid grid-cols-4 gap-1">
						{#each Array(4) as _, r}
							{#each Array(4) as _, c}
								<button
									class="w-8 h-8 rounded border-2 transition-colors {r < tablePickerHoverRows && c < tablePickerHoverCols ? 'bg-indigo-500/30 border-indigo-500' : 'bg-slate-700 border-slate-600 hover:border-slate-500'}"
									onmouseenter={() => { tablePickerHoverRows = r + 1; tablePickerHoverCols = c + 1; }}
									onclick={() => insertTable(r + 1, c + 1)}
								></button>
							{/each}
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Body: Sidebar + Slide Content -->
	<div class="flex flex-1 min-h-0">
	<!-- Left Panel: Slide Thumbnails -->
	<div class="w-56 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">

		<div class="flex-1 overflow-y-auto p-3 space-y-3">
			{#each slides as slide, i}
				<button
					class="w-full group relative"
					onclick={() => {
						selectedSlideId = slide.id;
						editingField = null;
						selectedTextboxId = null;
						editingTextboxId = null;
						selectedImageId = null;
						activeImageId = null;
						selectedShapeId = null;
						editingShapeId = null;
						selectedTableId = null;
						editingTableId = null;
						selectedCellRow = null;
						selectedCellCol = null;
						cellSelectionEndRow = null;
						cellSelectionEndCol = null;
					}}
				>
					<!-- Slide number badge -->
					<span class="absolute -top-1.5 -left-1 z-10 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold {selectedSlideId === slide.id
						? 'bg-indigo-500 text-white'
						: 'bg-slate-700 text-slate-400'}"
					>
						{i + 1}
					</span>

					<!-- Mini slide preview -->
					<div
						class="w-full aspect-[16/10] rounded-lg border-2 overflow-hidden transition-all {selectedSlideId === slide.id
							? 'border-indigo-500 shadow-lg shadow-indigo-500/20'
							: 'border-slate-700 hover:border-slate-600'}"
					>
						<div class="w-full h-full bg-slate-900 relative overflow-hidden">
							<!-- Title & description -->
							{#if slide.isLanding}
								<div class="absolute inset-0 flex items-center justify-center p-2">
									<div class="text-center overflow-hidden">
										<p class="text-[7px] font-bold text-white leading-tight truncate">{slide.title}</p>
										{#if slide.description}
											<p class="text-[5px] text-slate-400 mt-0.5 leading-tight line-clamp-2">{slide.description}</p>
										{/if}
									</div>
								</div>
							{:else}
								<div class="p-2 overflow-hidden">
									<p class="text-[6px] font-bold text-white leading-tight truncate">{slide.title}</p>
									{#if slide.description}
										<p class="text-[4px] text-slate-400 mt-0.5 leading-tight line-clamp-2">{slide.description}</p>
									{/if}
								</div>
							{/if}
							<!-- Textboxes -->
							{#each slide.textboxes as tb}
								<div
									class="absolute overflow-hidden"
									style="left:{tb.x}%;top:{tb.y}%;width:{tb.width}%;min-height:{tb.height}%;background:{tb.bgColor && tb.bgColor !== 'transparent' ? tb.bgColor : 'transparent'}"
								>
									<div class="p-px whitespace-pre-wrap break-words" style="font-family:{tb.fontFamily ?? 'sans-serif'};font-size:3px;font-weight:{tb.bold ? 'bold' : 'normal'};font-style:{tb.italic ? 'italic' : 'normal'};text-decoration:{tb.underline ? 'underline' : 'none'};text-align:{tb.align ?? 'left'};color:{tb.textColor ?? '#ffffff'};background:{tb.highlight ?? 'transparent'};line-height:1.2">{tb.text}</div>
								</div>
							{/each}
							<!-- Images -->
							{#each slide.images as img}
								<div
									class="absolute overflow-hidden rounded-sm {img.src === '' ? 'border border-dashed border-slate-600/50 bg-slate-800/30' : ''}"
									style="left:{img.x}%;top:{img.y}%;width:{img.width}%;height:{img.height}%"
								>
									{#if img.src !== ''}
										<img src={img.src} alt={img.name} class="w-full h-full object-cover" />
									{/if}
								</div>
							{/each}
							<!-- Shapes -->
							{#each (slide.shapes ?? []) as sh}
								<div
									class="absolute overflow-hidden"
									style="left:{sh.x}%;top:{sh.y}%;width:{sh.width}%;height:{sh.height}%"
								>
									<svg class="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
										{#if sh.type === 'circle'}
											<ellipse cx="50" cy="50" rx="48" ry="48" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="4" />
										{:else if sh.type === 'triangle'}
											<polygon points="50,2 98,98 2,98" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="4" />
										{:else if sh.type === 'diamond'}
											<polygon points="50,2 98,50 50,98 2,50" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="4" />
										{:else if sh.type === 'star'}
											<polygon points="50,5 61,35 95,35 68,57 79,90 50,70 21,90 32,57 5,35 39,35" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="4" />
										{:else if sh.type === 'rounded-square'}
											<rect x="2" y="2" width="96" height="96" rx="12" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="4" />
										{:else if sh.type === 'line'}
											<line x1="0" y1="50" x2="100" y2="50" stroke={sh.borderColor} stroke-width="4" />
										{:else if sh.type === 'arrow'}
											<line x1="0" y1="50" x2="90" y2="50" stroke={sh.borderColor} stroke-width="4" />
											<polygon points="85,35 100,50 85,65" fill={sh.borderColor} />
										{:else}
											<rect x="2" y="2" width="96" height="96" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="4" />
										{/if}
									</svg>
									{#if sh.text}
										<div class="absolute inset-0 flex items-center justify-center p-px" style="font-size:3px;color:{sh.textColor};text-align:{sh.align ?? 'center'};font-weight:{sh.bold ? 'bold' : 'normal'};line-height:1.2">{sh.text}</div>
									{/if}
								</div>
							{/each}
							<!-- Tables -->
							{#each (slide.tables ?? []) as tbl}
								<div
									class="absolute overflow-hidden"
									style="left:{tbl.x}%;top:{tbl.y}%;width:{tbl.width}%;height:{tbl.height}%"
								>
									<table class="w-full h-full" style="border-collapse:collapse;table-layout:fixed">
										{#each tbl.cells as row}
											<tr>
												{#each row as c}
													<td class="border border-slate-600/50" style="font-size:3px;color:{c.textColor ?? '#ffffff'};background:{c.bgColor ?? 'transparent'};padding:0 1px;line-height:1.2;vertical-align:top">{c.text}</td>
												{/each}
											</tr>
										{/each}
									</table>
								</div>
							{/each}
						</div>
					</div>

					<!-- Delete button -->
					{#if !slide.isLanding}
						<button
							class="absolute -top-1.5 -right-1 z-10 w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500 text-slate-400 hover:text-white transition-all"
							onclick={(e) => {
								e.stopPropagation();
								deleteSlide(slide.id);
							}}
							aria-label="Delete slide"
						>
							<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
								<path d="M18 6L6 18M6 6l12 12" />
							</svg>
						</button>
					{/if}
				</button>
			{/each}
		</div>

		<div class="p-3 border-t border-slate-800">
			<button
				class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
				onclick={addSlide}
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
					<path d="M12 5v14M5 12h14" />
				</svg>
				Add Slide
			</button>
		</div>
	</div>

	<!-- Right Panel: Slide Canvas -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div bind:this={canvasWrapperEl} class="flex-1 flex items-center justify-center bg-slate-950 p-8 overflow-auto relative" onwheel={handleCanvasWheel}>
		{#if selectedSlide}
			<div
				bind:this={slideCanvasEl}
				class="relative w-full bg-slate-900 rounded-xl border border-slate-800 overflow-hidden select-none origin-center transition-transform duration-100"
				style="max-width:1100px;aspect-ratio:16/10;transform:scale({canvasZoom})"
				class:cursor-crosshair={activeTool === 'textbox' || activeTool === 'image' || activeTool === 'shape'}
				role="presentation"
				onmousedown={handleCanvasMousedown}
				onclick={(e) => {
					const t = e.target as HTMLElement;
					if (!t.closest('[data-textbox]') && !t.closest('[data-editable]') && !t.closest('[data-image]') && !t.closest('[data-shape]') && !t.closest('[data-table]')) {
						deselectAll();
					}
				}}
			>
				<!-- Slide title/description -->
				{#if selectedSlide.isLanding}
					<div class="flex items-center justify-center h-full p-12 pointer-events-none">
						<div class="text-center max-w-3xl w-full space-y-6 pointer-events-auto">
							{#if editingField === 'title'}
								<div data-editable>
									<input
										type="text"
										bind:value={selectedSlide.title}
										onblur={stopEditing}
										onkeydown={handleKeydown}
										class="w-full bg-slate-800 border border-indigo-500/50 rounded-lg px-6 py-4 text-4xl font-bold text-white text-center focus:outline-none focus:border-indigo-500"
										autofocus
									/>
								</div>
							{:else}
								<h1
									data-editable
									class="text-4xl font-bold text-white cursor-pointer hover:text-indigo-300 transition-colors rounded-lg px-6 py-3"
									role="button"
									tabindex="0"
									onclick={() => startEditing('title')}
									onkeydown={(e) => e.key === 'Enter' && startEditing('title')}
								>
									{selectedSlide.title}
								</h1>
							{/if}

							{#if editingField === 'description'}
								<div data-editable>
									<textarea
										bind:value={selectedSlide.description}
										onblur={stopEditing}
										onkeydown={(e) => e.key === 'Escape' && stopEditing()}
										class="w-full bg-slate-800 border border-indigo-500/50 rounded-lg px-6 py-3 text-lg text-slate-300 text-center focus:outline-none focus:border-indigo-500 resize-none"
										rows="3"
										autofocus
									></textarea>
								</div>
							{:else}
								<p
									data-editable
									class="text-lg text-slate-400 cursor-pointer hover:text-slate-200 transition-colors rounded-lg px-6 py-3"
									role="button"
									tabindex="0"
									onclick={() => startEditing('description')}
									onkeydown={(e) => e.key === 'Enter' && startEditing('description')}
								>
									{selectedSlide.description}
								</p>
							{/if}

						</div>
					</div>
				{:else}
					<div class="p-10 max-w-4xl pointer-events-none">
						<div class="pointer-events-auto">
							{#if editingField === 'title'}
								<div data-editable>
									<input
										type="text"
										bind:value={selectedSlide.title}
										onblur={stopEditing}
										onkeydown={handleKeydown}
										class="w-full bg-slate-800 border border-indigo-500/50 rounded-lg px-5 py-3 text-2xl font-bold text-white focus:outline-none focus:border-indigo-500"
										autofocus
									/>
								</div>
							{:else}
								<h2
									data-editable
									class="text-2xl font-bold text-white cursor-pointer hover:text-indigo-300 transition-colors rounded-lg px-5 py-3 -ml-5"
									role="button"
									tabindex="0"
									onclick={() => startEditing('title')}
									onkeydown={(e) => e.key === 'Enter' && startEditing('title')}
								>
									{selectedSlide.title}
								</h2>
							{/if}

							<div class="mt-4">
								{#if editingField === 'description'}
									<div data-editable>
										<textarea
											bind:value={selectedSlide.description}
											onblur={stopEditing}
											onkeydown={(e) => e.key === 'Escape' && stopEditing()}
											class="w-full bg-slate-800 border border-indigo-500/50 rounded-lg px-5 py-3 text-base text-slate-300 focus:outline-none focus:border-indigo-500 resize-none"
											rows="6"
											autofocus
										></textarea>
									</div>
								{:else}
									<p
										data-editable
										class="text-base text-slate-400 cursor-pointer hover:text-slate-200 transition-colors rounded-lg px-5 py-3 -ml-5"
										role="button"
										tabindex="0"
										onclick={() => startEditing('description')}
										onkeydown={(e) => e.key === 'Enter' && startEditing('description')}
									>
										{selectedSlide.description}
									</p>
								{/if}
							</div>

						</div>
					</div>
				{/if}

				<!-- Textboxes layer -->
				{#each selectedSlide.textboxes as tb (tb.id)}
					<div
						data-textbox
						data-textbox-id={tb.id}
						class="absolute border-2 rounded transition-colors touch-none {selectedTextboxId === tb.id
							? 'border-indigo-500 shadow-lg shadow-indigo-500/10 z-20'
							: 'border-slate-600 hover:border-slate-500'}"
						style="left:{tb.x}%;top:{tb.y}%;width:{tb.width}%;min-height:{tb.height}%;background:{tb.bgColor ?? 'transparent'}"
						role="button"
						tabindex="0"
						onpointerdown={(e) => {
							if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
							if (activeTool) return;
							if (editingTextboxId === tb.id) return;
							elementWasSelected = selectedTextboxId === tb.id;
							e.preventDefault();
							selectTextbox(tb.id, e);
							startElementDragPointer('textbox', tb.id, e);
						}}
						onkeydown={(e) => e.key === 'Enter' && startEditingTextbox(tb.id, new MouseEvent('click'))}
					>
						<!-- Toolbar position anchor -->
						{#if selectedTextboxId === tb.id}
							<div class="hidden" use:captureToolbarAnchor></div>
						{/if}

						{#if editingTextboxId === tb.id}
							<textarea
								bind:value={tb.text}
								class="w-full h-full bg-transparent p-2 resize-none focus:outline-none relative z-0 break-words"
								style={buildTextStyle(tb)}
								placeholder="Type here..."
								onclick={(e) => e.stopPropagation()}
								oninput={(e) => {
									const ta = e.currentTarget;
									if (ta.scrollHeight > ta.clientHeight && slideCanvasEl) {
										const canvasH = slideCanvasEl.getBoundingClientRect().height;
										const extra = ta.scrollHeight - ta.clientHeight;
										tb.height += (extra / canvasH) * 100;
									}
								}}
								onkeydown={(e) => {
									if (e.key === 'Escape') {
										if (activePickerTarget) { activePickerTarget = null; }
										else { editingTextboxId = null; showFormattingToolbar = false; }
									}
									e.stopPropagation();
								}}
								autofocus
							></textarea>
						{:else}
							<div class="w-full p-2 whitespace-pre-wrap break-words" style={buildTextStyle(tb)}>
								{#if tb.text}
									{tb.text}
								{:else}
									<span class="text-slate-500 italic">Click to edit</span>
								{/if}
							</div>
						{/if}

						{#if selectedTextboxId === tb.id}
							<!-- Resize corner handles -->
							{#each [
								{ pos: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2', cursor: 'cursor-nwse-resize', corner: 'tl' as const },
								{ pos: 'top-0 right-0 translate-x-1/2 -translate-y-1/2', cursor: 'cursor-nesw-resize', corner: 'tr' as const },
								{ pos: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2', cursor: 'cursor-nesw-resize', corner: 'bl' as const },
								{ pos: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2', cursor: 'cursor-nwse-resize', corner: 'br' as const },
							] as handle}
								<div
									class="absolute {handle.pos} w-4 h-4 rounded-full bg-white border-2 border-indigo-500 {handle.cursor} z-30 touch-none"
									onpointerdown={(e) => handleResizePointerDown(tb.id, handle.corner, e)}
								></div>
							{/each}
						{/if}

						{#if selectedTextboxId === tb.id && editingTextboxId !== tb.id}
							<button
								data-no-drag
								class="absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center transition-colors z-30"
								onclick={(e) => {
									e.stopPropagation();
									deleteTextbox(tb.id);
								}}
								onpointerdown={(e) => e.stopPropagation()}
								aria-label="Delete textbox"
							>
								<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
									<path d="M18 6L6 18M6 6l12 12" />
								</svg>
							</button>
						{/if}
					</div>
				{/each}

				<!-- Images layer -->
				{#each selectedSlide.images as image (image.id)}
					<div
						data-image
						data-image-id={image.id}
						class="absolute rounded transition-colors touch-none {selectedImageId === image.id
							? 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/10 z-20'
							: image.src === ''
								? 'border-2 border-dashed border-slate-600 hover:border-slate-500'
								: 'border-2 border-slate-600 hover:border-slate-500'}"
						style="left:{image.x}%;top:{image.y}%;width:{image.width}%;height:{image.height}%"
						role="button"
						tabindex="0"
						onpointerdown={(e) => {
							if (activeTool) return;
							e.preventDefault();
							selectImage(image.id, e);
							startElementDragPointer('image', image.id, e);
						}}
						onkeydown={(e) => e.key === 'Enter' && selectImage(image.id, new MouseEvent('click'))}
					>
						<!-- Toolbar position anchor -->
						{#if selectedImageId === image.id}
							<div class="hidden" use:captureImageToolbarAnchor></div>
						{/if}

						{#if image.src === ''}
							<!-- Empty placeholder -->
							<div class="w-full h-full flex items-center justify-center bg-slate-800/50">
								<svg class="w-10 h-10 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
									<rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
								</svg>
							</div>
						{:else}
							<!-- Filled image -->
							<img src={image.src} alt={image.name} class="w-full h-full object-cover" />
						{/if}

						{#if selectedImageId === image.id}
							<!-- Resize corner handles -->
							{#each [
								{ pos: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2', cursor: 'cursor-nwse-resize', corner: 'tl' as const },
								{ pos: 'top-0 right-0 translate-x-1/2 -translate-y-1/2', cursor: 'cursor-nesw-resize', corner: 'tr' as const },
								{ pos: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2', cursor: 'cursor-nesw-resize', corner: 'bl' as const },
								{ pos: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2', cursor: 'cursor-nwse-resize', corner: 'br' as const },
							] as handle}
								<div
									class="absolute {handle.pos} w-4 h-4 rounded-full bg-white border-2 border-indigo-500 {handle.cursor} z-30 touch-none"
									onpointerdown={(e) => handleImageResizePointerDown(image.id, handle.corner, e)}
								></div>
							{/each}

							<!-- Delete button -->
							<button
								data-no-drag
								class="absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center transition-colors z-30"
								onclick={(e) => {
									e.stopPropagation();
									deleteImage(image.id);
								}}
								onpointerdown={(e) => e.stopPropagation()}
								aria-label="Delete image"
							>
								<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
									<path d="M18 6L6 18M6 6l12 12" />
								</svg>
							</button>
						{/if}
					</div>
				{/each}

				<!-- Shapes layer -->
				{#each selectedSlide.shapes as shape (shape.id)}
					<div
						data-shape
						data-shape-id={shape.id}
						class="absolute transition-colors touch-none {selectedShapeId === shape.id
							? 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/10 z-20'
							: 'hover:ring-1 hover:ring-slate-500'}"
						style="left:{shape.x}%;top:{shape.y}%;width:{shape.width}%;height:{shape.height}%"
						role="button"
						tabindex="0"
						onpointerdown={(e) => {
							if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
							if (activeTool) return;
							if (editingShapeId === shape.id) return;
							elementWasSelected = selectedShapeId === shape.id;
							e.preventDefault();
							selectShape(shape.id, e);
							startElementDragPointer('shape', shape.id, e);
						}}
						onkeydown={(e) => e.key === 'Enter' && startEditingShape(shape.id, new MouseEvent('click'))}
					>
						<!-- Toolbar position anchor -->
						{#if selectedShapeId === shape.id}
							<div class="hidden" use:captureShapeToolbarAnchor></div>
						{/if}

						<!-- SVG shape -->
						<svg class="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
							{#if shape.type === 'line'}
								<line x1="0" y1="50" x2="100" y2="50" stroke={shape.borderColor} stroke-width={shape.borderWidth * 2} fill="none" />
							{:else if shape.type === 'arrow'}
								<line x1="0" y1="50" x2="90" y2="50" stroke={shape.borderColor} stroke-width={shape.borderWidth * 2} fill="none" />
								<polygon points="85,35 100,50 85,65" fill={shape.borderColor} />
							{:else if shape.type === 'square'}
								<rect x="1" y="1" width="98" height="98" fill={shape.fillColor} stroke={shape.borderColor} stroke-width={shape.borderWidth * 2} vector-effect="non-scaling-stroke" />
							{:else if shape.type === 'rounded-square'}
								<rect x="1" y="1" width="98" height="98" rx="12" fill={shape.fillColor} stroke={shape.borderColor} stroke-width={shape.borderWidth * 2} vector-effect="non-scaling-stroke" />
							{:else if shape.type === 'circle'}
								<ellipse cx="50" cy="50" rx="49" ry="49" fill={shape.fillColor} stroke={shape.borderColor} stroke-width={shape.borderWidth * 2} vector-effect="non-scaling-stroke" />
							{:else if shape.type === 'triangle'}
								<polygon points="50,2 98,98 2,98" fill={shape.fillColor} stroke={shape.borderColor} stroke-width={shape.borderWidth * 2} vector-effect="non-scaling-stroke" />
							{:else if shape.type === 'diamond'}
								<polygon points="50,2 98,50 50,98 2,50" fill={shape.fillColor} stroke={shape.borderColor} stroke-width={shape.borderWidth * 2} vector-effect="non-scaling-stroke" />
							{:else if shape.type === 'star'}
								<polygon points="50,5 61,35 95,35 68,57 79,90 50,70 21,90 32,57 5,35 39,35" fill={shape.fillColor} stroke={shape.borderColor} stroke-width={shape.borderWidth * 2} vector-effect="non-scaling-stroke" />
							{/if}
						</svg>

						<!-- Text overlay -->
						{#if editingShapeId === shape.id}
							<textarea
								bind:value={shape.text}
								class="absolute inset-0 w-full h-full bg-transparent p-2 resize-none focus:outline-none z-10"
								style="{buildShapeTextStyle(shape)}display:flex;align-items:center;justify-content:center"
								placeholder="Type..."
								onclick={(e) => e.stopPropagation()}
								onkeydown={(e) => {
									if (e.key === 'Escape') {
										if (activePickerTarget) { activePickerTarget = null; }
										else { editingShapeId = null; }
									}
									e.stopPropagation();
								}}
								autofocus
							></textarea>
						{:else if shape.text}
							<div class="absolute inset-0 flex items-center justify-center p-2 pointer-events-none z-10" style="{buildShapeTextStyle(shape)}">
								{shape.text}
							</div>
						{/if}

						{#if selectedShapeId === shape.id}
							<!-- Resize corner handles -->
							{#each (shape.type === 'line' || shape.type === 'arrow'
								? [
									{ pos: 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2', cursor: 'cursor-ew-resize', corner: 'tl' as const },
									{ pos: 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2', cursor: 'cursor-ew-resize', corner: 'tr' as const },
								]
								: [
									{ pos: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2', cursor: 'cursor-nwse-resize', corner: 'tl' as const },
									{ pos: 'top-0 right-0 translate-x-1/2 -translate-y-1/2', cursor: 'cursor-nesw-resize', corner: 'tr' as const },
									{ pos: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2', cursor: 'cursor-nesw-resize', corner: 'bl' as const },
									{ pos: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2', cursor: 'cursor-nwse-resize', corner: 'br' as const },
								]
							) as handle}
								<div
									class="absolute {handle.pos} w-4 h-4 rounded-full bg-white border-2 border-indigo-500 {handle.cursor} z-30 touch-none"
									onpointerdown={(e) => handleShapeResizePointerDown(shape.id, handle.corner, e)}
								></div>
							{/each}

							<!-- Delete button -->
							{#if editingShapeId !== shape.id}
								<button
									data-no-drag
									class="absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center transition-colors z-30"
									onclick={(e) => {
										e.stopPropagation();
										deleteShape(shape.id);
									}}
									onpointerdown={(e) => e.stopPropagation()}
									aria-label="Delete shape"
								>
									<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
										<path d="M18 6L6 18M6 6l12 12" />
									</svg>
								</button>
							{/if}
						{/if}
					</div>
				{/each}

				<!-- Tables layer -->
				{#each selectedSlide.tables as table (table.id)}
					<div
						data-table
						data-table-id={table.id}
						class="absolute transition-colors touch-none {selectedTableId === table.id
							? 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/10 z-20'
							: 'hover:ring-1 hover:ring-slate-500'}"
						style="left:{table.x}%;top:{table.y}%;width:{table.width}%;height:{table.height}%"
						role="button"
						tabindex="0"
						onpointerdown={(e) => {
							if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
							if (activeTool) return;
							if (editingTableId === table.id) return;
							if (selectedTableId === table.id) {
								// Already selected → enter edit mode and select the clicked cell
								e.preventDefault();
								e.stopPropagation();
								editingTableId = table.id;
								const tdEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('td');
								const tblEl = tdEl?.closest('table');
								if (tdEl && tblEl) {
									const tr = tdEl.parentElement;
									if (tr) {
										const rows = Array.from(tblEl.querySelectorAll(':scope > tr, :scope > tbody > tr'));
										const ri = rows.indexOf(tr as HTMLTableRowElement);
										const ci = Array.from(tr.children).indexOf(tdEl);
										if (ri >= 0 && ci >= 0) {
											selectedCellRow = ri;
											selectedCellCol = ci;
											cellSelectionEndRow = ri;
											cellSelectionEndCol = ci;
										}
									}
								}
								// Set up drag-to-select listeners so second click can also drag
								isDraggingCellSelection = true;
								const onMove = (ev: PointerEvent) => {
									if (!tblEl) return;
									const tdTarget = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('td');
									if (!tdTarget || !tblEl.contains(tdTarget)) return;
									const tr2 = tdTarget.parentElement;
									if (!tr2) return;
									const rows2 = Array.from(tblEl.querySelectorAll(':scope > tr, :scope > tbody > tr'));
									const rowIdx = rows2.indexOf(tr2 as HTMLTableRowElement);
									const colIdx = Array.from(tr2.children).indexOf(tdTarget);
									if (rowIdx >= 0 && colIdx >= 0 && (rowIdx !== cellSelectionEndRow || colIdx !== cellSelectionEndCol)) {
										cellSelectionEndRow = rowIdx;
										cellSelectionEndCol = colIdx;
									}
								};
								const onUp = () => {
									isDraggingCellSelection = false;
									window.removeEventListener('pointermove', onMove);
									window.removeEventListener('pointerup', onUp);
								};
								window.addEventListener('pointermove', onMove);
								window.addEventListener('pointerup', onUp);
								skipNextDeselect = true;
								return;
							}
							e.preventDefault();
							selectTable(table.id, e);
							startElementDragPointer('table', table.id, e);
						}}
						onkeydown={(e) => e.key === 'Enter' && startEditingTable(table.id, new MouseEvent('click'))}
					>
						<!-- Toolbar position anchor -->
						{#if selectedTableId === table.id}
							<div class="hidden" use:captureTableToolbarAnchor></div>
						{/if}

						<table
							class="w-full h-full select-none"
							style="border-collapse:collapse;table-layout:fixed"
						>
							{#each table.cells as row, ri}
								<tr>
									{#each row as cell, ci}
										<td
											class="relative {editingTableId === table.id ? 'border border-slate-500' : 'border border-slate-700/50'} {isCellInSelection(ri, ci) && editingTableId === table.id ? 'ring-2 ring-inset ring-indigo-500' : ''}"
											style="background:{cell.bgColor ?? 'transparent'};vertical-align:top"
											onpointerdown={(e) => {
												if (editingTableId !== table.id) return;
												e.stopPropagation();
												e.preventDefault();
												selectedCellRow = ri;
												selectedCellCol = ci;
												cellSelectionEndRow = ri;
												cellSelectionEndCol = ci;
												isDraggingCellSelection = true;
												const tableEl = (e.currentTarget as HTMLElement).closest('table');
												const onMove = (ev: PointerEvent) => {
													if (!tableEl) return;
													const tdTarget = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('td');
													if (!tdTarget || !tableEl.contains(tdTarget)) return;
													const tr2 = tdTarget.parentElement;
													if (!tr2) return;
													const rows2 = Array.from(tableEl.querySelectorAll(':scope > tr, :scope > tbody > tr'));
													const rowIdx = rows2.indexOf(tr2 as HTMLTableRowElement);
													const colIdx = Array.from(tr2.children).indexOf(tdTarget);
													if (rowIdx >= 0 && colIdx >= 0 && (rowIdx !== cellSelectionEndRow || colIdx !== cellSelectionEndCol)) {
														cellSelectionEndRow = rowIdx;
														cellSelectionEndCol = colIdx;
													}
												};
												const onUp = () => {
													isDraggingCellSelection = false;
													window.removeEventListener('pointermove', onMove);
													window.removeEventListener('pointerup', onUp);
												};
												window.addEventListener('pointermove', onMove);
												window.addEventListener('pointerup', onUp);
											}}
										>
											{#if editingTableId === table.id && selectedCellRow === ri && selectedCellCol === ci && !isMultiCellSelection()}
												<textarea
													bind:value={cell.text}
													class="w-full h-full bg-transparent p-1 resize-none focus:outline-none text-white"
													style={buildTableCellStyle(cell)}
													placeholder=""
													onclick={(e) => e.stopPropagation()}
													onkeydown={(e) => {
														if (e.key === 'Tab') {
															e.preventDefault();
															let nr = ri, nc = ci + 1;
															if (nc >= table.cols) { nc = 0; nr = (ri + 1) % table.rows; }
															selectCell(nr, nc);
														}
														if (e.key === 'Escape') {
															if (activePickerTarget) { activePickerTarget = null; }
															else { selectedCellRow = null; selectedCellCol = null; cellSelectionEndRow = null; cellSelectionEndCol = null; tableToolbarAnchorRect = null; }
														}
														e.stopPropagation();
													}}
													autofocus
												></textarea>
											{:else}
												<div class="w-full p-1 whitespace-pre-wrap break-words min-h-[1.5em]" style={buildTableCellStyle(cell)}>
													{cell.text}
												</div>
											{/if}
										</td>
									{/each}
								</tr>
							{/each}
						</table>

						{#if selectedTableId === table.id}
							<!-- Resize corner handles -->
							{#each [
								{ pos: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2', cursor: 'cursor-nwse-resize', corner: 'tl' as const },
								{ pos: 'top-0 right-0 translate-x-1/2 -translate-y-1/2', cursor: 'cursor-nesw-resize', corner: 'tr' as const },
								{ pos: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2', cursor: 'cursor-nesw-resize', corner: 'bl' as const },
								{ pos: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2', cursor: 'cursor-nwse-resize', corner: 'br' as const },
							] as handle}
								<div
									class="absolute {handle.pos} w-4 h-4 rounded-full bg-white border-2 border-indigo-500 {handle.cursor} z-30 touch-none"
									onpointerdown={(e) => handleTableResizePointerDown(table.id, handle.corner, e)}
								></div>
							{/each}

							<!-- Delete button -->
							{#if editingTableId !== table.id}
								<button
									data-no-drag
									class="absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center transition-colors z-30"
									onclick={(e) => {
										e.stopPropagation();
										deleteTable(table.id);
									}}
									onpointerdown={(e) => e.stopPropagation()}
									aria-label="Delete table"
								>
									<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
										<path d="M18 6L6 18M6 6l12 12" />
									</svg>
								</button>
							{/if}
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<!-- Snackbar hint when placing tool is active -->
		{#if activeTool === 'textbox' || activeTool === 'image' || activeTool === 'shape'}
			<div class="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl text-sm text-slate-300 flex items-center gap-2 pointer-events-none">
				<svg class="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 15l-2 5L9 9l11 4-5 2z"/></svg>
				Click on the slide to place {activeTool === 'textbox' ? 'a text box' : activeTool === 'image' ? 'an image' : 'a shape'}
			</div>
		{/if}
	</div>
	</div>

	<!-- Unified Formatting Toolbar (textbox + shape + table cell) -->
	{#if (selectedTextboxId != null && toolbarAnchorRect && getSelectedTextbox()) || (selectedShapeId != null && shapeToolbarAnchorRect && getSelectedShape()) || (selectedTableId != null && tableToolbarAnchorRect && getSelectedCell())}
		{@const isTable = selectedTableId != null && tableToolbarAnchorRect != null && getSelectedCell() != null}
		{@const isShape = !isTable && selectedShapeId != null && shapeToolbarAnchorRect != null && getSelectedShape() != null}
		{@const anchorRect = isTable ? tableToolbarAnchorRect! : isShape ? shapeToolbarAnchorRect! : toolbarAnchorRect!}
		{@const pickerBelow = (anchorRect.top - 100) < window.innerHeight / 2}
		{@const tb = (!isShape && !isTable) ? getSelectedTextbox()! : null}
		{@const shape = isShape ? getSelectedShape()! : null}
		{@const cell = isTable ? getSelectedCell()! : null}
		{@const defaultAlign = isShape ? 'center' : 'left'}
		<div
			class="fixed z-[150] bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 shadow-xl whitespace-nowrap"
			data-toolbar
			style="top:{anchorRect.top - 100}px;left:{slideCanvasEl ? slideCanvasEl.getBoundingClientRect().left + slideCanvasEl.getBoundingClientRect().width / 2 : 0}px;transform:translateX(-50%)"
			onclick={(e) => e.stopPropagation()}
			onmousedown={(e) => { if (!(e.target instanceof HTMLSelectElement)) e.preventDefault(); }}
		>
			<!-- Row 1: Font family, size, B I U -->
			<div class="flex items-center gap-1.5">
				<select
					class="bg-slate-700 text-white text-sm rounded-lg px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-indigo-500 max-w-[120px]"
					value={(tb?.fontFamily ?? shape?.fontFamily ?? cell?.fontFamily) ?? 'sans-serif'}
					onchange={(e) => toolbarSet('fontFamily', (e.target as HTMLSelectElement).value)}
				>
					{#each fontOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>

				<div class="flex items-center gap-1 ml-1">
					<button
						class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-600 text-sm"
						onclick={() => toolbarSet('fontSize', Math.max(8, ((tb?.fontSize ?? shape?.fontSize ?? cell?.fontSize) ?? 14) - 2))}
						title="Decrease font size"
					>&minus;</button>
					<span class="text-sm text-slate-300 w-7 text-center">{(tb?.fontSize ?? shape?.fontSize) ?? 14}</span>
					<button
						class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-600 text-sm"
						onclick={() => toolbarSet('fontSize', Math.min(72, ((tb?.fontSize ?? shape?.fontSize ?? cell?.fontSize) ?? 14) + 2))}
						title="Increase font size"
					>+</button>
				</div>

				<div class="w-px h-7 bg-slate-600 mx-1"></div>

				<button
					class="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-colors {(tb?.bold ?? shape?.bold ?? cell?.bold) ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-slate-600'}"
					onclick={() => toolbarSet('bold', !(tb?.bold ?? shape?.bold ?? cell?.bold))}
					title="Bold"
				>B</button>
				<button
					class="w-8 h-8 flex items-center justify-center rounded-lg text-sm italic transition-colors {(tb?.italic ?? shape?.italic ?? cell?.italic) ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-slate-600'}"
					onclick={() => toolbarSet('italic', !(tb?.italic ?? shape?.italic ?? cell?.italic))}
					title="Italic"
				>I</button>
				<button
					class="w-8 h-8 flex items-center justify-center rounded-lg text-sm underline transition-colors {(tb?.underline ?? shape?.underline ?? cell?.underline) ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-slate-600'}"
					onclick={() => toolbarSet('underline', !(tb?.underline ?? shape?.underline ?? cell?.underline))}
					title="Underline"
				>U</button>
			</div>

			<div class="h-px bg-slate-600 my-1.5"></div>

			<!-- Row 2: Alignment, colors, stroke -->
			<div class="flex items-center gap-1.5">
				<!-- Alignment -->
				<button
					class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors {((tb?.align ?? shape?.align ?? cell?.align) ?? defaultAlign) === 'left' ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-slate-600'}"
					onclick={() => toolbarSet('align', 'left')}
					title="Align left"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M3 12h12M3 18h16"/></svg>
				</button>
				<button
					class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors {((tb?.align ?? shape?.align ?? cell?.align) ?? defaultAlign) === 'center' ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-slate-600'}"
					onclick={() => toolbarSet('align', 'center')}
					title="Align center"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M6 12h12M5 18h14"/></svg>
				</button>
				<button
					class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors {((tb?.align ?? shape?.align ?? cell?.align) ?? defaultAlign) === 'right' ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-slate-600'}"
					onclick={() => toolbarSet('align', 'right')}
					title="Align right"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M9 12h12M5 18h16"/></svg>
				</button>

				<div class="w-px h-7 bg-slate-600 mx-1"></div>

				<!-- Text color -->
				<div class="relative">
					<button
						class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-sm font-bold hover:bg-slate-600"
						style="color:{(tb?.textColor ?? shape?.textColor ?? cell?.textColor) ?? '#ffffff'}"
						onclick={() => { activePickerTarget = activePickerTarget === 'text' ? null : 'text'; }}
						title="Text color"
					>A
						<span class="absolute bottom-0.5 left-1.5 right-1.5 h-1 rounded-full" style="background:{(tb?.textColor ?? shape?.textColor ?? cell?.textColor) ?? '#ffffff'}"></span>
					</button>
					{#if activePickerTarget === 'text'}
						<div class="absolute {pickerBelow ? 'top-full mt-2' : 'bottom-full mb-2'} right-0 p-3 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 w-[220px]" data-toolbar>
							<p class="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Text Color</p>
							<div class="grid grid-cols-7 gap-1.5">
								{#each presetColors as c}
									<button
										class="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 {c === ((tb?.textColor ?? shape?.textColor ?? cell?.textColor) ?? '#ffffff') ? 'border-indigo-400 ring-2 ring-indigo-400/50' : 'border-slate-600'}"
										style="background:{c}"
										onclick={() => { toolbarSet('textColor', c); activePickerTarget = null; }}
									></button>
								{/each}
								<button
									class="w-7 h-7 rounded-full border-2 border-dashed border-slate-500 hover:border-slate-300 flex items-center justify-center transition-colors"
									title="Custom color"
									onclick={() => {
										const input = document.createElement('input');
										input.type = 'color';
										input.value = (tb?.textColor ?? shape?.textColor ?? cell?.textColor) ?? '#ffffff';
										input.oninput = () => { toolbarSet('textColor', input.value); };
										input.click();
									}}
								>
									<svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
								</button>
							</div>
						</div>
					{/if}
				</div>

				<!-- Highlight color -->
				<div class="relative">
					<button
						class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-slate-600 text-slate-400"
						title="Highlight color"
						onclick={() => { activePickerTarget = activePickerTarget === 'highlight' ? null : 'highlight'; }}
					>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
						</svg>
						<span class="absolute bottom-0.5 left-1.5 right-1.5 h-1 rounded-full" style="background:{(tb?.highlight ?? shape?.highlight ?? cell?.highlight) && (tb?.highlight ?? shape?.highlight ?? cell?.highlight) !== 'transparent' ? (tb?.highlight ?? shape?.highlight ?? cell?.highlight) : '#64748b'}"></span>
					</button>
					{#if activePickerTarget === 'highlight'}
						{@const hlVal = (tb?.highlight ?? shape?.highlight ?? cell?.highlight) ?? 'transparent'}
						<div class="absolute {pickerBelow ? 'top-full mt-2' : 'bottom-full mb-2'} right-0 p-3 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 w-[220px]" data-toolbar>
							<p class="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Highlight</p>
							<div class="grid grid-cols-7 gap-1.5">
								<button
									class="w-7 h-7 rounded-full border-2 border-slate-500 transition-transform hover:scale-110 {hlVal === 'transparent' ? 'ring-2 ring-indigo-400/50' : ''}"
									style="background:repeating-conic-gradient(#475569 0% 25%, #334155 0% 50%) 50% / 8px 8px"
									onclick={() => { toolbarSet('highlight', 'transparent'); activePickerTarget = null; }}
									title="None"
								></button>
								{#each presetColors as c}
									<button
										class="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 {c === hlVal ? 'border-indigo-400 ring-2 ring-indigo-400/50' : 'border-slate-600'}"
										style="background:{c}"
										onclick={() => { toolbarSet('highlight', c); activePickerTarget = null; }}
									></button>
								{/each}
								<button
									class="w-7 h-7 rounded-full border-2 border-dashed border-slate-500 hover:border-slate-300 flex items-center justify-center transition-colors"
									title="Custom color"
									onclick={() => {
										const input = document.createElement('input');
										input.type = 'color';
										input.value = (hlVal !== 'transparent') ? hlVal : '#eab308';
										input.oninput = () => { toolbarSet('highlight', input.value); };
										input.click();
									}}
								>
									<svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
								</button>
							</div>
						</div>
					{/if}
				</div>

				<!-- Background / Fill color -->
				<div class="relative">
					<button
						class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-slate-600 text-slate-400"
						title="{isShape ? 'Fill' : 'Background'} color"
						onclick={() => { activePickerTarget = activePickerTarget === 'bg' ? null : 'bg'; }}
					>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<rect x="3" y="3" width="18" height="18" rx="2"/>
						</svg>
						<span class="absolute bottom-0.5 left-1.5 right-1.5 h-1 rounded-full" style="background:{(cell ? (cell.bgColor ?? 'transparent') : tb ? (tb.bgColor ?? 'transparent') : (shape?.fillColor ?? 'transparent')) !== 'transparent' ? (cell ? (cell.bgColor ?? 'transparent') : tb ? (tb.bgColor ?? 'transparent') : (shape?.fillColor ?? 'transparent')) : '#64748b'}"></span>
					</button>
					{#if activePickerTarget === 'bg'}
						{@const bgVal = cell ? (cell.bgColor ?? 'transparent') : tb ? (tb.bgColor ?? 'transparent') : (shape?.fillColor ?? 'transparent')}
						<div class="absolute {pickerBelow ? 'top-full mt-2' : 'bottom-full mb-2'} right-0 p-3 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 w-[220px]" data-toolbar>
							<p class="text-[10px] text-slate-400 uppercase tracking-wider mb-2">{isShape ? 'Fill' : 'Background'}</p>
							<div class="grid grid-cols-7 gap-1.5">
								<button
									class="w-7 h-7 rounded-full border-2 border-slate-500 transition-transform hover:scale-110 {bgVal === 'transparent' ? 'ring-2 ring-indigo-400/50' : ''}"
									style="background:repeating-conic-gradient(#475569 0% 25%, #334155 0% 50%) 50% / 8px 8px"
									onclick={() => { toolbarSet(isTable ? 'bgColor' : isShape ? 'fillColor' : 'bgColor', 'transparent'); activePickerTarget = null; }}
									title="None"
								></button>
								{#each presetColors as c}
									<button
										class="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 {(() => { if (cell) { return c === (cell.bgColor ?? 'transparent'); } if (tb) { const p = parseColorAndOpacity(tb.bgColor); return p.hex === c && p.opacity > 0; } return c === shape?.fillColor; })() ? 'border-indigo-400 ring-2 ring-indigo-400/50' : 'border-slate-600'}"
										style="background:{c}"
										onclick={() => {
											if (cell) { toolbarSet('bgColor', c); activePickerTarget = null; }
											else if (tb) { const p = parseColorAndOpacity(tb.bgColor); applyBgColorWithOpacity(c, p.opacity || 1); }
											else { toolbarSet('fillColor', c); activePickerTarget = null; }
										}}
									></button>
								{/each}
								<button
									class="w-7 h-7 rounded-full border-2 border-dashed border-slate-500 hover:border-slate-300 flex items-center justify-center transition-colors"
									title="Custom color"
									onclick={() => {
										const input = document.createElement('input');
										input.type = 'color';
										if (cell) { input.value = (cell.bgColor && cell.bgColor !== 'transparent') ? cell.bgColor : '#0f172a'; input.oninput = () => { toolbarSet('bgColor', input.value); }; }
										else if (tb) { const p = parseColorAndOpacity(tb.bgColor); input.value = p.hex; input.oninput = () => { applyBgColorWithOpacity(input.value, p.opacity || 1); }; }
										else { input.value = (shape?.fillColor !== 'transparent' ? shape?.fillColor : '#0f172a') ?? '#0f172a'; input.oninput = () => { toolbarSet('fillColor', input.value); }; }
										input.click();
									}}
								>
									<svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
								</button>
							</div>
							{#if tb}
								{@const bgParsed = parseColorAndOpacity(tb.bgColor)}
								<div class="mt-3 flex items-center gap-2">
									<span class="text-[10px] text-slate-400 shrink-0">Opacity</span>
									<input
										type="range" min="0" max="100" step="1"
										value={Math.round(bgParsed.opacity * 100)}
										class="flex-1 h-1.5 accent-indigo-500 bg-slate-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-indigo-500"
										oninput={(e) => {
											const val = parseInt((e.target as HTMLInputElement).value) / 100;
											const hex = bgParsed.hex === '#000000' && (!tb.bgColor || tb.bgColor === 'transparent') ? '#0f172a' : bgParsed.hex;
											applyBgColorWithOpacity(hex, val);
										}}
									/>
									<span class="text-[10px] text-slate-300 w-7 text-right">{Math.round(bgParsed.opacity * 100)}%</span>
								</div>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Stroke (shape only) -->
				{#if isShape && shape}
					<div class="w-px h-7 bg-slate-600 mx-1"></div>
					<div class="relative">
						<button
							class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-slate-600 text-slate-400"
							title="Stroke"
							onclick={() => { activePickerTarget = activePickerTarget === 'stroke' ? null : 'stroke'; }}
						>
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 2"/></svg>
							<span class="absolute bottom-0.5 left-1.5 right-1.5 h-1 rounded-full" style="background:{shape.borderColor}"></span>
						</button>
						{#if activePickerTarget === 'stroke'}
							<div class="absolute {pickerBelow ? 'top-full mt-2' : 'bottom-full mb-2'} right-0 p-3 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 w-[220px]" data-toolbar>
								<p class="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Stroke</p>
								<div class="grid grid-cols-7 gap-1.5">
									{#each presetColors as c}
										<button
											class="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 {c === shape.borderColor ? 'border-indigo-400 ring-2 ring-indigo-400/50' : 'border-slate-600'}"
											style="background:{c}"
											onclick={() => { updateShapeStyle('borderColor', c); }}
										></button>
									{/each}
									<button
										class="w-7 h-7 rounded-full border-2 border-dashed border-slate-500 hover:border-slate-300 flex items-center justify-center transition-colors"
										title="Custom color"
										onclick={() => {
											const input = document.createElement('input');
											input.type = 'color';
											input.value = shape.borderColor;
											input.oninput = () => { updateShapeStyle('borderColor', input.value); };
											input.click();
										}}
									>
										<svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
									</button>
								</div>
								<div class="mt-3 flex items-center gap-2">
									<span class="text-[10px] text-slate-400 shrink-0">Thickness</span>
									<input
										type="range" min="0" max="10" step="1"
										value={shape.borderWidth}
										class="flex-1 h-1.5 accent-indigo-500 bg-slate-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-indigo-500"
										oninput={(e) => { updateShapeStyle('borderWidth', parseInt((e.target as HTMLInputElement).value)); }}
									/>
									<span class="text-[10px] text-slate-300 w-5 text-right">{shape.borderWidth}px</span>
								</div>
							</div>
						{/if}
					</div>
				{/if}

				<div class="w-px h-7 bg-slate-600 mx-1"></div>

				<!-- Layer ordering -->
				<div class="relative">
					<button
						class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-slate-600 text-slate-400"
						title="Layer order"
						onclick={() => { activePickerTarget = activePickerTarget === 'layers' ? null : 'layers'; }}
					>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
						</svg>
					</button>
					{#if activePickerTarget === 'layers'}
						<div class="absolute {pickerBelow ? 'top-full mt-2' : 'bottom-full mb-2'} right-0 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 py-1 flex flex-col" data-toolbar>
							<button class="px-4 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors whitespace-nowrap" onclick={() => { moveLayer('front'); activePickerTarget = null; }}>Bring to Front</button>
							<button class="px-4 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors whitespace-nowrap" onclick={() => { moveLayer('forward'); activePickerTarget = null; }}>Bring Forward</button>
							<button class="px-4 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors whitespace-nowrap" onclick={() => { moveLayer('backward'); activePickerTarget = null; }}>Send Backward</button>
							<button class="px-4 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors whitespace-nowrap" onclick={() => { moveLayer('back'); activePickerTarget = null; }}>Send to Back</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Floating Image Toolbar -->
	{#if selectedImageId != null && activeImageId != null && imageToolbarAnchorRect}
		<div
			class="fixed z-[150] flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 shadow-xl whitespace-nowrap"
			data-image
			style="top:{imageToolbarAnchorRect.top - 60}px;left:{imageToolbarAnchorRect.left + imageToolbarAnchorRect.width / 2}px;transform:translateX(-50%)"
			onclick={(e) => e.stopPropagation()}
			onmousedown={(e) => e.preventDefault()}
		>
			<button
				class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-white transition-colors"
				onclick={openFilePicker}
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
					<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
				</svg>
				Upload
			</button>
			<button
				class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-white transition-colors"
				onclick={openCamera}
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
					<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" />
				</svg>
				Camera
			</button>
		</div>
	{/if}




	<!-- Camera Modal -->
	{#if showCameraModal}
		<div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/80">
			<div class="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
				<div class="flex items-center justify-between px-5 py-4 border-b border-slate-800">
					<h3 class="text-lg font-semibold text-white">Take a Photo</h3>
					<button
						class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
						onclick={closeCamera}
						aria-label="Close camera"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>
				</div>
				<div class="p-5 flex flex-col items-center gap-4">
					<div class="w-full aspect-video bg-black rounded-lg overflow-hidden">
						<!-- svelte-ignore element_invalid_self_closing_tag -->
						<video bind:this={videoEl} class="w-full h-full object-cover" autoplay playsinline muted />
					</div>
					<canvas bind:this={canvasEl} class="hidden"></canvas>
					<button
						class="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
						onclick={capturePhoto}
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
							<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" />
						</svg>
						Capture
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
