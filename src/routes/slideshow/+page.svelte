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

	interface Slide {
		id: number;
		title: string;
		description: string;
		isLanding: boolean;
		images: SlideImage[];
		textboxes: TextBox[];
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
	let slides = $state<Slide[]>(
		saved?.slides ?? [
			{ id: 1, title: 'Welcome to the Presentation', description: 'Click to edit this description', isLanding: true, images: [], textboxes: [] }
		]
	);
	let selectedSlideId = $state(saved?.selectedSlideId ?? 1);

	$effect(() => {
		const data = {
			slides: $state.snapshot(slides),
			selectedSlideId,
			nextId,
			nextImageId,
			nextTextboxId
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	});
	let editingField = $state<'title' | 'description' | null>(null);

	// Image selection state
	let selectedImageId = $state<number | null>(null);
	let activeImageId = $state<number | null>(null);
	let showCameraModal = $state(false);
	let videoEl = $state<HTMLVideoElement | null>(null);
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let fileInputEl = $state<HTMLInputElement | null>(null);
	let cameraStream = $state<MediaStream | null>(null);

	let selectedSlide = $derived(slides.find((s) => s.id === selectedSlideId));

	// Tool state
	let activeTool = $state<'textbox' | 'image' | null>(null);

	// Drawing state
	let isDrawing = $state(false);
	let drawStart = $state<{ x: number; y: number } | null>(null);
	let drawCurrent = $state<{ x: number; y: number } | null>(null);
	let slideCanvasEl = $state<HTMLDivElement | null>(null);

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

	// Textbox dragging
	let isDraggingTextbox = $state(false);
	let dragTextboxId = $state<number | null>(null);
	let dragOffset = $state<{ x: number; y: number } | null>(null);

	function startDragTextbox(tbId: number, e: MouseEvent) {
		if (!slideCanvasEl) return;
		const tb = selectedSlide?.textboxes.find((t) => t.id === tbId);
		if (!tb) return;
		e.preventDefault();
		const rect = slideCanvasEl.getBoundingClientRect();
		const mouseXPct = ((e.clientX - rect.left) / rect.width) * 100;
		const mouseYPct = ((e.clientY - rect.top) / rect.height) * 100;
		dragOffset = { x: mouseXPct - tb.x, y: mouseYPct - tb.y };
		dragTextboxId = tbId;
		isDraggingTextbox = true;
		saveHistory();
	}

	function handleDragTextboxMove(e: MouseEvent) {
		if (!isDraggingTextbox || dragTextboxId == null || !dragOffset || !slideCanvasEl || !selectedSlide) return;
		const tb = selectedSlide.textboxes.find((t) => t.id === dragTextboxId);
		if (!tb) return;
		const rect = slideCanvasEl.getBoundingClientRect();
		const mouseXPct = ((e.clientX - rect.left) / rect.width) * 100;
		const mouseYPct = ((e.clientY - rect.top) / rect.height) * 100;
		tb.x = Math.max(0, Math.min(100 - tb.width, mouseXPct - dragOffset.x));
		tb.y = Math.max(0, Math.min(100 - tb.height, mouseYPct - dragOffset.y));
		// Update toolbar position
		const tbEl = slideCanvasEl.querySelector(`[data-textbox-id="${dragTextboxId}"]`) as HTMLElement | null;
		if (tbEl) {
			const tbRect = tbEl.getBoundingClientRect();
			toolbarAnchorRect = { top: tbRect.top, left: tbRect.left, width: tbRect.width };
		}
	}

	function stopDragTextbox() {
		isDraggingTextbox = false;
		dragTextboxId = null;
		dragOffset = null;
	}

	// Textbox resizing
	let isResizingTextbox = $state(false);
	let resizeTextboxId = $state<number | null>(null);
	let resizeCorner = $state<'tl' | 'tr' | 'bl' | 'br' | null>(null);
	let resizeStart = $state<{ x: number; y: number; tbX: number; tbY: number; tbW: number; tbH: number } | null>(null);

	function startResizeTextbox(tbId: number, corner: 'tl' | 'tr' | 'bl' | 'br', e: MouseEvent) {
		if (!slideCanvasEl) return;
		const tb = selectedSlide?.textboxes.find((t) => t.id === tbId);
		if (!tb) return;
		e.preventDefault();
		e.stopPropagation();
		const rect = slideCanvasEl.getBoundingClientRect();
		const mouseXPct = ((e.clientX - rect.left) / rect.width) * 100;
		const mouseYPct = ((e.clientY - rect.top) / rect.height) * 100;
		resizeStart = { x: mouseXPct, y: mouseYPct, tbX: tb.x, tbY: tb.y, tbW: tb.width, tbH: tb.height };
		resizeTextboxId = tbId;
		resizeCorner = corner;
		isResizingTextbox = true;
		saveHistory();
	}

	function handleResizeTextboxMove(e: MouseEvent) {
		if (!isResizingTextbox || resizeTextboxId == null || !resizeCorner || !resizeStart || !slideCanvasEl || !selectedSlide) return;
		const tb = selectedSlide.textboxes.find((t) => t.id === resizeTextboxId);
		if (!tb) return;
		const rect = slideCanvasEl.getBoundingClientRect();
		const mouseXPct = ((e.clientX - rect.left) / rect.width) * 100;
		const mouseYPct = ((e.clientY - rect.top) / rect.height) * 100;
		const dx = mouseXPct - resizeStart.x;
		const dy = mouseYPct - resizeStart.y;
		const MIN = 5;

		if (resizeCorner === 'br') {
			tb.width = Math.max(MIN, resizeStart.tbW + dx);
			tb.height = Math.max(MIN, resizeStart.tbH + dy);
		} else if (resizeCorner === 'bl') {
			const newW = Math.max(MIN, resizeStart.tbW - dx);
			tb.x = resizeStart.tbX + resizeStart.tbW - newW;
			tb.width = newW;
			tb.height = Math.max(MIN, resizeStart.tbH + dy);
		} else if (resizeCorner === 'tr') {
			tb.width = Math.max(MIN, resizeStart.tbW + dx);
			const newH = Math.max(MIN, resizeStart.tbH - dy);
			tb.y = resizeStart.tbY + resizeStart.tbH - newH;
			tb.height = newH;
		} else if (resizeCorner === 'tl') {
			const newW = Math.max(MIN, resizeStart.tbW - dx);
			const newH = Math.max(MIN, resizeStart.tbH - dy);
			tb.x = resizeStart.tbX + resizeStart.tbW - newW;
			tb.y = resizeStart.tbY + resizeStart.tbH - newH;
			tb.width = newW;
			tb.height = newH;
		}
		refreshToolbarPosition();
	}

	function stopResizeTextbox() {
		isResizingTextbox = false;
		resizeTextboxId = null;
		resizeCorner = null;
		resizeStart = null;
	}

	// Formatting toolbar state
	let showFormattingToolbar = $state(false);
	let colorPickerTarget = $state<'text' | 'highlight' | 'bg' | null>(null);
	let toolbarAnchorRect = $state<{ top: number; left: number; width: number } | null>(null);

	function refreshToolbarPosition() {
		if (!editingTextboxId || !slideCanvasEl) return;
		const tbEl = slideCanvasEl.querySelector(`[data-textbox-id="${editingTextboxId}"]`) as HTMLElement | null;
		if (tbEl) {
			const rect = tbEl.getBoundingClientRect();
			toolbarAnchorRect = { top: rect.top, left: rect.left, width: rect.width };
		}
	}

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

	function getEditingTextbox(): TextBox | undefined {
		if (!selectedSlide || editingTextboxId == null) return undefined;
		return selectedSlide.textboxes.find((t) => t.id === editingTextboxId);
	}

	function updateTextboxStyle<K extends keyof TextBox>(key: K, value: TextBox[K]) {
		const tb = getEditingTextbox();
		if (!tb) return;
		saveHistory();
		tb[key] = value;
	}

	function buildTextStyle(tb: TextBox): string {
		return `font-family:${tb.fontFamily ?? 'sans-serif'};font-size:${tb.fontSize ?? 14}px;font-weight:${tb.bold ? 'bold' : 'normal'};font-style:${tb.italic ? 'italic' : 'normal'};text-decoration:${tb.underline ? 'underline' : 'none'};text-align:${tb.align ?? 'left'};color:${tb.textColor ?? '#ffffff'};background:${tb.highlight ?? 'transparent'};`;
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
		colorPickerTarget = null;
		selectedImageId = null;
		activeImageId = null;
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
		colorPickerTarget = null;
		selectedImageId = null;
		activeImageId = null;
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
			textboxes: []
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
		if (activeTool !== 'textbox' && activeTool !== 'image') return;
		if ((e.target as HTMLElement).closest('[data-textbox]')) return;
		if ((e.target as HTMLElement).closest('[data-image]')) return;
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
			colorPickerTarget = null;
			activeTool = null;
			skipNextDeselect = true;
			return;
		}

		isDrawing = true;
		drawStart = pos;
		drawCurrent = pos;
	}

	function handleCanvasMousemove(e: MouseEvent) {
		if (!isDrawing) return;
		const pos = getRelativePos(e);
		if (!pos) return;
		drawCurrent = pos;
	}

	function handleCanvasMouseup() {
		if (!isDrawing || !drawRect || !selectedSlide) {
			isDrawing = false;
			drawStart = null;
			drawCurrent = null;
			return;
		}

		const MIN_SIZE = 3;
		if (drawRect.width >= MIN_SIZE && drawRect.height >= MIN_SIZE) {
			if (activeTool === 'image') {
				saveHistory();
				const id = nextImageId++;
				selectedSlide.images.push({
					id,
					src: '',
					name: '',
					x: drawRect.x,
					y: drawRect.y,
					width: drawRect.width,
					height: drawRect.height
				});
				selectedImageId = id;
				activeImageId = id;
				activeTool = null;
			}
		}

		isDrawing = false;
		drawStart = null;
		drawCurrent = null;
	}

	function selectTextbox(id: number, e: MouseEvent) {
		e.stopPropagation();
		if (activeTool) return;
		selectedTextboxId = id;
		editingTextboxId = id;
		showFormattingToolbar = true;
		colorPickerTarget = null;
		editingField = null;
		selectedImageId = null;
		activeImageId = null;
	}

	function selectImage(id: number, e: MouseEvent) {
		e.stopPropagation();
		if (activeTool) return;
		selectedImageId = id;
		activeImageId = null;
		selectedTextboxId = null;
		editingTextboxId = null;
		editingField = null;
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
		colorPickerTarget = null;
	}

	function deleteTextbox(id: number) {
		if (!selectedSlide) return;
		saveHistory();
		const index = selectedSlide.textboxes.findIndex((t) => t.id === id);
		if (index !== -1) selectedSlide.textboxes.splice(index, 1);
		selectedTextboxId = null;
		editingTextboxId = null;
	}

	function deselectAll() {
		if (activeTool) return;
		if (skipNextDeselect) { skipNextDeselect = false; return; }
		selectedTextboxId = null;
		editingTextboxId = null;
		showFormattingToolbar = false;
		colorPickerTarget = null;
		selectedImageId = null;
		activeImageId = null;
	}

	function close() {
		closeCamera();
		goto('/');
	}
</script>

<svelte:window
	onclick={(e) => {
		const target = e.target as HTMLElement;
		if (!target.closest('[data-editable]') && !target.closest('[data-textbox]') && !target.closest('[data-image]')) {
			stopEditing();
		}
		if (colorPickerTarget && !target.closest('[data-toolbar]')) {
			colorPickerTarget = null;
		}
	}}
	onkeydown={(e) => {
		if (e.key === 'Escape') {
			if (colorPickerTarget) { colorPickerTarget = null; return; }
			if (activeImageId) { activeImageId = null; return; }
			if (selectedImageId) { selectedImageId = null; return; }
			if (editingTextboxId) { editingTextboxId = null; showFormattingToolbar = false; return; }
			if (selectedTextboxId) { selectedTextboxId = null; return; }
			if (activeTool) { activeTool = null; return; }
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
	onmousemove={(e) => { handleCanvasMousemove(e); handleDragTextboxMove(e); handleResizeTextboxMove(e); }}
	onmouseup={() => { handleCanvasMouseup(); stopDragTextbox(); stopResizeTextbox(); }}
	onresize={refreshToolbarPosition}
	onscroll={refreshToolbarPosition}
/>

<!-- Fullscreen overlay -->
<div class="fixed inset-0 z-[100] flex flex-col bg-slate-950">
	<!-- Top Toolbar (full width) -->
	<div class="h-12 shrink-0 bg-slate-900 border-b border-slate-800 flex items-center px-3 gap-1">
		<!-- Close button -->
		<button
			class="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
			onclick={close}
			aria-label="Close slideshow"
			title="Close"
		>
			<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>

		<div class="w-px h-6 bg-slate-700 mx-1"></div>

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

		<div class="w-px h-6 bg-slate-700 mx-1"></div>

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
		<button
			class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
			aria-label="Insert shape"
			title="Insert Shape"
		>
			<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
				<rect x="3" y="10" width="13" height="13" rx="2" />
				<circle cx="15" cy="8" r="7" />
			</svg>
			<span class="hidden lg:inline">Shape</span>
		</button>

		<!-- Insert: Line -->
		<button
			class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
			aria-label="Insert line"
			title="Insert Line"
		>
			<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24">
				<path d="M5 19L19 5" />
			</svg>
			<span class="hidden lg:inline">Line</span>
		</button>
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
						<div class="w-full h-full bg-slate-950 p-3 relative {slide.isLanding ? 'flex items-center justify-center' : ''}">
							{#if slide.isLanding}
								<div class="text-center overflow-hidden">
									<p class="text-[8px] font-bold text-white leading-tight truncate">{slide.title}</p>
									<p class="text-[6px] text-slate-400 mt-1 leading-tight line-clamp-2">{slide.description}</p>
								</div>
							{:else}
								<div class="overflow-hidden">
									<p class="text-[7px] font-bold text-white leading-tight truncate">{slide.title}</p>
									<p class="text-[5px] text-slate-400 mt-1 leading-tight line-clamp-3">{slide.description}</p>
								</div>
							{/if}
							{#each slide.textboxes as tb}
								<div
									class="absolute border border-slate-600/50 overflow-hidden"
									style="left:{tb.x}%;top:{tb.y}%;width:{tb.width}%;height:{tb.height}%;background:{tb.bgColor && tb.bgColor !== 'transparent' ? tb.bgColor : 'rgba(30,41,59,0.3)'}"
								>
									<p class="text-[4px] leading-tight p-px" style="color:{tb.textColor ?? '#94a3b8'}">{tb.text}</p>
								</div>
							{/each}
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
	<div class="flex-1 flex items-center justify-center bg-slate-950 p-8 overflow-auto" onwheel={handleCanvasWheel}>
		{#if selectedSlide}
			<div
				bind:this={slideCanvasEl}
				class="relative w-full bg-slate-900 rounded-xl border border-slate-800 overflow-hidden select-none origin-center transition-transform duration-100"
				style="max-width:1100px;aspect-ratio:16/10;transform:scale({canvasZoom})"
				class:cursor-crosshair={activeTool === 'textbox' || activeTool === 'image'}
				role="presentation"
				onmousedown={handleCanvasMousedown}
				onclick={(e) => {
					if (!(e.target as HTMLElement).closest('[data-textbox]') && !(e.target as HTMLElement).closest('[data-editable]') && !(e.target as HTMLElement).closest('[data-image]')) {
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
						class="absolute border-2 rounded transition-colors {selectedTextboxId === tb.id
							? 'border-indigo-500 shadow-lg shadow-indigo-500/10'
							: 'border-slate-600 hover:border-slate-500'}"
						style="left:{tb.x}%;top:{tb.y}%;width:{tb.width}%;height:{tb.height}%;background:{tb.bgColor ?? 'transparent'}"
						role="button"
						tabindex="0"
						onclick={(e) => selectTextbox(tb.id, e)}
						ondblclick={(e) => startEditingTextbox(tb.id, e)}
						onmousedown={(e) => {
							if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
							startDragTextbox(tb.id, e);
						}}
						onkeydown={(e) => e.key === 'Enter' && startEditingTextbox(tb.id, new MouseEvent('click'))}
					>
						<!-- Toolbar position anchor -->
						{#if editingTextboxId === tb.id && showFormattingToolbar}
							<div class="hidden" use:captureToolbarAnchor></div>
						{/if}

						{#if editingTextboxId === tb.id}
							<!-- Drag handle -->
							<div
								class="absolute -top-5 left-1/2 -translate-x-1/2 z-10 px-3 py-0.5 rounded-t-md bg-indigo-500/80 cursor-move flex items-center gap-1"
								onmousedown={(e) => { e.stopPropagation(); startDragTextbox(tb.id, e); }}
							>
								<svg class="w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="5" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
							</div>
							<textarea
								bind:value={tb.text}
								class="w-full h-full bg-transparent p-2 resize-none focus:outline-none"
								style={buildTextStyle(tb)}
								placeholder="Type here..."
								onclick={(e) => e.stopPropagation()}
								onkeydown={(e) => {
									if (e.key === 'Escape') {
										if (colorPickerTarget) { colorPickerTarget = null; }
										else { editingTextboxId = null; showFormattingToolbar = false; }
									}
									e.stopPropagation();
								}}
								autofocus
							></textarea>
						{:else}
							<div class="w-full h-full p-2 whitespace-pre-wrap overflow-hidden" style={buildTextStyle(tb)}>
								{#if tb.text}
									{tb.text}
								{:else}
									<span class="text-slate-500 italic">Click to edit</span>
								{/if}
							</div>
						{/if}

						{#if selectedTextboxId === tb.id && editingTextboxId !== tb.id}
							<button
								class="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center transition-colors"
								onclick={(e) => {
									e.stopPropagation();
									deleteTextbox(tb.id);
								}}
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
						class="absolute rounded transition-colors overflow-hidden {selectedImageId === image.id
							? 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/10'
							: image.src === ''
								? 'border-2 border-dashed border-slate-600 hover:border-slate-500'
								: 'border-2 border-slate-600 hover:border-slate-500'}"
						style="left:{image.x}%;top:{image.y}%;width:{image.width}%;height:{image.height}%"
						role="button"
						tabindex="0"
						onclick={(e) => selectImage(image.id, e)}
						ondblclick={(e) => { e.stopPropagation(); selectedImageId = image.id; activeImageId = image.id; }}
						onkeydown={(e) => e.key === 'Enter' && (() => { selectedImageId = image.id; activeImageId = image.id; })()}
					>
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

						<!-- Delete button when selected -->
						{#if selectedImageId === image.id}
							<button
								class="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center transition-colors z-10"
								onclick={(e) => {
									e.stopPropagation();
									deleteImage(image.id);
								}}
								aria-label="Delete image"
							>
								<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
									<path d="M18 6L6 18M6 6l12 12" />
								</svg>
							</button>
						{/if}

						<!-- Source selection menu when active -->
						{#if activeImageId === image.id}
							<div class="absolute inset-0 flex items-center justify-center bg-black/40 z-10" data-image>
								<div class="flex gap-2" onclick={(e) => e.stopPropagation()}>
									<button
										class="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-white border border-slate-600 transition-colors"
										onclick={openFilePicker}
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
											<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
										</svg>
										Upload
									</button>
									<button
										class="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-white border border-slate-600 transition-colors"
										onclick={openCamera}
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
											<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" />
										</svg>
										Camera
									</button>
								</div>
							</div>
						{/if}
					</div>
				{/each}

				<!-- Drawing preview rectangle -->
				{#if isDrawing && drawRect}
					<div
						class="absolute border-2 border-dashed border-indigo-400 bg-indigo-500/10 rounded pointer-events-none"
						style="left:{drawRect.x}%;top:{drawRect.y}%;width:{drawRect.width}%;height:{drawRect.height}%"
					></div>
				{/if}
			</div>
		{/if}
	</div>
	</div>

	<!-- Floating Formatting Toolbar (fixed, escapes all overflow) -->
	{#if showFormattingToolbar && toolbarAnchorRect && getEditingTextbox()}
		{@const tb = getEditingTextbox()!}
		<div
			class="fixed z-[150] flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 shadow-xl whitespace-nowrap"
			data-toolbar
			style="top:{toolbarAnchorRect.top - 70}px;left:{slideCanvasEl ? slideCanvasEl.getBoundingClientRect().left + slideCanvasEl.getBoundingClientRect().width / 2 : 0}px;transform:translateX(-50%)"
			onclick={(e) => e.stopPropagation()}
			onmousedown={(e) => e.preventDefault()}
		>
			<!-- Font family -->
			<select
				class="bg-slate-700 text-white text-sm rounded-lg px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-indigo-500 max-w-[120px]"
				value={tb.fontFamily ?? 'sans-serif'}
				onchange={(e) => updateTextboxStyle('fontFamily', (e.target as HTMLSelectElement).value)}
			>
				{#each fontOptions as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>

			<!-- Font size -->
			<div class="flex items-center gap-1 ml-1">
				<button
					class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-600 text-sm"
					onclick={() => updateTextboxStyle('fontSize', Math.max(8, (tb.fontSize ?? 14) - 2))}
					title="Decrease font size"
				>&minus;</button>
				<span class="text-sm text-slate-300 w-7 text-center">{tb.fontSize ?? 14}</span>
				<button
					class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-600 text-sm"
					onclick={() => updateTextboxStyle('fontSize', Math.min(72, (tb.fontSize ?? 14) + 2))}
					title="Increase font size"
				>+</button>
			</div>

			<div class="w-px h-7 bg-slate-600 mx-1"></div>

			<!-- Bold -->
			<button
				class="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-colors {tb.bold ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-slate-600'}"
				onclick={() => updateTextboxStyle('bold', !tb.bold)}
				title="Bold"
			>B</button>
			<!-- Italic -->
			<button
				class="w-8 h-8 flex items-center justify-center rounded-lg text-sm italic transition-colors {tb.italic ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-slate-600'}"
				onclick={() => updateTextboxStyle('italic', !tb.italic)}
				title="Italic"
			>I</button>
			<!-- Underline -->
			<button
				class="w-8 h-8 flex items-center justify-center rounded-lg text-sm underline transition-colors {tb.underline ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-slate-600'}"
				onclick={() => updateTextboxStyle('underline', !tb.underline)}
				title="Underline"
			>U</button>

			<div class="w-px h-7 bg-slate-600 mx-1"></div>

			<!-- Alignment -->
			<button
				class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors {(tb.align ?? 'left') === 'left' ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-slate-600'}"
				onclick={() => updateTextboxStyle('align', 'left')}
				title="Align left"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M3 12h12M3 18h16"/></svg>
			</button>
			<button
				class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors {tb.align === 'center' ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-slate-600'}"
				onclick={() => updateTextboxStyle('align', 'center')}
				title="Align center"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M6 12h12M5 18h14"/></svg>
			</button>
			<button
				class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors {tb.align === 'right' ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-slate-600'}"
				onclick={() => updateTextboxStyle('align', 'right')}
				title="Align right"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M9 12h12M5 18h16"/></svg>
			</button>

			<div class="w-px h-7 bg-slate-600 mx-1"></div>

			<!-- Text color -->
			<div class="relative">
				<button
					class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-sm font-bold hover:bg-slate-600"
					style="color:{tb.textColor ?? '#ffffff'}"
					onclick={() => { colorPickerTarget = colorPickerTarget === 'text' ? null : 'text'; }}
					title="Text color"
				>A</button>
				{#if colorPickerTarget === 'text'}
					<div class="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-2.5 bg-slate-800 border border-slate-600 rounded-xl shadow-xl z-50 grid grid-cols-6 gap-1.5" data-toolbar>
						{#each presetColors as c}
							<button
								class="w-6 h-6 rounded-lg border transition-transform hover:scale-110 {c === (tb.textColor ?? '#ffffff') ? 'border-indigo-400 ring-1 ring-indigo-400' : 'border-slate-500'}"
								style="background:{c}"
								onclick={() => { updateTextboxStyle('textColor', c); colorPickerTarget = null; }}
							></button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Highlight color -->
			<div class="relative">
				<button
					class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-slate-600"
					title="Highlight color"
					onclick={() => { colorPickerTarget = colorPickerTarget === 'highlight' ? null : 'highlight'; }}
				>
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
					</svg>
					<span class="absolute bottom-0.5 left-1.5 right-1.5 h-1 rounded-full" style="background:{(tb.highlight && tb.highlight !== 'transparent') ? tb.highlight : '#64748b'}"></span>
				</button>
				{#if colorPickerTarget === 'highlight'}
					<div class="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-2.5 bg-slate-800 border border-slate-600 rounded-xl shadow-xl z-50 grid grid-cols-6 gap-1.5" data-toolbar>
						<button
							class="w-6 h-6 rounded-lg border border-slate-500 transition-transform hover:scale-110"
							style="background:repeating-conic-gradient(#334155 0% 25%, transparent 0% 50%) 50% / 8px 8px"
							onclick={() => { updateTextboxStyle('highlight', 'transparent'); colorPickerTarget = null; }}
							title="None"
						></button>
						{#each presetColors as c}
							<button
								class="w-6 h-6 rounded-lg border transition-transform hover:scale-110 {c === (tb.highlight ?? 'transparent') ? 'border-indigo-400 ring-1 ring-indigo-400' : 'border-slate-500'}"
								style="background:{c}"
								onclick={() => { updateTextboxStyle('highlight', c); colorPickerTarget = null; }}
							></button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Background color -->
			<div class="relative">
				<button
					class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-slate-600"
					title="Background color"
					onclick={() => { colorPickerTarget = colorPickerTarget === 'bg' ? null : 'bg'; }}
				>
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="3" y="3" width="18" height="18" rx="2"/>
					</svg>
					<span class="absolute bottom-0.5 left-1.5 right-1.5 h-1 rounded-full" style="background:{(tb.bgColor && tb.bgColor !== 'transparent') ? tb.bgColor : '#64748b'}"></span>
				</button>
				{#if colorPickerTarget === 'bg'}
					<div class="absolute top-full right-0 mt-2 p-2.5 bg-slate-800 border border-slate-600 rounded-xl shadow-xl z-50 grid grid-cols-6 gap-1.5" data-toolbar>
						<button
							class="w-6 h-6 rounded-lg border border-slate-500 transition-transform hover:scale-110"
							style="background:repeating-conic-gradient(#334155 0% 25%, transparent 0% 50%) 50% / 8px 8px"
							onclick={() => { updateTextboxStyle('bgColor', 'transparent'); colorPickerTarget = null; }}
							title="None"
						></button>
						{#each presetColors as c}
							<button
								class="w-6 h-6 rounded-lg border transition-transform hover:scale-110 {c === (tb.bgColor ?? 'transparent') ? 'border-indigo-400 ring-1 ring-indigo-400' : 'border-slate-500'}"
								style="background:{c}"
								onclick={() => { updateTextboxStyle('bgColor', c); colorPickerTarget = null; }}
							></button>
						{/each}
					</div>
				{/if}
			</div>
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
