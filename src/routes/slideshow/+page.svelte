<script lang="ts">
	import { goto } from '$app/navigation';

	interface TextBox {
		id: number;
		x: number;
		y: number;
		width: number;
		height: number;
		text: string;
		role?: 'title' | 'subtitle';
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
		skipped?: boolean;
		bgColor?: string;
		bgImage?: string;
		animationType?: 'fade' | 'dissolve' | 'flip' | 'slide-left' | 'slide-right';
		animationSpeed?: number;
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
		saved?.slides ?? (() => {
			const tb1Id = nextTextboxId++;
			const tb2Id = nextTextboxId++;
			return [
				{ id: 1, title: 'Welcome to the Presentation', description: 'Click to edit this description', isLanding: true, images: [], textboxes: [
					{ id: tb1Id, x: 5, y: 3, width: 90, height: 10, text: 'Welcome to the Presentation', role: 'title' as const, fontSize: 36, bold: true, align: 'center' as const, textColor: '#ffffff' },
					{ id: tb2Id, x: 5, y: 16, width: 90, height: 78, text: 'Click to edit this description', role: 'subtitle' as const, fontSize: 16, align: 'center' as const, textColor: '#94a3b8' }
				], shapes: [], tables: [] }
			];
		})()
	);
	let selectedSlideId = $state(saved?.selectedSlideId ?? 1);

	// Ensure shapes/tables arrays exist on all slides (migration from old data)
	for (const s of slides) {
		if (!s.shapes) s.shapes = [];
		if (!s.tables) s.tables = [];
		// Migrate: create title/subtitle textboxes from old title/description strings
		if (!s.textboxes.some(t => t.role === 'title')) {
			if (s.isLanding) {
				s.textboxes.unshift(
					{ id: nextTextboxId++, x: 5, y: 3, width: 90, height: 10, text: s.title || 'Untitled', role: 'title', fontSize: 36, bold: true, align: 'center', textColor: '#ffffff' },
					{ id: nextTextboxId++, x: 5, y: 16, width: 90, height: 78, text: s.description || '', role: 'subtitle', fontSize: 16, align: 'center', textColor: '#94a3b8' }
				);
			} else {
				s.textboxes.unshift(
					{ id: nextTextboxId++, x: 5, y: 3, width: 90, height: 10, text: s.title || 'Untitled', role: 'title', fontSize: 24, bold: true, textColor: '#ffffff' },
					{ id: nextTextboxId++, x: 5, y: 16, width: 90, height: 78, text: s.description || '', role: 'subtitle', fontSize: 14, textColor: '#94a3b8' }
				);
			}
		}
	}

	$effect(() => {
		const data = {
			slides: $state.snapshot(slides),
			selectedSlideId,
			nextId,
			nextImageId,
			nextTextboxId,
			nextShapeId,
			nextTableId,
			presenterQuestions: $state.snapshot(presenterQuestions),
			presenterNotes: $state.snapshot(presenterNotes),
			nextPresenterQId,
			nextPresenterNId
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	});
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

	// Slide edit menu state
	let slideMenuId = $state<number | null>(null);
	let slideMenuAnchor = $state<{ x: number; y: number } | null>(null);

	// Topbar background picker
	let showBgPicker = $state(false);
	let topbarBgFileInputEl = $state<HTMLInputElement | null>(null);

	// Topbar animation picker
	let showAnimationPicker = $state(false);
	let showAnimPreview = $state(false);
	let animPreviewKey = $state(0);

	// Presentation transition state
	let presentationTransition = $state<string | null>(null);
	let presentationTransitionSpeed = $state(500);

	// Presentation mode state
	let presentationMode = $state(false);
	let presentationSlideIndex = $state(0);
	let presentationEl = $state<HTMLDivElement | null>(null);

	// Presenter mode state
	let presenterMode = $state(false);
	let presenterSlideIndex = $state(0);
	let presenterTimer = $state(0);
	let presenterTimerRunning = $state(false);
	let presenterTimerInterval = $state<ReturnType<typeof setInterval> | null>(null);
	let presenterTab = $state<'presentation' | 'questions' | 'notes'>('presentation');

	// Presenter questions & notes (persisted)
	interface PresenterQuestion { id: number; text: string; answered?: boolean; }
	interface PresenterNote { id: number; text: string; align?: 'left' | 'center' | 'right'; textColor?: string; bgColor?: string; }
	let presenterQuestions = $state<PresenterQuestion[]>(saved?.presenterQuestions ?? []);
	let presenterNotes = $state<PresenterNote[]>(saved?.presenterNotes ?? []);
	let nextPresenterQId = $state(saved?.nextPresenterQId ?? 1);
	let nextPresenterNId = $state(saved?.nextPresenterNId ?? 1);
	let showAddQuestion = $state(false);
	let newQuestionText = $state('');
	let showAddNote = $state(false);
	let newNoteText = $state('');
	let newNoteAlign = $state<'left' | 'center' | 'right'>('left');
	let newNoteTextColor = $state('#e2e8f0');
	let newNoteBgColor = $state('transparent');
	let editingQuestionId = $state<number | null>(null);
	let editingNoteId = $state<number | null>(null);
	let noteColorTarget = $state<{ noteId: number | 'new'; field: 'textColor' | 'bgColor' } | null>(null);

	const noteColorSwatches = [
		'transparent', '#0f172a', '#1e293b', '#334155', '#475569',
		'#ffffff', '#e2e8f0', '#94a3b8', '#64748b',
		'#ef4444', '#f97316', '#eab308', '#22c55e',
		'#3b82f6', '#6366f1', '#a855f7', '#ec4899',
		'#fecaca', '#fed7aa', '#fef08a', '#bbf7d0',
		'#bfdbfe', '#c7d2fe', '#e9d5ff', '#fbcfe8',
	];

	function formatTime(seconds: number): string {
		const m = Math.floor(seconds / 60).toString().padStart(2, '0');
		const s = (seconds % 60).toString().padStart(2, '0');
		return `${m}:${s}`;
	}

	function startPresentation() {
		let idx = slides.findIndex(s => s.id === selectedSlideId);
		if (idx < 0) idx = 0;
		// If starting on a skipped slide, find the nearest non-skipped
		if (slides[idx]?.skipped) {
			const forward = slides.findIndex((s, i) => i >= idx && !s.skipped);
			if (forward >= 0) idx = forward;
			else {
				const backward = slides.findLastIndex((s, i) => i <= idx && !s.skipped);
				if (backward >= 0) idx = backward;
			}
		}
		presentationSlideIndex = idx;
		presentationMode = true;
		requestAnimationFrame(() => {
			presentationEl?.requestFullscreen?.().catch(() => {});
		});
	}

	function stopPresentation() {
		presentationMode = false;
		if (document.fullscreenElement) {
			document.exitFullscreen?.().catch(() => {});
		}
	}

	function triggerPresentationTransition(targetIndex: number) {
		const targetSlide = slides[targetIndex];
		const anim = targetSlide?.animationType;
		const speed = targetSlide?.animationSpeed ?? 500;
		if (!anim) {
			presentationSlideIndex = targetIndex;
			return;
		}
		presentationTransition = anim;
		presentationTransitionSpeed = speed;
		presentationSlideIndex = targetIndex;
		setTimeout(() => { presentationTransition = null; }, speed);
	}

	function presentationNext() {
		let next = presentationSlideIndex + 1;
		while (next < slides.length && slides[next]?.skipped) next++;
		if (next < slides.length) triggerPresentationTransition(next);
	}

	function presentationPrev() {
		let prev = presentationSlideIndex - 1;
		while (prev >= 0 && slides[prev]?.skipped) prev--;
		if (prev >= 0) triggerPresentationTransition(prev);
	}

	// Presenter mode functions
	function startPresenter() {
		let idx = slides.findIndex(s => s.id === selectedSlideId);
		if (idx < 0) idx = 0;
		if (slides[idx]?.skipped) {
			const forward = slides.findIndex((s, i) => i >= idx && !s.skipped);
			if (forward >= 0) idx = forward;
			else {
				const backward = slides.findLastIndex((s, i) => i <= idx && !s.skipped);
				if (backward >= 0) idx = backward;
			}
		}
		presenterSlideIndex = idx;
		presenterMode = true;
		presenterTab = 'presentation';
		presenterTimer = 0;
		presenterTimerRunning = true;
		presenterTimerInterval = setInterval(() => { presenterTimer++; }, 1000);
		showAddQuestion = false;
		showAddNote = false;
		newQuestionText = '';
		newNoteText = '';
	}

	function stopPresenter() {
		presenterMode = false;
		presenterTimerRunning = false;
		if (presenterTimerInterval) { clearInterval(presenterTimerInterval); presenterTimerInterval = null; }
		presenterTimer = 0;
	}

	function presenterNext() {
		let next = presenterSlideIndex + 1;
		while (next < slides.length && slides[next]?.skipped) next++;
		if (next < slides.length) presenterSlideIndex = next;
	}

	function presenterPrev() {
		let prev = presenterSlideIndex - 1;
		while (prev >= 0 && slides[prev]?.skipped) prev--;
		if (prev >= 0) presenterSlideIndex = prev;
	}

	function togglePresenterTimer() {
		if (presenterTimerRunning) {
			presenterTimerRunning = false;
			if (presenterTimerInterval) { clearInterval(presenterTimerInterval); presenterTimerInterval = null; }
		} else {
			presenterTimerRunning = true;
			presenterTimerInterval = setInterval(() => { presenterTimer++; }, 1000);
		}
	}

	function resetPresenterTimer() {
		presenterTimer = 0;
	}

	function addPresenterQuestion() {
		const text = newQuestionText.trim();
		if (!text) return;
		presenterQuestions.push({ id: nextPresenterQId++, text });
		newQuestionText = '';
		showAddQuestion = false;
	}

	function deletePresenterQuestion(id: number) {
		presenterQuestions = presenterQuestions.filter(q => q.id !== id);
	}

	function toggleQuestionAnswered(id: number) {
		const q = presenterQuestions.find(q => q.id === id);
		if (q) q.answered = !q.answered;
	}

	function addPresenterNote() {
		const text = newNoteText.trim();
		if (!text) return;
		presenterNotes.push({
			id: nextPresenterNId++,
			text,
			align: newNoteAlign,
			textColor: newNoteTextColor,
			bgColor: newNoteBgColor
		});
		newNoteText = '';
		newNoteAlign = 'left';
		newNoteTextColor = '#e2e8f0';
		newNoteBgColor = 'transparent';
		showAddNote = false;
		noteColorTarget = null;
	}

	function deletePresenterNote(id: number) {
		presenterNotes = presenterNotes.filter(n => n.id !== id);
	}

	// Slide drag-reorder state
	let dragSlideId = $state<number | null>(null);
	let dragOverSlideId = $state<number | null>(null);
	let dragOverPosition = $state<'above' | 'below' | null>(null);

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

		const onUp = () => {
			document.removeEventListener('pointermove', onMove);
			document.removeEventListener('pointerup', onUp);
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

		document.addEventListener('pointermove', onMove);
		document.addEventListener('pointerup', onUp);
	}

	// Move table via handle (used when table is in edit mode)
	function startTableMoveFromHandle(tableId: number, e: PointerEvent) {
		if (!slideCanvasEl || !selectedSlide) return;
		const table = selectedSlide.tables.find(t => t.id === tableId);
		if (!table) return;
		e.preventDefault();
		e.stopPropagation();

		const rect = slideCanvasEl.getBoundingClientRect();
		const mx = ((e.clientX - rect.left) / rect.width) * 100;
		const my = ((e.clientY - rect.top) / rect.height) * 100;
		const offX = mx - table.x;
		const offY = my - table.y;
		let dragging = false;
		const startX = e.clientX, startY = e.clientY;
		if (canvasWrapperEl) canvasWrapperEl.style.overflow = 'hidden';

		const onMove = (ev: PointerEvent) => {
			if (!dragging) {
				if (Math.abs(ev.clientX - startX) < 3 && Math.abs(ev.clientY - startY) < 3) return;
				dragging = true;
				saveHistory();
			}
			if (!slideCanvasEl || !selectedSlide) return;
			const t = selectedSlide.tables.find(t => t.id === tableId);
			if (!t) return;
			const r = slideCanvasEl.getBoundingClientRect();
			const cx = ((ev.clientX - r.left) / r.width) * 100;
			const cy = ((ev.clientY - r.top) / r.height) * 100;
			t.x = Math.max(0, Math.min(100 - t.width, cx - offX));
			t.y = Math.max(0, Math.min(100 - t.height, cy - offY));
			refreshTableToolbarPosition();
		};
		const onUp = () => {
			document.removeEventListener('pointermove', onMove);
			document.removeEventListener('pointerup', onUp);
			if (canvasWrapperEl) canvasWrapperEl.style.overflow = '';
		};
		document.addEventListener('pointermove', onMove);
		document.addEventListener('pointerup', onUp);
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
		const tb1Id = nextTextboxId++;
		const tb2Id = nextTextboxId++;
		slides.push({
			id,
			title: '',
			description: '',
			isLanding: false,
			images: [],
			textboxes: [
				{ id: tb1Id, x: 5, y: 3, width: 90, height: 10, text: '', role: 'title', fontSize: 24, bold: true, textColor: '#ffffff' },
				{ id: tb2Id, x: 5, y: 16, width: 90, height: 78, text: '', role: 'subtitle', fontSize: 14, textColor: '#94a3b8' }
			],
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

	function duplicateSlide(id: number) {
		const index = slides.findIndex((s) => s.id === id);
		if (index === -1) return;
		saveHistory();
		const clone = structuredClone($state.snapshot(slides[index])) as Slide;
		clone.id = nextId++;
		for (const tb of clone.textboxes) tb.id = nextTextboxId++;
		for (const img of clone.images) img.id = nextImageId++;
		for (const sh of clone.shapes) sh.id = nextShapeId++;
		for (const tbl of clone.tables) tbl.id = nextTableId++;
		slides.splice(index + 1, 0, clone);
		selectedSlideId = clone.id;
		slideMenuId = null;
	}

	function moveSlide(id: number, direction: -1 | 1) {
		const index = slides.findIndex((s) => s.id === id);
		const target = index + direction;
		if (index === -1 || target < 0 || target >= slides.length) return;
		saveHistory();
		const [moved] = slides.splice(index, 1);
		slides.splice(target, 0, moved);
	}

	function slideDragAction(node: HTMLElement, slideId: number) {
		let sid = slideId;

		const onPointerDown = (e: PointerEvent) => {
			// Don't drag from child buttons (reorder / delete)
			if ((e.target as HTMLElement).closest('[data-slide-btn]')) return;
			if (e.button !== 0) return;

			const startY = e.clientY;
			const startX = e.clientX;
			let dragging = false;

			const onPointerMove = (ev: PointerEvent) => {
				if (!dragging) {
					if (Math.abs(ev.clientY - startY) < 5 && Math.abs(ev.clientX - startX) < 5) return;
					dragging = true;
					dragSlideId = sid;
					// Prevent text selection while dragging
					document.body.style.userSelect = 'none';
				}
				// Find which thumbnail we're over
				const els = document.querySelectorAll('[data-slide-thumb]');
				let foundOver = false;
				for (const el of els) {
					const rect = el.getBoundingClientRect();
					if (ev.clientY >= rect.top && ev.clientY <= rect.bottom &&
						ev.clientX >= rect.left && ev.clientX <= rect.right) {
						const thumbId = Number(el.getAttribute('data-slide-thumb'));
						if (thumbId !== dragSlideId) {
							dragOverSlideId = thumbId;
							dragOverPosition = ev.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
							foundOver = true;
						}
						break;
					}
				}
				if (!foundOver) {
					dragOverSlideId = null;
					dragOverPosition = null;
				}
			};

			const onPointerUp = () => {
				document.removeEventListener('pointermove', onPointerMove);
				document.removeEventListener('pointerup', onPointerUp);
				document.body.style.userSelect = '';
				if (dragging && dragSlideId != null && dragOverSlideId != null) {
					const fromIdx = slides.findIndex(s => s.id === dragSlideId);
					let toIdx = slides.findIndex(s => s.id === dragOverSlideId);
					if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
						saveHistory();
						const [moved] = slides.splice(fromIdx, 1);
						toIdx = slides.findIndex(s => s.id === dragOverSlideId);
						if (dragOverPosition === 'below') toIdx++;
						slides.splice(toIdx, 0, moved);
					}
				}
				dragSlideId = null;
				dragOverSlideId = null;
				dragOverPosition = null;
			};

			document.addEventListener('pointermove', onPointerMove);
			document.addEventListener('pointerup', onPointerUp);
		};

		node.addEventListener('pointerdown', onPointerDown);
		return {
			update(newId: number) { sid = newId; },
			destroy() { node.removeEventListener('pointerdown', onPointerDown); }
		};
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
		const closestTb = (e.target as HTMLElement).closest('[data-textbox]');
		if (closestTb && !closestTb.hasAttribute('data-textbox-role')) return;
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
			const w = 15;
			const h = isLine ? 15 : 24;
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

	}

	function startEditingTable(id: number, e: MouseEvent | PointerEvent) {
		e.stopPropagation();
		if (activeTool) return;
		selectedTableId = id;
		editingTableId = id;
		activePickerTarget = null;

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

	// Native pointerdown handler for table interaction.
	// Must be a native listener (not Svelte onpointerdown) so that
	// preventDefault/stopPropagation fire at the element level, before
	// Svelte 5's root-level event delegation processes the event.
	function tablePointerAction(node: HTMLElement, tableId: number) {
		let tid = tableId;

		const findCell = (clientX: number, clientY: number) => {
			const tdEl = document.elementFromPoint(clientX, clientY)?.closest('td');
			const tblEl = tdEl?.closest('table');
			if (!tdEl || !tblEl || !node.contains(tblEl)) return null;
			const tr = tdEl.parentElement;
			if (!tr) return null;
			const rows = Array.from(tblEl.querySelectorAll(':scope > tr, :scope > tbody > tr'));
			const ri = rows.indexOf(tr as HTMLTableRowElement);
			const ci = Array.from(tr.children).indexOf(tdEl);
			return (ri >= 0 && ci >= 0) ? { ri, ci, tblEl } : null;
		};

		const startCellDrag = (tblEl: Element, e: PointerEvent) => {
			isDraggingCellSelection = true;
			node.setPointerCapture(e.pointerId);
			const onMove = (ev: PointerEvent) => {
				const el = document.elementFromPoint(ev.clientX, ev.clientY);
				const tdTarget = el?.closest('td');
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
			const onUp = (ev: PointerEvent) => {
				isDraggingCellSelection = false;
				if (node.hasPointerCapture(ev.pointerId)) node.releasePointerCapture(ev.pointerId);
				node.removeEventListener('pointermove', onMove);
				node.removeEventListener('pointerup', onUp);
			};
			node.addEventListener('pointermove', onMove);
			node.addEventListener('pointerup', onUp);
		};

		const handler = (e: PointerEvent) => {
			if (activeTool) return;

			// Let the move handle handle its own pointer events
			if ((e.target as HTMLElement).closest('[data-table-move-handle]')) return;

			// In edit mode → cell selection + drag
			if (editingTableId === tid) {
				e.preventDefault();
				e.stopPropagation();
				const hit = findCell(e.clientX, e.clientY);
				if (hit) {
					selectedCellRow = hit.ri;
					selectedCellCol = hit.ci;
					cellSelectionEndRow = hit.ri;
					cellSelectionEndCol = hit.ci;
					startCellDrag(hit.tblEl, e);
				}
				skipNextDeselect = true;
				return;
			}

			// Selected but not editing → enter edit mode + select cell + drag
			if (selectedTableId === tid) {
				e.preventDefault();
				e.stopPropagation();
				editingTableId = tid;
				const hit = findCell(e.clientX, e.clientY);
				if (hit) {
					selectedCellRow = hit.ri;
					selectedCellCol = hit.ci;
					cellSelectionEndRow = hit.ri;
					cellSelectionEndCol = hit.ci;
					startCellDrag(hit.tblEl, e);
				}
				skipNextDeselect = true;
				return;
			}

			// Not selected → select table + drag to move
			e.preventDefault();
			selectTable(tid, e);
			startElementDragPointer('table', tid, e);
		};

		// Capture-phase listener: prevent textarea from starting native text
		// selection drag, which would steal pointer events from cell drag.
		const captureHandler = (e: PointerEvent) => {
			if (editingTableId === tid && e.target instanceof HTMLTextAreaElement) {
				e.preventDefault();
			}
		};

		node.addEventListener('pointerdown', captureHandler, true);
		node.addEventListener('pointerdown', handler);
		return {
			update(newId: number) { tid = newId; },
			destroy() {
				node.removeEventListener('pointerdown', captureHandler, true);
				node.removeEventListener('pointerdown', handler);
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

	function closeButtonAction(node: HTMLElement) {
		const handler = (e: MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
			close();
		};
		node.addEventListener('click', handler, true);
		return { destroy() { node.removeEventListener('click', handler, true); } };
	}

	function stopPresentationAction(node: HTMLElement) {
		const handler = (e: MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
			stopPresentation();
		};
		node.addEventListener('click', handler, true);
		return { destroy() { node.removeEventListener('click', handler, true); } };
	}

	// Exit presentation mode when leaving fullscreen (e.g. browser Escape)
	$effect(() => {
		const handler = () => {
			if (!document.fullscreenElement && presentationMode) {
				presentationMode = false;
			}
		};
		document.addEventListener('fullscreenchange', handler);
		return () => document.removeEventListener('fullscreenchange', handler);
	});

	// Cleanup presenter timer on unmount
	$effect(() => {
		return () => {
			if (presenterTimerInterval) clearInterval(presenterTimerInterval);
		};
	});
</script>

<svelte:window
	onclick={(e) => {
		const target = e.target as HTMLElement;
		if (activePickerTarget && !target.closest('[data-toolbar]')) {
			activePickerTarget = null;
		}
		if (showShapePicker && !target.closest('[data-shape-picker]') && !target.closest('[data-shape-btn]')) {
			showShapePicker = false;
		}
		if (showTablePicker && !target.closest('[data-table-picker]') && !target.closest('[data-table-btn]')) {
			showTablePicker = false;
		}
		if (slideMenuId !== null && !target.closest('[data-slide-menu]')) {
			slideMenuId = null;

			slideMenuAnchor = null;
		}
		if (showBgPicker && !target.closest('[data-bg-picker]')) {
			showBgPicker = false;
		}
		if (showAnimationPicker && !target.closest('[data-anim-picker]')) {
			showAnimationPicker = false;
		}
	}}
	onkeydown={(e) => {
		// Presentation mode controls
		if (presentationMode) {
			if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); presentationNext(); return; }
			if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); presentationPrev(); return; }
			if (e.key === 'Escape') { stopPresentation(); return; }
			return;
		}
		// Presenter mode controls
		if (presenterMode) {
			const tag = (e.target as HTMLElement)?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA') {
				if (e.key === 'Escape') { (e.target as HTMLElement).blur(); return; }
				return;
			}
			if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); presenterNext(); return; }
			if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); presenterPrev(); return; }
			if (e.key === 'Escape') { showAddQuestion = false; showAddNote = false; stopPresenter(); return; }
			return;
		}
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
	<div class="shrink-0 bg-slate-900 border-b border-slate-800 overflow-visible relative z-[110]">
	<div class="h-12 flex items-center px-3 gap-1">
		<!-- Close button -->
		<button
			class="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
			use:closeButtonAction
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

		<!-- Slide Background (hidden on mobile, shown in 2nd row) -->
		<div class="relative hidden md:block" data-bg-picker>
			<button
				class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors {showBgPicker
					? 'bg-indigo-500/20 text-indigo-400'
					: 'text-slate-400 hover:text-white hover:bg-slate-700'}"
				onclick={() => { showBgPicker = !showBgPicker; }}
				aria-label="Slide background"
				title="Slide Background"
			>
				<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
					<rect x="3" y="3" width="18" height="18" rx="2" />
					<path d="M3 16l5-5 4 4 4-6 5 7" />
				</svg>
				<span class="hidden lg:inline">Background</span>
			</button>

			{#if showBgPicker && selectedSlide}
				<div
					class="absolute top-full left-0 mt-1 p-3 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 w-[220px]"
					data-bg-picker
					onclick={(e) => e.stopPropagation()}
				>
					<p class="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Slide Background</p>
					<div class="space-y-3">
						<div class="flex items-center gap-2">
							<label class="text-xs text-slate-300 w-12">Color</label>
							<input
								type="color"
								value={selectedSlide.bgColor ?? '#1e293b'}
								oninput={(e) => { saveHistory(); selectedSlide!.bgColor = (e.target as HTMLInputElement).value; }}
								onclick={(e) => e.stopPropagation()}
								class="w-8 h-8 rounded cursor-pointer border border-slate-600 bg-transparent"
							/>
							{#if selectedSlide.bgColor}
								<button
									class="text-xs text-slate-400 hover:text-slate-200 transition-colors"
									onclick={(e) => { e.stopPropagation(); saveHistory(); selectedSlide!.bgColor = undefined; }}
								>Reset</button>
							{/if}
						</div>
						<div class="flex items-center gap-2">
							<label class="text-xs text-slate-300 w-12">Image</label>
							<button
								class="text-xs px-2.5 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
								onclick={(e) => { e.stopPropagation(); topbarBgFileInputEl?.click(); }}
							>Choose</button>
							{#if selectedSlide.bgImage}
								<button
									class="text-xs text-slate-400 hover:text-slate-200 transition-colors"
									onclick={(e) => { e.stopPropagation(); saveHistory(); selectedSlide!.bgImage = undefined; }}
								>Clear</button>
							{/if}
							<input
								bind:this={topbarBgFileInputEl}
								type="file"
								accept="image/*"
								class="hidden"
								onchange={(e) => {
									const file = (e.target as HTMLInputElement).files?.[0];
									if (!file || !selectedSlide) return;
									const reader = new FileReader();
									reader.onload = () => {
										saveHistory();
										selectedSlide!.bgImage = reader.result as string;
									};
									reader.readAsDataURL(file);
									(e.target as HTMLInputElement).value = '';
								}}
							/>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Slide Animation (hidden on mobile, shown in 2nd row) -->
		<div class="relative hidden md:block" data-anim-picker>
			<button
				class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors {showAnimationPicker
					? 'bg-indigo-500/20 text-indigo-400'
					: 'text-slate-400 hover:text-white hover:bg-slate-700'}"
				onclick={() => { showAnimationPicker = !showAnimationPicker; }}
				aria-label="Slide animation"
				title="Slide Animation"
			>
				<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
					<rect x="2" y="6" width="8" height="12" rx="1" opacity="0.35" /><rect x="8" y="6" width="8" height="12" rx="1" opacity="0.6" /><rect x="14" y="6" width="8" height="12" rx="1" />
				</svg>
				<span class="hidden lg:inline">Animation</span>
			</button>

			{#if showAnimationPicker && selectedSlide}
				<div
					class="absolute top-full left-0 mt-1 p-3 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 w-[220px]"
					data-anim-picker
					onclick={(e) => e.stopPropagation()}
				>
					<p class="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Slide Transition</p>
					<div class="space-y-3">
						<div>
							<label class="text-xs text-slate-300 mb-1 block">Type</label>
							<select
								class="w-full bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
								value={selectedSlide.animationType ?? ''}
								onchange={(e) => {
									saveHistory();
									const val = (e.target as HTMLSelectElement).value;
									selectedSlide!.animationType = val ? val as Slide['animationType'] : undefined;
								}}
							>
								<option value="">None</option>
								<option value="fade">Fade</option>
								<option value="dissolve">Dissolve</option>
								<option value="flip">Flip</option>
								<option value="slide-left">Slide from Left</option>
								<option value="slide-right">Slide from Right</option>
							</select>
						</div>
						{#if selectedSlide.animationType}
							<div>
								<div class="flex items-center justify-between mb-1">
									<label class="text-xs text-slate-300">Speed</label>
									<span class="text-xs text-slate-500">{selectedSlide.animationSpeed ?? 500}ms</span>
								</div>
								<input
									type="range"
									min="100"
									max="2000"
									step="50"
									value={selectedSlide.animationSpeed ?? 500}
									oninput={(e) => {
										saveHistory();
										selectedSlide!.animationSpeed = parseInt((e.target as HTMLInputElement).value);
									}}
									class="w-full accent-indigo-500"
								/>
								<div class="flex justify-between text-[10px] text-slate-500 mt-0.5">
									<span>Fast</span>
									<span>Slow</span>
								</div>
							</div>
							<button
								class="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors"
								onclick={(e) => { e.stopPropagation(); showAnimPreview = true; animPreviewKey++; }}
							>
								<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21" /></svg>
								Preview
							</button>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- Spacer -->
		<div class="flex-1"></div>

		<!-- Presenter button (hidden on mobile, shown in 2nd row) -->
		<button
			class="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
			onclick={startPresenter}
			aria-label="Presenter view"
			title="Presenter View"
		>
			<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
				<rect x="2" y="3" width="20" height="14" rx="2" />
				<path d="M8 21h8" />
				<path d="M12 17v4" />
				<path d="M7 9h2v2H7z" fill="currentColor" />
				<rect x="12" y="8" width="5" height="1.5" rx="0.5" />
				<rect x="12" y="11" width="3" height="1.5" rx="0.5" />
			</svg>
		</button>

		<!-- Slideshow button (hidden on mobile, shown in 2nd row) -->
		<button
			class="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-400 transition-colors"
			onclick={startPresentation}
			aria-label="Start slideshow"
			title="Start Slideshow"
		>
			<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
				<polygon points="5,3 19,12 5,21" />
			</svg>
		</button>
	</div>

	<!-- Mobile 2nd toolbar row: Background, Animation, Slideshow -->
	<div class="h-11 flex md:hidden items-center px-3 gap-1 border-t border-slate-800">
		<!-- Slide Background -->
		<div class="relative" data-bg-picker>
			<button
				class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors {showBgPicker
					? 'bg-indigo-500/20 text-indigo-400'
					: 'text-slate-400 hover:text-white hover:bg-slate-700'}"
				onclick={() => { showBgPicker = !showBgPicker; }}
				aria-label="Slide background"
				title="Slide Background"
			>
				<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
					<rect x="3" y="3" width="18" height="18" rx="2" />
					<path d="M3 16l5-5 4 4 4-6 5 7" />
				</svg>
				<span class="text-xs">Background</span>
			</button>
		</div>

		<!-- Slide Animation -->
		<div class="relative" data-anim-picker>
			<button
				class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors {showAnimationPicker
					? 'bg-indigo-500/20 text-indigo-400'
					: 'text-slate-400 hover:text-white hover:bg-slate-700'}"
				onclick={() => { showAnimationPicker = !showAnimationPicker; }}
				aria-label="Slide animation"
				title="Slide Animation"
			>
				<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
					<rect x="2" y="6" width="8" height="12" rx="1" opacity="0.35" /><rect x="8" y="6" width="8" height="12" rx="1" opacity="0.6" /><rect x="14" y="6" width="8" height="12" rx="1" />
				</svg>
				<span class="text-xs">Animation</span>
			</button>
		</div>

		<div class="flex-1"></div>

		<!-- Presenter button -->
		<button
			class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
			onclick={startPresenter}
			aria-label="Presenter view"
			title="Presenter View"
		>
			<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
				<rect x="2" y="3" width="20" height="14" rx="2" />
				<path d="M8 21h8" />
				<path d="M12 17v4" />
				<path d="M7 9h2v2H7z" fill="currentColor" />
				<rect x="12" y="8" width="5" height="1.5" rx="0.5" />
				<rect x="12" y="11" width="3" height="1.5" rx="0.5" />
			</svg>
		</button>

		<!-- Slideshow button -->
		<button
			class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-400 transition-colors"
			onclick={startPresentation}
			aria-label="Start slideshow"
			title="Start Slideshow"
		>
			<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
				<polygon points="5,3 19,12 5,21" />
			</svg>
		</button>
	</div>
	</div>

	<!-- Body: Sidebar + Slide Content -->
	<div class="flex flex-1 min-h-0">
	<!-- Left Panel: Slide Thumbnails -->
	<div class="w-56 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">

		<div class="flex-1 overflow-y-auto p-3 space-y-3">
			{#each slides as slide, i}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					data-slide-thumb={slide.id}
					class="w-full group relative cursor-pointer touch-none {dragSlideId === slide.id ? 'opacity-40' : ''}"
					use:slideDragAction={slide.id}
					onclick={() => {
						selectedSlideId = slide.id;

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
				{#if dragOverSlideId === slide.id && dragOverPosition === 'above'}
					<div class="absolute -top-1.5 left-0 right-0 h-0.5 bg-indigo-500 rounded-full z-20"></div>
				{/if}
				{#if dragOverSlideId === slide.id && dragOverPosition === 'below'}
					<div class="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-indigo-500 rounded-full z-20"></div>
				{/if}
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
						<div class="w-full h-full bg-slate-900 relative overflow-hidden" style="{slide.bgColor ? `background-color:${slide.bgColor}` : ''}{slide.bgImage ? `;background-image:url(${slide.bgImage});background-size:cover;background-position:center` : ''}">
							<!-- Skip overlay -->
							{#if slide.skipped}
								<div class="absolute inset-0 bg-black/50 z-10 flex items-center justify-center">
									<svg class="w-6 h-6 text-white/70" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
								</div>
							{/if}
							<!-- Textboxes (including title/subtitle) -->
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
											<line x1="5" y1="95" x2="95" y2="5" stroke={sh.borderColor} stroke-width="4" />
										{:else if sh.type === 'arrow'}
											<line x1="5" y1="95" x2="90" y2="10" stroke={sh.borderColor} stroke-width="4" />
											<polygon points="82,0 100,0 100,18" fill={sh.borderColor} />
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

					<!-- Sidebar buttons (reorder + edit) -->
					{#if selectedSlideId === slide.id}
						<div data-slide-menu data-slide-btn class="absolute -right-2 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1">
							{#if slides.length > 1}
								<button
									class="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center transition-all {i > 0 ? 'text-indigo-300 hover:bg-indigo-500 hover:text-white' : 'opacity-30 text-slate-500 cursor-default'}"
									onclick={(e) => { e.stopPropagation(); moveSlide(slide.id, -1); }}
									aria-label="Move slide up"
									disabled={i === 0}
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6" /></svg>
								</button>
								<button
									class="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center transition-all {i < slides.length - 1 ? 'text-indigo-300 hover:bg-indigo-500 hover:text-white' : 'opacity-30 text-slate-500 cursor-default'}"
									onclick={(e) => { e.stopPropagation(); moveSlide(slide.id, 1); }}
									aria-label="Move slide down"
									disabled={i === slides.length - 1}
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
								</button>
							{/if}
							<button
								class="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 hover:bg-indigo-500 hover:text-white transition-all"
								onclick={(e) => {
									e.stopPropagation();
									if (slideMenuId === slide.id) {
										slideMenuId = null;
										slideMenuAnchor = null;
									} else {
										const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
										slideMenuAnchor = { x: rect.right + 8, y: rect.top + rect.height / 2 };
										slideMenuId = slide.id;
									}
						
								}}
								aria-label="Slide options"
							>
								<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="6" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="18" r="1.5" /></svg>
							</button>
						</div>
					{/if}
				</div>
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
				style="max-width:1100px;aspect-ratio:16/10;transform:scale({canvasZoom});{selectedSlide?.bgColor ? `background-color:${selectedSlide.bgColor}` : ''}{selectedSlide?.bgImage ? `;background-image:url(${selectedSlide.bgImage});background-size:cover;background-position:center` : ''}"
				class:cursor-crosshair={activeTool === 'textbox' || activeTool === 'image' || activeTool === 'shape'}
				role="presentation"
				onmousedown={handleCanvasMousedown}
				onclick={(e) => {
					const t = e.target as HTMLElement;
					if (!t.isConnected) return;
					if (!t.closest('[data-textbox]') && !t.closest('[data-image]') && !t.closest('[data-shape]') && !t.closest('[data-table]')) {
						deselectAll();
					}
				}}
			>
				<!-- Textboxes layer -->
				{#each selectedSlide.textboxes as tb (tb.id)}
					<div
						data-textbox
						data-textbox-id={tb.id}
						data-textbox-role={tb.role ?? undefined}
						class="absolute border-2 rounded transition-colors touch-none {selectedTextboxId === tb.id
							? editingTextboxId === tb.id ? 'border-indigo-500 shadow-lg shadow-indigo-500/10 z-20' : 'border-indigo-500 shadow-lg shadow-indigo-500/10'
							: tb.role ? 'border-slate-700 hover:border-slate-600' : 'border-slate-600 hover:border-slate-500'}"
						style="left:{tb.x}%;top:{tb.y}%;width:{tb.width}%;min-height:{tb.height}%;background:{tb.bgColor ?? 'transparent'};{tb.role && activeTool ? 'pointer-events:none' : ''}"
						role="button"
						tabindex="0"
						onpointerdown={(e) => {
							if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
							if (activeTool) return;
							if (editingTextboxId === tb.id) return;
							elementWasSelected = selectedTextboxId === tb.id;
							e.preventDefault();
							selectTextbox(tb.id, e);
							if (tb.role) {
								editingTextboxId = tb.id;
								showFormattingToolbar = true;
							} else {
								startElementDragPointer('textbox', tb.id, e);
							}
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
							? activeImageId === image.id ? 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/10 z-20' : 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/10'
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
							? editingShapeId === shape.id ? 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/10 z-20' : 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/10'
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
								<line x1="5" y1="95" x2="95" y2="5" stroke={shape.borderColor} stroke-width={shape.borderWidth * 2} fill="none" />
							{:else if shape.type === 'arrow'}
								<line x1="5" y1="95" x2="90" y2="10" stroke={shape.borderColor} stroke-width={shape.borderWidth * 2} fill="none" />
								<polygon points="82,0 100,0 100,18" fill={shape.borderColor} />
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
							{#each [
									{ pos: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2', cursor: 'cursor-nwse-resize', corner: 'tl' as const },
									{ pos: 'top-0 right-0 translate-x-1/2 -translate-y-1/2', cursor: 'cursor-nesw-resize', corner: 'tr' as const },
									{ pos: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2', cursor: 'cursor-nesw-resize', corner: 'bl' as const },
									{ pos: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2', cursor: 'cursor-nwse-resize', corner: 'br' as const },
								] as handle}
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
							? editingTableId === table.id ? 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/10 z-20' : 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/10'
							: 'hover:ring-1 hover:ring-slate-500'}"
						style="left:{table.x}%;top:{table.y}%;width:{table.width}%;height:{table.height}%"
						role="button"
						tabindex="0"
						use:tablePointerAction={table.id}
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

							<!-- Move handle (visible when selected) -->
							<div
									data-table-move-handle
									class="absolute -bottom-8 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-slate-700 border-2 border-indigo-500 flex items-center justify-center cursor-move text-indigo-300 hover:bg-indigo-500 hover:text-white transition-colors z-30 touch-none"
									onpointerdown={(e) => startTableMoveFromHandle(table.id, e)}
									aria-label="Move table"
									role="button"
									tabindex="-1"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 2l3 3h-2v4h4v-2l3 3-3 3v-2h-4v4h2l-3 3-3-3h2v-4H7v2l-3-3 3-3v2h4V5H9l3-3z" /></svg>
							</div>
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

<!-- Slide edit popup menu (fixed position, outside sidebar scroll) -->
{#if slideMenuId !== null && slideMenuAnchor}
	{@const menuSlide = slides.find(s => s.id === slideMenuId)}
	{#if menuSlide}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div data-slide-menu class="fixed z-[100] w-52 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl shadow-black/40 py-1.5 text-sm" style="left:{slideMenuAnchor.x}px;top:{slideMenuAnchor.y}px;transform:translateY(-50%)">
			<!-- Duplicate -->
			<button
				class="w-full flex items-center gap-2.5 px-3 py-2 text-slate-200 hover:bg-slate-700 transition-colors"
				onclick={(e) => { e.stopPropagation(); duplicateSlide(menuSlide.id); }}
			>
				<svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
				Duplicate
			</button>
			<!-- Skip -->
			<button
				class="w-full flex items-center gap-2.5 px-3 py-2 text-slate-200 hover:bg-slate-700 transition-colors"
				onclick={(e) => { e.stopPropagation(); saveHistory(); menuSlide.skipped = !menuSlide.skipped; }}
			>
				{#if menuSlide.skipped}
					<svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
					Unskip
				{:else}
					<svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
					Skip
				{/if}
				{#if menuSlide.skipped}
					<span class="ml-auto text-xs text-amber-400/70">ON</span>
				{/if}
			</button>
			<!-- Divider + Remove -->
			{#if slides.length > 1}
				<div class="border-t border-slate-700 my-1"></div>
				<button
					class="w-full flex items-center gap-2.5 px-3 py-2 text-red-400 hover:bg-red-500/10 transition-colors"
					onclick={(e) => {
						e.stopPropagation();
						if (confirm('Remove this slide?')) {
							const id = menuSlide.id;
							slideMenuId = null;
				
							slideMenuAnchor = null;
							deleteSlide(id);
						}
					}}
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
					Remove
				</button>
			{/if}
		</div>
	{/if}
{/if}

<!-- Animation Preview Window -->
{#if showAnimPreview && selectedSlide?.animationType}
	{@const ps = selectedSlide}
	<div class="fixed bottom-6 right-6 z-[150] w-[420px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
		<!-- Header -->
		<div class="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
			<span class="text-xs font-medium text-slate-300">Animation Preview</span>
			<div class="flex items-center gap-1.5">
				<button
					class="w-6 h-6 rounded-full flex items-center justify-center text-indigo-400 hover:bg-indigo-500/20 transition-colors"
					onclick={() => { animPreviewKey++; }}
					title="Replay"
				>
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" /></svg>
				</button>
				<button
					class="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
					onclick={() => { showAnimPreview = false; }}
					title="Close"
				>
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
				</button>
			</div>
		</div>
		<!-- Preview area -->
		<div class="p-3 bg-black/30">
			{#key animPreviewKey}
				<div
					class="w-full aspect-[16/10] rounded-lg overflow-hidden bg-slate-900 relative pres-anim-{ps.animationType}"
					style="animation-duration:{ps.animationSpeed ?? 500}ms;{ps.bgColor ? `background-color:${ps.bgColor}` : ''}{ps.bgImage ? `;background-image:url(${ps.bgImage});background-size:cover;background-position:center` : ''}"
				>
					<!-- Textboxes -->
					{#each ps.textboxes as tb}
						<div
							class="absolute overflow-hidden"
							style="left:{tb.x}%;top:{tb.y}%;width:{tb.width}%;min-height:{tb.height}%;background:{tb.bgColor && tb.bgColor !== 'transparent' ? tb.bgColor : 'transparent'}"
						>
							<div class="p-px whitespace-pre-wrap break-words" style="font-family:{tb.fontFamily ?? 'sans-serif'};font-size:6px;font-weight:{tb.bold ? 'bold' : 'normal'};font-style:{tb.italic ? 'italic' : 'normal'};text-decoration:{tb.underline ? 'underline' : 'none'};text-align:{tb.align ?? 'left'};color:{tb.textColor ?? '#ffffff'};background:{tb.highlight ?? 'transparent'};line-height:1.2">{tb.text}</div>
						</div>
					{/each}
					<!-- Images -->
					{#each ps.images as img}
						<div
							class="absolute overflow-hidden rounded-sm"
							style="left:{img.x}%;top:{img.y}%;width:{img.width}%;height:{img.height}%"
						>
							{#if img.src !== ''}
								<img src={img.src} alt={img.name} class="w-full h-full object-cover" />
							{/if}
						</div>
					{/each}
					<!-- Shapes -->
					{#each (ps.shapes ?? []) as sh}
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
									<line x1="5" y1="95" x2="95" y2="5" stroke={sh.borderColor} stroke-width="4" />
								{:else if sh.type === 'arrow'}
									<line x1="5" y1="95" x2="90" y2="10" stroke={sh.borderColor} stroke-width="4" />
									<polygon points="82,0 100,0 100,18" fill={sh.borderColor} />
								{:else}
									<rect x="2" y="2" width="96" height="96" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="4" />
								{/if}
							</svg>
							{#if sh.text}
								<div class="absolute inset-0 flex items-center justify-center p-px" style="font-size:5px;color:{sh.textColor};text-align:{sh.align ?? 'center'};font-weight:{sh.bold ? 'bold' : 'normal'};line-height:1.2">{sh.text}</div>
							{/if}
						</div>
					{/each}
					<!-- Tables -->
					{#each (ps.tables ?? []) as tbl}
						<div
							class="absolute overflow-hidden"
							style="left:{tbl.x}%;top:{tbl.y}%;width:{tbl.width}%;height:{tbl.height}%"
						>
							<table class="w-full h-full" style="border-collapse:collapse;table-layout:fixed">
								{#each tbl.cells as row}
									<tr>
										{#each row as c}
											<td class="border border-slate-600/50" style="font-size:5px;color:{c.textColor ?? '#ffffff'};background:{c.bgColor ?? 'transparent'};padding:0 1px;line-height:1.2;vertical-align:top">{c.text}</td>
										{/each}
									</tr>
								{/each}
							</table>
						</div>
					{/each}
				</div>
			{/key}
		</div>
	</div>
{/if}

<!-- Presentation Mode Overlay -->
{#if presentationMode}
	{@const slide = slides[presentationSlideIndex]}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={presentationEl}
		class="fixed inset-0 z-[200] bg-black flex items-center justify-center cursor-none"
		onclick={presentationNext}
	>
		{#if slide}
			{#key presentationSlideIndex}
			<div
				class="relative w-full h-full max-h-screen {presentationTransition ? `pres-anim-${presentationTransition}` : ''}"
				style="aspect-ratio:16/10;max-width:calc(100vh * 16 / 10);{presentationTransition ? `animation-duration:${presentationTransitionSpeed}ms` : ''}"
			>
				<div class="absolute inset-0 bg-slate-900 overflow-hidden" style="{slide.bgColor ? `background-color:${slide.bgColor}` : ''}{slide.bgImage ? `;background-image:url(${slide.bgImage});background-size:cover;background-position:center` : ''}">
					<!-- Textboxes -->
					{#each slide.textboxes as tb}
						<div
							class="absolute overflow-hidden"
							style="left:{tb.x}%;top:{tb.y}%;width:{tb.width}%;min-height:{tb.height}%;background:{tb.bgColor && tb.bgColor !== 'transparent' ? tb.bgColor : 'transparent'}"
						>
							<div class="p-2 whitespace-pre-wrap break-words" style="font-family:{tb.fontFamily ?? 'sans-serif'};font-size:{tb.fontSize ?? 16}px;font-weight:{tb.bold ? 'bold' : 'normal'};font-style:{tb.italic ? 'italic' : 'normal'};text-decoration:{tb.underline ? 'underline' : 'none'};text-align:{tb.align ?? 'left'};color:{tb.textColor ?? '#ffffff'};background:{tb.highlight ?? 'transparent'};line-height:1.4">{tb.text}</div>
						</div>
					{/each}
					<!-- Images -->
					{#each slide.images as img}
						<div
							class="absolute overflow-hidden rounded"
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
									<ellipse cx="50" cy="50" rx="48" ry="48" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
								{:else if sh.type === 'triangle'}
									<polygon points="50,2 98,98 2,98" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
								{:else if sh.type === 'diamond'}
									<polygon points="50,2 98,50 50,98 2,50" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
								{:else if sh.type === 'star'}
									<polygon points="50,5 61,35 95,35 68,57 79,90 50,70 21,90 32,57 5,35 39,35" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
								{:else if sh.type === 'rounded-square'}
									<rect x="2" y="2" width="96" height="96" rx="12" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
								{:else if sh.type === 'line'}
									<line x1="0" y1="50" x2="100" y2="50" stroke={sh.borderColor} stroke-width="2" />
								{:else if sh.type === 'arrow'}
									<line x1="0" y1="50" x2="90" y2="50" stroke={sh.borderColor} stroke-width="2" />
									<polygon points="85,35 100,50 85,65" fill={sh.borderColor} />
								{:else}
									<rect x="2" y="2" width="96" height="96" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
								{/if}
							</svg>
							{#if sh.text}
								<div class="absolute inset-0 flex items-center justify-center p-2" style="font-size:{sh.fontSize}px;color:{sh.textColor};text-align:{sh.align ?? 'center'};font-weight:{sh.bold ? 'bold' : 'normal'};font-style:{sh.italic ? 'italic' : 'normal'};line-height:1.3">{sh.text}</div>
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
											<td class="border border-slate-600" style="font-size:{c.fontSize ?? 14}px;color:{c.textColor ?? '#ffffff'};background:{c.bgColor ?? 'transparent'};padding:4px 8px;line-height:1.4;vertical-align:top;font-weight:{c.bold ? 'bold' : 'normal'};font-style:{c.italic ? 'italic' : 'normal'};text-align:{c.align ?? 'left'}">{c.text}</td>
										{/each}
									</tr>
								{/each}
							</table>
						</div>
					{/each}
				</div>
			</div>
			{/key}

			<!-- Slide counter (non-skipped slides only) -->
			{@const nonSkipped = slides.filter(s => !s.skipped)}
			{@const posInNonSkipped = nonSkipped.indexOf(slide) + 1}
			<div class="absolute bottom-4 left-6 text-white/40 text-sm font-medium">
				{posInNonSkipped > 0 ? posInNonSkipped : presentationSlideIndex + 1} / {nonSkipped.length}
			</div>

			<!-- Close FAB -->
			<button
				class="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer z-10"
				use:stopPresentationAction
				title="Exit slideshow"
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
			</button>
		{/if}
	</div>
{/if}

<!-- Presenter Mode Overlay -->
{#if presenterMode}
	{@const currentSlide = slides[presenterSlideIndex]}
	{@const nonSkipped = slides.filter(s => !s.skipped)}
	{@const posInNonSkipped = currentSlide ? nonSkipped.indexOf(currentSlide) + 1 : 0}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-[200] bg-slate-950 flex flex-col select-none">
		<!-- Top bar: exit + timer + slide counter -->
		<div class="h-12 flex items-center gap-3 px-3 bg-slate-900/80 border-b border-slate-800 shrink-0">
			<button
				class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
				onclick={stopPresenter}
				title="Exit presenter view"
			>
				<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
			</button>
			<div class="w-px h-5 bg-slate-700"></div>
			<div class="flex items-center gap-2 font-mono text-sm text-white tabular-nums">
				<svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
					<circle cx="12" cy="12" r="10" />
					<polyline points="12,6 12,12 16,14" />
				</svg>
				{formatTime(presenterTimer)}
			</div>
			<button
				class="px-2 py-0.5 rounded text-xs font-medium transition-colors {presenterTimerRunning ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}"
				onclick={togglePresenterTimer}
			>{presenterTimerRunning ? 'Pause' : 'Resume'}</button>
			<button
				class="px-2 py-0.5 rounded text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
				onclick={resetPresenterTimer}
			>Reset</button>
			<div class="flex-1"></div>
			<div class="text-sm text-slate-400 font-medium">
				{posInNonSkipped > 0 ? posInNonSkipped : presenterSlideIndex + 1} / {nonSkipped.length}
			</div>
		</div>

		<!-- Main content area -->
		<div class="flex-1 min-h-0 relative">
			<!-- Presentation tab -->
			{#if presenterTab === 'presentation'}
				{@const prevIdx = (() => { let p = presenterSlideIndex - 1; while (p >= 0 && slides[p]?.skipped) p--; return p >= 0 ? p : -1; })()}
				{@const nextIdx = (() => { let n = presenterSlideIndex + 1; while (n < slides.length && slides[n]?.skipped) n++; return n < slides.length ? n : -1; })()}
				{@const prevSlide = prevIdx >= 0 ? slides[prevIdx] : null}
				{@const nextSlide = nextIdx >= 0 ? slides[nextIdx] : null}
				<div class="absolute inset-0 flex flex-col p-4 gap-3 overflow-hidden">
					<!-- Current slide -->
					<div class="flex-1 min-h-0 flex items-center justify-center">
						{#if currentSlide}
							<div class="relative h-full" style="aspect-ratio:16/10;max-width:100%;max-height:100%">
								<div class="absolute inset-0 bg-slate-900 overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/10" style="{currentSlide.bgColor ? `background-color:${currentSlide.bgColor}` : ''}{currentSlide.bgImage ? `;background-image:url(${currentSlide.bgImage});background-size:cover;background-position:center` : ''}">
									{#each currentSlide.textboxes as tb}
										<div class="absolute overflow-hidden" style="left:{tb.x}%;top:{tb.y}%;width:{tb.width}%;min-height:{tb.height}%;background:{tb.bgColor && tb.bgColor !== 'transparent' ? tb.bgColor : 'transparent'}">
											<div class="p-2 whitespace-pre-wrap break-words" style="font-family:{tb.fontFamily ?? 'sans-serif'};font-size:{tb.fontSize ?? 16}px;font-weight:{tb.bold ? 'bold' : 'normal'};font-style:{tb.italic ? 'italic' : 'normal'};text-decoration:{tb.underline ? 'underline' : 'none'};text-align:{tb.align ?? 'left'};color:{tb.textColor ?? '#ffffff'};background:{tb.highlight ?? 'transparent'};line-height:1.4">{tb.text}</div>
										</div>
									{/each}
									{#each currentSlide.images as img}
										<div class="absolute overflow-hidden rounded" style="left:{img.x}%;top:{img.y}%;width:{img.width}%;height:{img.height}%">
											{#if img.src !== ''}
												<img src={img.src} alt={img.name} class="w-full h-full object-cover" />
											{/if}
										</div>
									{/each}
									{#each (currentSlide.shapes ?? []) as sh}
										<div class="absolute overflow-hidden" style="left:{sh.x}%;top:{sh.y}%;width:{sh.width}%;height:{sh.height}%">
											<svg class="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
												{#if sh.type === 'circle'}
													<ellipse cx="50" cy="50" rx="48" ry="48" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
												{:else if sh.type === 'triangle'}
													<polygon points="50,2 98,98 2,98" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
												{:else if sh.type === 'diamond'}
													<polygon points="50,2 98,50 50,98 2,50" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
												{:else if sh.type === 'star'}
													<polygon points="50,5 61,35 95,35 68,57 79,90 50,70 21,90 32,57 5,35 39,35" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
												{:else if sh.type === 'rounded-square'}
													<rect x="2" y="2" width="96" height="96" rx="12" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
												{:else if sh.type === 'line'}
													<line x1="0" y1="50" x2="100" y2="50" stroke={sh.borderColor} stroke-width="2" />
												{:else if sh.type === 'arrow'}
													<line x1="0" y1="50" x2="90" y2="50" stroke={sh.borderColor} stroke-width="2" />
													<polygon points="85,35 100,50 85,65" fill={sh.borderColor} />
												{:else}
													<rect x="2" y="2" width="96" height="96" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
												{/if}
											</svg>
											{#if sh.text}
												<div class="absolute inset-0 flex items-center justify-center p-2" style="font-size:{sh.fontSize}px;color:{sh.textColor};text-align:{sh.align ?? 'center'};font-weight:{sh.bold ? 'bold' : 'normal'};font-style:{sh.italic ? 'italic' : 'normal'};line-height:1.3">{sh.text}</div>
											{/if}
										</div>
									{/each}
									{#each (currentSlide.tables ?? []) as tbl}
										<div class="absolute overflow-hidden" style="left:{tbl.x}%;top:{tbl.y}%;width:{tbl.width}%;height:{tbl.height}%">
											<table class="w-full h-full" style="border-collapse:collapse;table-layout:fixed">
												{#each tbl.cells as row}
													<tr>
														{#each row as c}
															<td class="border border-slate-600" style="font-size:{c.fontSize ?? 14}px;color:{c.textColor ?? '#ffffff'};background:{c.bgColor ?? 'transparent'};padding:4px 8px;line-height:1.4;vertical-align:top;font-weight:{c.bold ? 'bold' : 'normal'};font-style:{c.italic ? 'italic' : 'normal'};text-align:{c.align ?? 'left'}">{c.text}</td>
														{/each}
													</tr>
												{/each}
											</table>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>

					<!-- Previous / Next thumbnails side by side -->
					<div class="flex items-stretch gap-3 shrink-0" style="height:clamp(80px, 18vh, 140px)">
						<!-- Previous slide -->
						<button
							class="flex-1 min-w-0 rounded-lg overflow-hidden transition-all {prevSlide ? 'cursor-pointer ring-1 ring-white/10 hover:ring-white/30' : 'opacity-30 cursor-default'}"
							onclick={() => { if (prevSlide) presenterPrev(); }}
							disabled={!prevSlide}
						>
							<div class="relative w-full h-full flex items-center justify-center bg-slate-900/50">
								{#if prevSlide}
									<div class="relative h-full" style="aspect-ratio:16/10;max-width:100%;max-height:100%">
										<div class="absolute inset-0 bg-slate-900 overflow-hidden" style="{prevSlide.bgColor ? `background-color:${prevSlide.bgColor}` : ''}{prevSlide.bgImage ? `;background-image:url(${prevSlide.bgImage});background-size:cover;background-position:center` : ''}">
											{#each prevSlide.textboxes as tb}
												<div class="absolute overflow-hidden" style="left:{tb.x}%;top:{tb.y}%;width:{tb.width}%;min-height:{tb.height}%">
													<div class="whitespace-pre-wrap break-words" style="font-family:{tb.fontFamily ?? 'sans-serif'};font-size:clamp(3px, 0.8vw, 6px);font-weight:{tb.bold ? 'bold' : 'normal'};text-align:{tb.align ?? 'left'};color:{tb.textColor ?? '#ffffff'};line-height:1.2;padding:1px">{tb.text}</div>
												</div>
											{/each}
											{#each prevSlide.images as img}
												<div class="absolute overflow-hidden" style="left:{img.x}%;top:{img.y}%;width:{img.width}%;height:{img.height}%">
													{#if img.src !== ''}<img src={img.src} alt={img.name} class="w-full h-full object-cover" />{/if}
												</div>
											{/each}
											{#each (prevSlide.shapes ?? []) as sh}
												<div class="absolute overflow-hidden" style="left:{sh.x}%;top:{sh.y}%;width:{sh.width}%;height:{sh.height}%">
													<svg class="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
														{#if sh.type === 'circle'}<ellipse cx="50" cy="50" rx="48" ry="48" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
														{:else if sh.type === 'triangle'}<polygon points="50,2 98,98 2,98" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
														{:else if sh.type === 'diamond'}<polygon points="50,2 98,50 50,98 2,50" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
														{:else if sh.type === 'star'}<polygon points="50,5 61,35 95,35 68,57 79,90 50,70 21,90 32,57 5,35 39,35" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
														{:else if sh.type === 'rounded-square'}<rect x="2" y="2" width="96" height="96" rx="12" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
														{:else if sh.type === 'line'}<line x1="0" y1="50" x2="100" y2="50" stroke={sh.borderColor} stroke-width="2" />
														{:else if sh.type === 'arrow'}<line x1="0" y1="50" x2="90" y2="50" stroke={sh.borderColor} stroke-width="2" /><polygon points="85,35 100,50 85,65" fill={sh.borderColor} />
														{:else}<rect x="2" y="2" width="96" height="96" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
														{/if}
													</svg>
												</div>
											{/each}
										</div>
										<div class="absolute bottom-1 left-1.5 text-[9px] text-white/40 font-medium">Prev</div>
									</div>
								{:else}
									<div class="text-slate-600 text-xs">No previous slide</div>
								{/if}
							</div>
						</button>

						<!-- Next slide -->
						<button
							class="flex-1 min-w-0 rounded-lg overflow-hidden transition-all {nextSlide ? 'cursor-pointer ring-1 ring-white/10 hover:ring-white/30' : 'opacity-30 cursor-default'}"
							onclick={() => { if (nextSlide) presenterNext(); }}
							disabled={!nextSlide}
						>
							<div class="relative w-full h-full flex items-center justify-center bg-slate-900/50">
								{#if nextSlide}
									<div class="relative h-full" style="aspect-ratio:16/10;max-width:100%;max-height:100%">
										<div class="absolute inset-0 bg-slate-900 overflow-hidden" style="{nextSlide.bgColor ? `background-color:${nextSlide.bgColor}` : ''}{nextSlide.bgImage ? `;background-image:url(${nextSlide.bgImage});background-size:cover;background-position:center` : ''}">
											{#each nextSlide.textboxes as tb}
												<div class="absolute overflow-hidden" style="left:{tb.x}%;top:{tb.y}%;width:{tb.width}%;min-height:{tb.height}%">
													<div class="whitespace-pre-wrap break-words" style="font-family:{tb.fontFamily ?? 'sans-serif'};font-size:clamp(3px, 0.8vw, 6px);font-weight:{tb.bold ? 'bold' : 'normal'};text-align:{tb.align ?? 'left'};color:{tb.textColor ?? '#ffffff'};line-height:1.2;padding:1px">{tb.text}</div>
												</div>
											{/each}
											{#each nextSlide.images as img}
												<div class="absolute overflow-hidden" style="left:{img.x}%;top:{img.y}%;width:{img.width}%;height:{img.height}%">
													{#if img.src !== ''}<img src={img.src} alt={img.name} class="w-full h-full object-cover" />{/if}
												</div>
											{/each}
											{#each (nextSlide.shapes ?? []) as sh}
												<div class="absolute overflow-hidden" style="left:{sh.x}%;top:{sh.y}%;width:{sh.width}%;height:{sh.height}%">
													<svg class="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
														{#if sh.type === 'circle'}<ellipse cx="50" cy="50" rx="48" ry="48" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
														{:else if sh.type === 'triangle'}<polygon points="50,2 98,98 2,98" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
														{:else if sh.type === 'diamond'}<polygon points="50,2 98,50 50,98 2,50" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
														{:else if sh.type === 'star'}<polygon points="50,5 61,35 95,35 68,57 79,90 50,70 21,90 32,57 5,35 39,35" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
														{:else if sh.type === 'rounded-square'}<rect x="2" y="2" width="96" height="96" rx="12" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
														{:else if sh.type === 'line'}<line x1="0" y1="50" x2="100" y2="50" stroke={sh.borderColor} stroke-width="2" />
														{:else if sh.type === 'arrow'}<line x1="0" y1="50" x2="90" y2="50" stroke={sh.borderColor} stroke-width="2" /><polygon points="85,35 100,50 85,65" fill={sh.borderColor} />
														{:else}<rect x="2" y="2" width="96" height="96" fill={sh.fillColor} stroke={sh.borderColor} stroke-width="2" />
														{/if}
													</svg>
												</div>
											{/each}
										</div>
										<div class="absolute bottom-1 right-1.5 text-[9px] text-white/40 font-medium">Next</div>
									</div>
								{:else}
									<div class="text-slate-600 text-xs">No next slide</div>
								{/if}
							</div>
						</button>
					</div>
				</div>

			<!-- Questions tab -->
			{:else if presenterTab === 'questions'}
				<div class="absolute inset-0 flex flex-col">
					<div class="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
						{#if presenterQuestions.length === 0}
							<div class="flex flex-col items-center justify-center h-full text-slate-500">
								<svg class="w-12 h-12 mb-3 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
									<circle cx="12" cy="12" r="10" />
									<path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
									<path d="M12 17h.01" />
								</svg>
								<p class="text-sm font-medium">No questions yet</p>
								<p class="text-xs text-slate-600 mt-1">Tap + to add a question</p>
							</div>
						{:else}
							{#each presenterQuestions as q (q.id)}
								<div class="flex items-start gap-3 p-3 rounded-lg bg-slate-900/60 ring-1 ring-slate-800 group">
									<button
										class="mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors {q.answered ? 'border-emerald-500 bg-emerald-500/20' : 'border-slate-600 hover:border-slate-400'}"
										onclick={() => toggleQuestionAnswered(q.id)}
										title={q.answered ? 'Mark as unanswered' : 'Mark as answered'}
									>
										{#if q.answered}
											<svg class="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
										{/if}
									</button>
									{#if editingQuestionId === q.id}
										<input
											type="text"
											class="flex-1 bg-slate-800 text-white text-sm rounded px-2 py-1 outline-none ring-1 ring-indigo-500"
											bind:value={q.text}
											onkeydown={(e) => { if (e.key === 'Enter') editingQuestionId = null; }}
											onblur={() => { editingQuestionId = null; }}
										/>
									{:else}
										<p
											class="flex-1 text-sm leading-relaxed cursor-pointer {q.answered ? 'text-slate-500 line-through' : 'text-slate-200'}"
											ondblclick={() => { editingQuestionId = q.id; }}
										>{q.text}</p>
									{/if}
									<button
										class="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all shrink-0"
										onclick={() => deletePresenterQuestion(q.id)}
										title="Delete question"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
									</button>
								</div>
							{/each}
						{/if}
					</div>
					<!-- Add question FAB -->
					{#if showAddQuestion}
						<div class="p-4 border-t border-slate-800 bg-slate-900/60">
							<div class="flex gap-2">
								<input
									type="text"
									class="flex-1 bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none ring-1 ring-slate-700 focus:ring-indigo-500 placeholder:text-slate-500"
									placeholder="Type your question..."
									bind:value={newQuestionText}
									onkeydown={(e) => { if (e.key === 'Enter') addPresenterQuestion(); if (e.key === 'Escape') { showAddQuestion = false; newQuestionText = ''; } }}
								/>
								<button
									class="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-400 transition-colors"
									onclick={addPresenterQuestion}
								>Add</button>
							</div>
						</div>
					{:else}
						<div class="absolute bottom-6 right-6">
							<button
								class="w-12 h-12 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center transition-colors"
								onclick={() => { showAddQuestion = true; }}
								title="Add question"
							>
								<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
							</button>
						</div>
					{/if}
				</div>

			<!-- Notes tab -->
			{:else if presenterTab === 'notes'}
				<div class="absolute inset-0 flex flex-col" onclick={(e) => { if (noteColorTarget && !(e.target as HTMLElement).closest('[data-note-colors]')) noteColorTarget = null; }}>
					<div class="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
						{#if presenterNotes.length === 0}
							<div class="flex flex-col items-center justify-center h-full text-slate-500">
								<svg class="w-12 h-12 mb-3 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
									<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
									<path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
								</svg>
								<p class="text-sm font-medium">No notes yet</p>
								<p class="text-xs text-slate-600 mt-1">Tap + to add a note</p>
							</div>
						{:else}
							{#each presenterNotes as n (n.id)}
								<div class="rounded-lg ring-1 ring-slate-800 group overflow-hidden" style="background:{n.bgColor && n.bgColor !== 'transparent' ? n.bgColor : 'rgb(15 23 42 / 0.6)'}">
									{#if editingNoteId === n.id}
										<!-- Edit mode -->
										<div class="p-3">
											<textarea
												class="w-full bg-slate-800/80 text-sm rounded px-2 py-1.5 outline-none ring-1 ring-indigo-500 resize-none min-h-[60px]"
												style="color:{n.textColor ?? '#e2e8f0'};text-align:{n.align ?? 'left'}"
												bind:value={n.text}
												onkeydown={(e) => { if (e.key === 'Escape') { editingNoteId = null; noteColorTarget = null; } }}
											></textarea>
											<!-- Formatting toolbar -->
											<div class="flex items-center gap-1 mt-2 flex-wrap">
												<!-- Alignment buttons -->
												<div class="flex items-center rounded-lg bg-slate-800/80 p-0.5 gap-0.5">
													<button class="p-1.5 rounded transition-colors {(n.align ?? 'left') === 'left' ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:text-white'}" onclick={() => { n.align = 'left'; }} title="Align left">
														<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 10H3M21 6H3M21 14H3M17 18H3" /></svg>
													</button>
													<button class="p-1.5 rounded transition-colors {n.align === 'center' ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:text-white'}" onclick={() => { n.align = 'center'; }} title="Align center">
														<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 10H6M21 6H3M21 14H3M18 18H6" /></svg>
													</button>
													<button class="p-1.5 rounded transition-colors {n.align === 'right' ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:text-white'}" onclick={() => { n.align = 'right'; }} title="Align right">
														<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10H7M21 6H3M21 14H3M21 18H7" /></svg>
													</button>
												</div>
												<!-- Text color -->
												<div class="relative" data-note-colors>
													<button
														class="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 transition-colors {noteColorTarget?.noteId === n.id && noteColorTarget?.field === 'textColor' ? 'text-indigo-300 ring-1 ring-indigo-500' : 'text-slate-400 hover:text-white'}"
														onclick={() => { noteColorTarget = noteColorTarget?.noteId === n.id && noteColorTarget?.field === 'textColor' ? null : { noteId: n.id, field: 'textColor' }; }}
														title="Text color"
													>
														<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 3l6.5 13H5.5L12 3z" /><path d="M3 20h18" stroke={n.textColor ?? '#e2e8f0'} stroke-width="3" /></svg>
														<span>Text</span>
													</button>
													{#if noteColorTarget?.noteId === n.id && noteColorTarget?.field === 'textColor'}
														<div class="absolute bottom-full left-0 mb-2 p-2 bg-slate-800 rounded-lg ring-1 ring-slate-700 shadow-xl z-10 grid grid-cols-8 gap-1 w-52" data-note-colors>
															{#each noteColorSwatches.filter(c => c !== 'transparent') as color}
																<button
																	class="w-5 h-5 rounded-full ring-1 ring-white/10 hover:ring-white/40 transition-all {n.textColor === color ? 'ring-2 ring-indigo-400 scale-110' : ''}"
																	style="background:{color}"
																	onclick={() => { n.textColor = color; noteColorTarget = null; }}
																></button>
															{/each}
														</div>
													{/if}
												</div>
												<!-- Background color -->
												<div class="relative" data-note-colors>
													<button
														class="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 transition-colors {noteColorTarget?.noteId === n.id && noteColorTarget?.field === 'bgColor' ? 'text-indigo-300 ring-1 ring-indigo-500' : 'text-slate-400 hover:text-white'}"
														onclick={() => { noteColorTarget = noteColorTarget?.noteId === n.id && noteColorTarget?.field === 'bgColor' ? null : { noteId: n.id, field: 'bgColor' }; }}
														title="Background color"
													>
														<div class="w-3.5 h-3.5 rounded border border-slate-500" style="background:{n.bgColor && n.bgColor !== 'transparent' ? n.bgColor : 'transparent'}"></div>
														<span>Fill</span>
													</button>
													{#if noteColorTarget?.noteId === n.id && noteColorTarget?.field === 'bgColor'}
														<div class="absolute bottom-full left-0 mb-2 p-2 bg-slate-800 rounded-lg ring-1 ring-slate-700 shadow-xl z-10 grid grid-cols-8 gap-1 w-52" data-note-colors>
															{#each noteColorSwatches as color}
																<button
																	class="w-5 h-5 rounded-full ring-1 ring-white/10 hover:ring-white/40 transition-all {(n.bgColor ?? 'transparent') === color ? 'ring-2 ring-indigo-400 scale-110' : ''}"
																	style="background:{color === 'transparent' ? 'repeating-conic-gradient(#334155 0% 25%, transparent 0% 50%) 50%/8px 8px' : color}"
																	onclick={() => { n.bgColor = color; noteColorTarget = null; }}
																	title={color === 'transparent' ? 'Transparent' : color}
																></button>
															{/each}
														</div>
													{/if}
												</div>
												<div class="flex-1"></div>
												<!-- Done editing -->
												<button
													class="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500 text-white hover:bg-indigo-400 transition-colors"
													onclick={() => { editingNoteId = null; noteColorTarget = null; }}
												>Done</button>
											</div>
										</div>
									{:else}
										<!-- View mode -->
										<div class="flex items-start gap-3 p-3">
											<p
												class="flex-1 text-sm leading-relaxed whitespace-pre-wrap"
												style="color:{n.textColor ?? '#e2e8f0'};text-align:{n.align ?? 'left'}"
											>{n.text}</p>
											<div class="flex items-center gap-1 shrink-0">
												<button
													class="p-1.5 text-slate-500 hover:text-indigo-400 transition-colors rounded-md hover:bg-slate-800/60"
													onclick={() => { editingNoteId = n.id; }}
													title="Edit note"
												>
													<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
												</button>
												<button
													class="p-1.5 text-slate-500 hover:text-red-400 transition-colors rounded-md hover:bg-slate-800/60"
													onclick={() => deletePresenterNote(n.id)}
													title="Delete note"
												>
													<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
												</button>
											</div>
										</div>
									{/if}
								</div>
							{/each}
						{/if}
					</div>
					<!-- Add note panel / FAB -->
					{#if showAddNote}
						<div class="p-4 border-t border-slate-800 bg-slate-900/60">
							<textarea
								class="w-full bg-slate-800 text-sm rounded-lg px-3 py-2 outline-none ring-1 ring-slate-700 focus:ring-indigo-500 placeholder:text-slate-500 resize-none min-h-[60px]"
								style="color:{newNoteTextColor};text-align:{newNoteAlign};background:{newNoteBgColor !== 'transparent' ? newNoteBgColor : ''}"
								placeholder="Type your note..."
								bind:value={newNoteText}
								onkeydown={(e) => { if (e.key === 'Escape') { showAddNote = false; newNoteText = ''; noteColorTarget = null; } }}
							></textarea>
							<div class="flex items-center gap-1 mt-2 flex-wrap">
								<!-- Alignment -->
								<div class="flex items-center rounded-lg bg-slate-800/80 p-0.5 gap-0.5">
									<button class="p-1.5 rounded transition-colors {newNoteAlign === 'left' ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:text-white'}" onclick={() => { newNoteAlign = 'left'; }} title="Align left">
										<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 10H3M21 6H3M21 14H3M17 18H3" /></svg>
									</button>
									<button class="p-1.5 rounded transition-colors {newNoteAlign === 'center' ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:text-white'}" onclick={() => { newNoteAlign = 'center'; }} title="Align center">
										<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 10H6M21 6H3M21 14H3M18 18H6" /></svg>
									</button>
									<button class="p-1.5 rounded transition-colors {newNoteAlign === 'right' ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:text-white'}" onclick={() => { newNoteAlign = 'right'; }} title="Align right">
										<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10H7M21 6H3M21 14H3M21 18H7" /></svg>
									</button>
								</div>
								<!-- Text color -->
								<div class="relative" data-note-colors>
									<button
										class="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 transition-colors {noteColorTarget?.noteId === 'new' && noteColorTarget?.field === 'textColor' ? 'text-indigo-300 ring-1 ring-indigo-500' : 'text-slate-400 hover:text-white'}"
										onclick={() => { noteColorTarget = noteColorTarget?.noteId === 'new' && noteColorTarget?.field === 'textColor' ? null : { noteId: 'new', field: 'textColor' }; }}
										title="Text color"
									>
										<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 3l6.5 13H5.5L12 3z" /><path d="M3 20h18" stroke={newNoteTextColor} stroke-width="3" /></svg>
										<span>Text</span>
									</button>
									{#if noteColorTarget?.noteId === 'new' && noteColorTarget?.field === 'textColor'}
										<div class="absolute bottom-full left-0 mb-2 p-2 bg-slate-800 rounded-lg ring-1 ring-slate-700 shadow-xl z-10 grid grid-cols-8 gap-1 w-52" data-note-colors>
											{#each noteColorSwatches.filter(c => c !== 'transparent') as color}
												<button
													class="w-5 h-5 rounded-full ring-1 ring-white/10 hover:ring-white/40 transition-all {newNoteTextColor === color ? 'ring-2 ring-indigo-400 scale-110' : ''}"
													style="background:{color}"
													onclick={() => { newNoteTextColor = color; noteColorTarget = null; }}
												></button>
											{/each}
										</div>
									{/if}
								</div>
								<!-- Background color -->
								<div class="relative" data-note-colors>
									<button
										class="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 transition-colors {noteColorTarget?.noteId === 'new' && noteColorTarget?.field === 'bgColor' ? 'text-indigo-300 ring-1 ring-indigo-500' : 'text-slate-400 hover:text-white'}"
										onclick={() => { noteColorTarget = noteColorTarget?.noteId === 'new' && noteColorTarget?.field === 'bgColor' ? null : { noteId: 'new', field: 'bgColor' }; }}
										title="Background color"
									>
										<div class="w-3.5 h-3.5 rounded border border-slate-500" style="background:{newNoteBgColor !== 'transparent' ? newNoteBgColor : 'transparent'}"></div>
										<span>Fill</span>
									</button>
									{#if noteColorTarget?.noteId === 'new' && noteColorTarget?.field === 'bgColor'}
										<div class="absolute bottom-full left-0 mb-2 p-2 bg-slate-800 rounded-lg ring-1 ring-slate-700 shadow-xl z-10 grid grid-cols-8 gap-1 w-52" data-note-colors>
											{#each noteColorSwatches as color}
												<button
													class="w-5 h-5 rounded-full ring-1 ring-white/10 hover:ring-white/40 transition-all {newNoteBgColor === color ? 'ring-2 ring-indigo-400 scale-110' : ''}"
													style="background:{color === 'transparent' ? 'repeating-conic-gradient(#334155 0% 25%, transparent 0% 50%) 50%/8px 8px' : color}"
													onclick={() => { newNoteBgColor = color; noteColorTarget = null; }}
													title={color === 'transparent' ? 'Transparent' : color}
												></button>
											{/each}
										</div>
									{/if}
								</div>
								<div class="flex-1"></div>
								<button
									class="px-2 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
									onclick={() => { showAddNote = false; newNoteText = ''; noteColorTarget = null; }}
								>Cancel</button>
								<button
									class="px-4 py-1.5 rounded-lg text-xs font-medium bg-indigo-500 text-white hover:bg-indigo-400 transition-colors"
									onclick={addPresenterNote}
								>Add</button>
							</div>
						</div>
					{:else}
						<div class="absolute bottom-6 right-6">
							<button
								class="w-12 h-12 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center transition-colors"
								onclick={() => { showAddNote = true; }}
								title="Add note"
							>
								<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
							</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Bottom navigation -->
		<div class="h-16 flex items-center justify-around bg-slate-900 border-t border-slate-800 shrink-0">
			<button
				class="flex flex-col items-center gap-1 px-6 py-1.5 rounded-lg transition-colors {presenterTab === 'presentation' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}"
				onclick={() => { presenterTab = 'presentation'; }}
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
					<rect x="2" y="3" width="20" height="14" rx="2" />
					<path d="M8 21h8" />
					<path d="M12 17v4" />
				</svg>
				<span class="text-[11px] font-medium">Presentation</span>
			</button>
			<button
				class="relative flex flex-col items-center gap-1 px-6 py-1.5 rounded-lg transition-colors {presenterTab === 'questions' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}"
				onclick={() => { presenterTab = 'questions'; }}
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
					<circle cx="12" cy="12" r="10" />
					<path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
					<path d="M12 17h.01" />
				</svg>
				<span class="text-[11px] font-medium">Questions</span>
				{#if presenterQuestions.filter(q => !q.answered).length > 0}
					<span class="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{presenterQuestions.filter(q => !q.answered).length}</span>
				{/if}
			</button>
			<button
				class="flex flex-col items-center gap-1 px-6 py-1.5 rounded-lg transition-colors {presenterTab === 'notes' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}"
				onclick={() => { presenterTab = 'notes'; }}
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
					<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
					<path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
				</svg>
				<span class="text-[11px] font-medium">Notes</span>
			</button>
		</div>
	</div>
{/if}

<style>
	/* Presentation transition animations */
	:global(.pres-anim-fade) {
		animation: pres-fade ease-out both;
	}
	:global(.pres-anim-dissolve) {
		animation: pres-dissolve ease-in-out both;
	}
	:global(.pres-anim-flip) {
		animation: pres-flip ease-in-out both;
	}
	:global(.pres-anim-slide-left) {
		animation: pres-slide-left ease-out both;
	}
	:global(.pres-anim-slide-right) {
		animation: pres-slide-right ease-out both;
	}

	@keyframes pres-fade {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	@keyframes pres-dissolve {
		0% { opacity: 0; filter: blur(8px); }
		100% { opacity: 1; filter: blur(0); }
	}
	@keyframes pres-flip {
		0% { transform: perspective(1200px) rotateY(-90deg); opacity: 0; }
		100% { transform: perspective(1200px) rotateY(0deg); opacity: 1; }
	}
	@keyframes pres-slide-left {
		from { transform: translateX(-100%); opacity: 0; }
		to { transform: translateX(0); opacity: 1; }
	}
	@keyframes pres-slide-right {
		from { transform: translateX(100%); opacity: 0; }
		to { transform: translateX(0); opacity: 1; }
	}
</style>
