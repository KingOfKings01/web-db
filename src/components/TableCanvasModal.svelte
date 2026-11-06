<script>
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { comparisonTablesStore, tablesStore } from '../lib/db-store.js';

  const CANVAS_STATE_STORAGE_KEY = 'ORACLE_STUDIO_CANVAS_STATE_V2';
  export let visible = false;
  export let onClose = () => {};

  let viewport;
  let workspace;
  let zoomLevel = 1.0;
  let panOffset = { x: 0, y: 0 };
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let panPointerId = null;

  let searchTerm = '';
  let hoveredValue = null;
  let pinnedTables = new Set();
  let minimizedTables = new Set();
  let hiddenTables = new Set();
  let showTablePicker = false;

  // Tools: 'select' | 'pan' | 'marker' | 'arrow' | 'eraser'
  let activeTool = 'select';
  let selectedColor = '#ef4444';
  let selectedColorName = 'red';
  let strokeWidth = 3;

  // Drawings list: [{ id, type: 'path'|'arrow', d?, x1?, y1?, x2?, y2?, color, colorName, width }]
  let drawings = [];
  let isDrawing = false;
  let currentPath = null;
  let currentArrow = null;
  let rawPathPoints = [];

  // Positions of table cards: { [tableName]: { x, y, zIndex } }
  let cardPositions = {};
  let activeDrag = null;
  let highestZIndex = 100;
  let canvasStateLoaded = false;

  // Undo / Redo History Stacks
  let undoStack = [];
  let redoStack = [];
  const MAX_HISTORY = 40;

  function captureSnapshot() {
    const snapshot = {
      drawings: JSON.parse(JSON.stringify(drawings)),
      hiddenTables: [...hiddenTables],
      cardPositions: JSON.parse(JSON.stringify(cardPositions))
    };
    undoStack = [...undoStack.slice(-MAX_HISTORY + 1), snapshot];
    redoStack = [];
  }

  function handleUndo() {
    if (undoStack.length === 0) return;
    const currentSnapshot = {
      drawings: JSON.parse(JSON.stringify(drawings)),
      hiddenTables: [...hiddenTables],
      cardPositions: JSON.parse(JSON.stringify(cardPositions))
    };
    redoStack = [...redoStack, currentSnapshot];

    const prev = undoStack[undoStack.length - 1];
    undoStack = undoStack.slice(0, -1);
    drawings = prev.drawings;
    hiddenTables = new Set(prev.hiddenTables);
    cardPositions = prev.cardPositions;
  }

  function handleRedo() {
    if (redoStack.length === 0) return;
    const currentSnapshot = {
      drawings: JSON.parse(JSON.stringify(drawings)),
      hiddenTables: [...hiddenTables],
      cardPositions: JSON.parse(JSON.stringify(cardPositions))
    };
    undoStack = [...undoStack, currentSnapshot];

    const next = redoStack[redoStack.length - 1];
    redoStack = redoStack.slice(0, -1);
    drawings = next.drawings;
    hiddenTables = new Set(next.hiddenTables);
    cardPositions = next.cardPositions;
  }

  const COLOR_PALETTE = [
    { name: 'red', hex: '#ef4444' },
    { name: 'blue', hex: '#3b82f6' },
    { name: 'green', hex: '#10b981' },
    { name: 'amber', hex: '#f59e0b' },
    { name: 'purple', hex: '#a855f7' }
  ];

  $: if (canvasStateLoaded) {
    try {
      localStorage.setItem(CANVAS_STATE_STORAGE_KEY, JSON.stringify({
        zoomLevel,
        panOffset,
        searchTerm,
        pinnedTables: [...pinnedTables],
        minimizedTables: [...minimizedTables],
        hiddenTables: [...hiddenTables],
        drawings,
        cardPositions
      }));
    } catch (error) {
      console.error('Failed to save table canvas state', error);
    }
  }

  $: allAvailableTables = [
    ...Object.entries($tablesStore).filter(([name]) => name !== 'DUAL'),
    ...$comparisonTablesStore.map(table => [table.name, table])
  ];

  $: canvasTables = allAvailableTables.filter(([name]) => !hiddenTables.has(name));
  $: hiddenTableNames = allAvailableTables
    .map(([name]) => name)
    .filter(name => hiddenTables.has(name));

  // Initialize or update positions whenever tables change
  $: {
    const tableKeys = allAvailableTables.map(([name]) => name);
    let curX = 40;
    let curY = 40;
    tableKeys.forEach((name) => {
      if (!cardPositions[name]) {
        cardPositions[name] = {
          x: curX,
          y: curY,
          zIndex: ++highestZIndex
        };
        curX += 470;
        if (curX > 1800) {
          curX = 40;
          curY += 400;
        }
      }
    });
  }

  function handleClose() {
    stopDrag();
    stopPanning();
    isDrawing = false;
    currentPath = null;
    currentArrow = null;
    showTablePicker = false;
    onClose();
  }

  export function resetCanvasState() {
    zoomLevel = 1;
    panOffset = { x: 0, y: 0 };
    searchTerm = '';
    hoveredValue = null;
    pinnedTables = new Set();
    minimizedTables = new Set();
    hiddenTables = new Set();
    drawings = [];
    activeTool = 'select';
    let x = 40;
    let y = 40;
    let zIndex = 100;
    cardPositions = {};
    const tableNames = allAvailableTables.map(([name]) => name);
    for (const name of tableNames) {
      cardPositions[name] = { x, y, zIndex: ++zIndex };
      x += 470;
      if (x > 1800) {
        x = 40;
        y += 400;
      }
    }
    highestZIndex = zIndex;
    stopDrag();
    stopPanning();
  }

  function handleKeydown(e) {
    if (!visible) return;

    if (e.key === 'Escape') {
      if (showTablePicker) {
        showTablePicker = false;
      } else {
        handleClose();
      }
      return;
    }

    // Ctrl+Z (Undo) and Ctrl+Y / Ctrl+Shift+Z (Redo)
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        handleRedo();
        return;
      }
    }

    // Keyboard shortcuts for tools
    if (!e.target.closest('input, textarea')) {
      if (e.key === 'v' || e.key === 'V') activeTool = 'select';
      if (e.key === 'h' || e.key === 'H') activeTool = 'pan';
      if (e.key === 'm' || e.key === 'M') activeTool = 'marker';
      if (e.key === 'a' || e.key === 'A') activeTool = 'arrow';
      if (e.key === 'e' || e.key === 'E') activeTool = 'eraser';
    }
  }

  function removeTableFromCanvas(tableName, isQueryResult) {
    captureSnapshot();
    if (isQueryResult) {
      comparisonTablesStore.update(list => list.filter(t => t.name !== tableName));
    } else {
      hiddenTables.add(tableName);
      hiddenTables = new Set(hiddenTables);
    }
  }

  function restoreTable(tableName) {
    captureSnapshot();
    hiddenTables.delete(tableName);
    hiddenTables = new Set(hiddenTables);
    bringToFront(tableName);
  }

  function restoreAllTables() {
    captureSnapshot();
    hiddenTables = new Set();
    showTablePicker = false;
  }

  function bringToFront(tableName) {
    if (cardPositions[tableName]) {
      cardPositions[tableName].zIndex = ++highestZIndex;
      cardPositions = { ...cardPositions };
    }
  }

  function toggleMinimize(tableName) {
    if (minimizedTables.has(tableName)) {
      minimizedTables.delete(tableName);
    } else {
      minimizedTables.add(tableName);
    }
    minimizedTables = new Set(minimizedTables);
  }

  function togglePin(tableName) {
    if (pinnedTables.has(tableName)) {
      pinnedTables.delete(tableName);
    } else {
      pinnedTables.add(tableName);
    }
    pinnedTables = new Set(pinnedTables);
  }

  // Card Header Dragging with Pointer Events & Pointer Capture
  function startCardDrag(e, tableName, headerEl) {
    if (e.button !== 0) return;
    if (e.target.closest('.card-controls')) return;
    e.preventDefault();

    bringToFront(tableName);
    try { headerEl.setPointerCapture(e.pointerId); } catch (_) {}

    const pos = cardPositions[tableName] || { x: 40, y: 40 };

    activeDrag = {
      tableName,
      headerEl,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      initialX: pos.x,
      initialY: pos.y
    };

    document.body.classList.add('is-canvas-dragging');
  }

  function onCardPointerMove(e) {
    if (!activeDrag || activeDrag.pointerId !== e.pointerId) return;
    if (e.buttons === 0) {
      stopDrag();
      return;
    }

    const dx = (e.clientX - activeDrag.startX) / zoomLevel;
    const dy = (e.clientY - activeDrag.startY) / zoomLevel;

    const newX = Math.max(10, activeDrag.initialX + dx);
    const newY = Math.max(10, activeDrag.initialY + dy);

    cardPositions[activeDrag.tableName].x = newX;
    cardPositions[activeDrag.tableName].y = newY;
    cardPositions = { ...cardPositions };
  }

  function onCardPointerEnd(e) {
    if (activeDrag && (!e || !e.pointerId || activeDrag.pointerId === e.pointerId)) {
      stopDrag();
    }
  }

  function stopDrag() {
    if (activeDrag) {
      const pos = cardPositions[activeDrag.tableName];
      if (pos && (pos.x !== activeDrag.initialX || pos.y !== activeDrag.initialY)) {
        const prevCardPositions = {
          ...cardPositions,
          [activeDrag.tableName]: {
            ...pos,
            x: activeDrag.initialX,
            y: activeDrag.initialY
          }
        };
        undoStack = [...undoStack.slice(-MAX_HISTORY + 1), {
          drawings: JSON.parse(JSON.stringify(drawings)),
          hiddenTables: [...hiddenTables],
          cardPositions: prevCardPositions
        }];
        redoStack = [];
      }
      if (activeDrag.headerEl && activeDrag.pointerId) {
        try { activeDrag.headerEl.releasePointerCapture(activeDrag.pointerId); } catch (_) {}
      }
      activeDrag = null;
    }
    document.body.classList.remove('is-canvas-dragging');
  }

  // Canvas Panning via background drag or Pan tool
  function startPan(e) {
    if (e.button !== 0) return;
    if (activeTool === 'pan' || e.target === viewport || e.target === workspace || e.target.classList?.contains('drawing-svg-layer')) {
      if (activeTool !== 'marker' && activeTool !== 'arrow' && activeTool !== 'eraser') {
        e.preventDefault();
        isPanning = true;
        panPointerId = e.pointerId;
        panStart = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
        try { viewport.setPointerCapture(e.pointerId); } catch (_) {}
      }
    }
  }

  function onPanMove(e) {
    if (!isPanning) return;
    if (e.buttons === 0) {
      stopPanning();
      return;
    }
    panOffset.x = e.clientX - panStart.x;
    panOffset.y = e.clientY - panStart.y;
    panOffset = { ...panOffset };
  }

  function onPanEnd(e) {
    if (isPanning && (!e || !e.pointerId || e.pointerId === panPointerId)) {
      if (panPointerId && viewport) {
        try { viewport.releasePointerCapture(panPointerId); } catch (_) {}
        panPointerId = null;
      }
      stopPanning();
    }
  }

  function stopPanning() {
    isPanning = false;
  }

  function resetView() {
    zoomLevel = 1.0;
    panOffset = { x: 0, y: 0 };
    if (viewport) {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    }
  }

  function setZoom(lvl) {
    zoomLevel = Math.min(2.0, Math.max(0.4, lvl));
  }

  // Drawing Tools Logic (Marker, Arrow, Eraser)
  function getWorkspaceCoords(e) {
    if (!workspace) return { x: 0, y: 0 };
    const rect = workspace.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoomLevel,
      y: (e.clientY - rect.top) / zoomLevel
    };
  }

  function onDrawingPointerDown(e) {
    if (e.button !== 0) return;
    if (activeTool === 'select' || activeTool === 'pan') return;

    const coords = getWorkspaceCoords(e);

    if (activeTool === 'marker') {
      captureSnapshot();
      isDrawing = true;
      rawPathPoints = [coords];
      currentPath = {
        d: `M ${coords.x.toFixed(1)} ${coords.y.toFixed(1)}`
      };
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    } else if (activeTool === 'arrow') {
      captureSnapshot();
      isDrawing = true;
      currentArrow = {
        x1: coords.x,
        y1: coords.y,
        x2: coords.x,
        y2: coords.y
      };
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    } else if (activeTool === 'eraser') {
      eraseAtPoint(coords.x, coords.y);
    }
  }

  function onDrawingPointerMove(e) {
    if (!isDrawing && activeTool !== 'eraser') return;
    const coords = getWorkspaceCoords(e);

    if (activeTool === 'marker' && isDrawing) {
      rawPathPoints.push(coords);
      const prev = currentPath?.d || '';
      currentPath = {
        d: `${prev} L ${coords.x.toFixed(1)} ${coords.y.toFixed(1)}`
      };
    } else if (activeTool === 'arrow' && isDrawing && currentArrow) {
      currentArrow = {
        ...currentArrow,
        x2: coords.x,
        y2: coords.y
      };
    } else if (activeTool === 'eraser' && e.buttons === 1) {
      eraseAtPoint(coords.x, coords.y);
    }
  }

  function onDrawingPointerUp(e) {
    if (!isDrawing) return;
    isDrawing = false;

    if (activeTool === 'marker' && currentPath && rawPathPoints.length > 1) {
      drawings = [
        ...drawings,
        {
          id: Date.now() + Math.random(),
          type: 'path',
          d: currentPath.d,
          color: selectedColor,
          width: strokeWidth
        }
      ];
    } else if (activeTool === 'arrow' && currentArrow) {
      const dist = Math.hypot(currentArrow.x2 - currentArrow.x1, currentArrow.y2 - currentArrow.y1);
      if (dist > 15) {
        drawings = [
          ...drawings,
          {
            id: Date.now() + Math.random(),
            type: 'arrow',
            x1: currentArrow.x1,
            y1: currentArrow.y1,
            x2: currentArrow.x2,
            y2: currentArrow.y2,
            color: selectedColor,
            colorName: selectedColorName,
            width: strokeWidth
          }
        ];
      }
    }

    currentPath = null;
    currentArrow = null;
    rawPathPoints = [];
  }

  function eraseAtPoint(x, y) {
    const threshold = 18;
    drawings = drawings.filter(item => {
      if (item.type === 'arrow') {
        const d = distToSegment({ x, y }, { x: item.x1, y: item.y1 }, { x: item.x2, y: item.y2 });
        return d > threshold;
      }
      return true;
    });
  }

  function deleteDrawing(id) {
    if (activeTool === 'eraser') {
      captureSnapshot();
      drawings = drawings.filter(d => d.id !== id);
    }
  }

  function clearAllDrawings() {
    if (drawings.length === 0) return;
    if (confirm('Clear all drawings and arrows on the canvas?')) {
      captureSnapshot();
      drawings = [];
    }
  }

  function distToSegment(p, v, w) {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }

  // Hover Relational Matching
  function onCellMouseEnter(val) {
    if (val !== null && val !== undefined && String(val).trim() !== '') {
      hoveredValue = String(val);
    }
  }

  function onCellMouseLeave() {
    hoveredValue = null;
  }

  function isMatchingRelation(val) {
    if (!hoveredValue) return false;
    return String(val) === hoveredValue;
  }

  function isSearchHit(val) {
    if (!searchTerm || !searchTerm.trim()) return false;
    if (val === null || val === undefined) return false;
    return String(val).toLowerCase().includes(searchTerm.trim().toLowerCase());
  }

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  function selectColor(colorObj) {
    selectedColor = colorObj.hex;
    selectedColorName = colorObj.name;
  }

  onMount(() => {
    try {
      const savedState = localStorage.getItem(CANVAS_STATE_STORAGE_KEY);
      if (savedState) {
        const state = JSON.parse(savedState);
        if (state && typeof state === 'object') {
          if (Number.isFinite(state.zoomLevel)) zoomLevel = Math.min(2.0, Math.max(0.4, state.zoomLevel));
          if (Number.isFinite(state.panOffset?.x) && Number.isFinite(state.panOffset?.y)) panOffset = state.panOffset;
          if (typeof state.searchTerm === 'string') searchTerm = state.searchTerm;
          if (Array.isArray(state.pinnedTables)) pinnedTables = new Set(state.pinnedTables);
          if (Array.isArray(state.minimizedTables)) minimizedTables = new Set(state.minimizedTables);
          if (Array.isArray(state.hiddenTables)) hiddenTables = new Set(state.hiddenTables);
          if (Array.isArray(state.drawings)) drawings = state.drawings;
          if (state.cardPositions && typeof state.cardPositions === 'object') {
            cardPositions = Object.fromEntries(
              Object.entries(state.cardPositions)
                .filter(([, pos]) => Number.isFinite(pos?.x) && Number.isFinite(pos?.y))
                .map(([name, pos]) => [name, {
                  x: pos.x,
                  y: pos.y,
                  zIndex: Number.isFinite(pos.zIndex) ? pos.zIndex : 100
                }])
            );
            highestZIndex = Math.max(100, ...Object.values(cardPositions).map(pos => pos.zIndex));
          }
        }
      }
    } catch (error) {
      console.error('Failed to restore table canvas state', error);
    }
    canvasStateLoaded = true;
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="table-canvas-modal" class:visible={visible}>
  <div class="table-canvas-container">
    <!-- Top Control Bar -->
    <div class="canvas-toolbar">
      <div class="canvas-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="9" y1="21" x2="9" y2="9"></line>
        </svg>
        <span>Database Visual Board &amp; Table Canvas</span>
      </div>

      <!-- Drawing & Navigation Tools -->
      <div class="canvas-toolbox">
        <div class="tool-group">
          <button
            class="tool-btn"
            class:active={activeTool === 'select'}
            on:click={() => (activeTool = 'select')}
            title="Select & Move Tables (V)"
          >
            <span>👆</span>
            <small>Select</small>
          </button>
          <button
            class="tool-btn"
            class:active={activeTool === 'pan'}
            on:click={() => (activeTool = 'pan')}
            title="Hand / Pan Canvas (H)"
          >
            <span>✋</span>
            <small>Pan</small>
          </button>
          <button
            class="tool-btn"
            class:active={activeTool === 'marker'}
            on:click={() => (activeTool = 'marker')}
            title="Freehand Marker (M)"
          >
            <span>✏️</span>
            <small>Marker</small>
          </button>
          <button
            class="tool-btn"
            class:active={activeTool === 'arrow'}
            on:click={() => (activeTool = 'arrow')}
            title="Draw Arrow (A)"
          >
            <span>↗️</span>
            <small>Arrow</small>
          </button>
          <button
            class="tool-btn"
            class:active={activeTool === 'eraser'}
            on:click={() => (activeTool = 'eraser')}
            title="Eraser (E)"
          >
            <span>🧹</span>
            <small>Eraser</small>
          </button>
        </div>

        <!-- Undo / Redo Actions -->
        <div class="tool-group history-group">
          <button
            class="tool-btn"
            disabled={undoStack.length === 0}
            on:click={handleUndo}
            title="Undo (Ctrl+Z)"
          >
            <span style="font-size: 15px; font-weight: bold;">↶</span>
            <small>Undo</small>
          </button>
          <button
            class="tool-btn"
            disabled={redoStack.length === 0}
            on:click={handleRedo}
            title="Redo (Ctrl+Y)"
          >
            <span style="font-size: 15px; font-weight: bold;">↷</span>
            <small>Redo</small>
          </button>
        </div>

        <!-- Color & Width Options for Marker/Arrow -->
        {#if activeTool === 'marker' || activeTool === 'arrow'}
          <div class="color-picker-group">
            {#each COLOR_PALETTE as col}
              <button
                class="color-dot"
                style="background: {col.hex};"
                class:active={selectedColor === col.hex}
                on:click={() => selectColor(col)}
                title={col.name}
              ></button>
            {/each}

            <select bind:value={strokeWidth} class="stroke-select" title="Stroke thickness">
              <option value={2}>2px</option>
              <option value={3}>3px</option>
              <option value={5}>5px</option>
            </select>
          </div>
        {/if}

        {#if drawings.length > 0}
          <button class="canvas-btn-sm" on:click={clearAllDrawings} title="Clear all drawings">
            Clear ({drawings.length})
          </button>
        {/if}
      </div>

      <!-- Right Actions: Table Picker, Search, Zoom, Close -->
      <div class="canvas-actions">
        <!-- Tables Visible / Hidden Dropdown -->
        <div class="table-picker-container">
          <button
            class="canvas-btn table-picker-btn"
            class:has-hidden={hiddenTableNames.length > 0}
            on:click={() => (showTablePicker = !showTablePicker)}
            title="Manage tables visible on canvas"
          >
            <span>📋 Tables ({canvasTables.length}/{allAvailableTables.length})</span>
            {#if hiddenTableNames.length > 0}
              <span class="hidden-pill">+{hiddenTableNames.length} hidden</span>
            {/if}
            <span class="chevron">▾</span>
          </button>

          {#if showTablePicker}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="table-picker-dropdown">
              <div class="picker-header">
                <strong>Manage Table Cards</strong>
                {#if hiddenTableNames.length > 0}
                  <button class="picker-action-link" on:click={restoreAllTables}>Show All</button>
                {/if}
              </div>
              <div class="picker-list">
                {#each allAvailableTables as [tableName, table]}
                  {@const isHidden = hiddenTables.has(tableName)}
                  <div class="picker-item">
                    <span class="picker-table-name">
                      {capitalize(tableName)}
                      {#if table.isQueryResult}<small class="query-badge">Query</small>{/if}
                    </span>
                    {#if isHidden}
                      <button class="btn-restore-table" on:click={() => restoreTable(tableName)}>
                        + Add to Board
                      </button>
                    {:else}
                      <button class="btn-hide-table" on:click={() => removeTableFromCanvas(tableName, table.isQueryResult)}>
                        Hide ✕
                      </button>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <div class="canvas-search-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" bind:value={searchTerm} placeholder="Search data..." />
        </div>

        <div class="canvas-zoom-controls">
          <button class="canvas-btn icon-only" on:click={() => setZoom(zoomLevel - 0.15)} title="Zoom Out">-</button>
          <span>{Math.round(zoomLevel * 100)}%</span>
          <button class="canvas-btn icon-only" on:click={() => setZoom(zoomLevel + 0.15)} title="Zoom In">+</button>
          <button class="canvas-btn icon-only" on:click={resetView} title="Reset View">⟲</button>
        </div>

        <button class="canvas-btn canvas-btn-close" on:click={handleClose} title="Return to SQL Editor (Esc)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          <span>Close</span>
        </button>
      </div>
    </div>

    <!-- Main Expansive Canvas Viewport (Scrollable with Overflow) -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
      class="canvas-viewport" 
      class:tool-pan={activeTool === 'pan'}
      class:tool-marker={activeTool === 'marker'}
      class:tool-arrow={activeTool === 'arrow'}
      class:tool-eraser={activeTool === 'eraser'}
      bind:this={viewport}
      on:pointerdown={startPan}
      on:pointermove={onPanMove}
      on:pointerup={onPanEnd}
      on:pointercancel={onPanEnd}
    >
      <div 
        class="canvas-workspace" 
        bind:this={workspace}
        style="transform: translate({panOffset.x}px, {panOffset.y}px) scale({zoomLevel});"
      >
        <!-- Table Cards -->
        {#each canvasTables as [tableName, table]}
          {@const pos = cardPositions[tableName] || { x: 40, y: 40, zIndex: 100 }}
          {@const isMin = minimizedTables.has(tableName)}
          {@const isPin = pinnedTables.has(tableName)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div 
            class="draggable-table-card" 
            class:minimized={isMin}
            class:is-pinned={isPin}
            class:is-query-result={table.isQueryResult}
            class:is-dragging={activeDrag && activeDrag.tableName === tableName}
            style="left: {pos.x}px; top: {pos.y}px; z-index: {pos.zIndex};"
            on:pointerdown={() => bringToFront(tableName)}
          >
            <div 
              class="card-header"
              on:pointerdown={(e) => startCardDrag(e, tableName, e.currentTarget)}
              on:pointermove={onCardPointerMove}
              on:pointerup={onCardPointerEnd}
              on:pointercancel={onCardPointerEnd}
            >
              <div class="card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="3" y1="9" x2="21" y2="9"></line>
                  <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
                <span class="table-name-label">{capitalize(tableName)}</span>
                <span class="row-count-badge">{table.rows.length} rows</span>
                {#if table.isQueryResult}
                  <span class="query-result-card-badge">QUERY</span>
                {/if}
              </div>
              <div class="card-controls">
                <button 
                  class="card-ctrl-btn btn-compare-pin" 
                  class:active={isPin} 
                  on:click={() => togglePin(tableName)} 
                  title="Pin / Highlight Table"
                >
                  📌
                </button>
                <button 
                  class="card-ctrl-btn btn-minimize" 
                  on:click={() => toggleMinimize(tableName)} 
                  title="Minimize / Expand"
                >
                  {isMin ? '+' : '−'}
                </button>
                <button 
                  class="card-ctrl-btn btn-remove-card" 
                  on:click={() => removeTableFromCanvas(tableName, table.isQueryResult)} 
                  title="Remove / Hide table from window"
                >
                  ✕
                </button>
              </div>
            </div>

            {#if !isMin}
              <div class="card-body">
                <div class="table-schema-summary">
                  {#each table.columns as c}
                    <span class="schema-col-pill" class:is-pk={c.isPk}>
                      {c.isPk ? '🔑 ' : ''}{c.name.toLowerCase()} <small>[{c.type.toLowerCase()}]</small>
                    </span>
                  {/each}
                </div>
                <div class="table-data-wrapper">
                  <table class="card-data-table">
                    <thead>
                      <tr>
                        {#each table.columns as col}
                          <th>{col.name.toLowerCase()}</th>
                        {/each}
                      </tr>
                    </thead>
                    <tbody>
                      {#if table.rows.length === 0}
                        <tr>
                          <td colspan="{table.columns.length}" class="empty-table-msg">(No rows in table)</td>
                        </tr>
                      {:else}
                        {#each table.rows as row}
                          <tr>
                            {#each table.columns as col}
                              {@const cellVal = row[col.name]}
                              <td 
                                class:highlight-relation-match={isMatchingRelation(cellVal)}
                                class:search-hit={isSearchHit(cellVal)}
                                on:mouseenter={() => onCellMouseEnter(cellVal)}
                                on:mouseleave={onCellMouseLeave}
                              >
                                {#if cellVal === null || cellVal === undefined}
                                  <span class="null-val">(null)</span>
                                {:else}
                                  {cellVal}
                                {/if}
                              </td>
                            {/each}
                          </tr>
                        {/each}
                      {/if}
                    </tbody>
                  </table>
                </div>
              </div>
            {/if}
          </div>
        {/each}

        <!-- Interactive SVG Drawing Overlay (Marker, Arrows, Eraser) -->
        <svg
          class="drawing-svg-layer"
          class:interactive={activeTool === 'marker' || activeTool === 'arrow' || activeTool === 'eraser'}
          on:pointerdown={onDrawingPointerDown}
          on:pointermove={onDrawingPointerMove}
          on:pointerup={onDrawingPointerUp}
        >
          <defs>
            <marker id="arrowhead-red" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
              <polygon points="0 0, 9 3.5, 0 7" fill="#ef4444" />
            </marker>
            <marker id="arrowhead-blue" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
              <polygon points="0 0, 9 3.5, 0 7" fill="#3b82f6" />
            </marker>
            <marker id="arrowhead-green" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
              <polygon points="0 0, 9 3.5, 0 7" fill="#10b981" />
            </marker>
            <marker id="arrowhead-amber" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
              <polygon points="0 0, 9 3.5, 0 7" fill="#f59e0b" />
            </marker>
            <marker id="arrowhead-purple" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
              <polygon points="0 0, 9 3.5, 0 7" fill="#a855f7" />
            </marker>
          </defs>

          <!-- Render All Saved Drawings -->
          {#each drawings as item (item.id)}
            {#if item.type === 'path'}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <path
                d={item.d}
                stroke={item.color}
                stroke-width={item.width}
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="drawing-stroke"
                class:erasable={activeTool === 'eraser'}
                on:pointerdown={() => deleteDrawing(item.id)}
              />
            {:else if item.type === 'arrow'}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <line
                x1={item.x1}
                y1={item.y1}
                x2={item.x2}
                y2={item.y2}
                stroke={item.color}
                stroke-width={item.width}
                stroke-linecap="round"
                marker-end="url(#arrowhead-{item.colorName || 'red'})"
                class="drawing-arrow"
                class:erasable={activeTool === 'eraser'}
                on:pointerdown={() => deleteDrawing(item.id)}
              />
            {/if}
          {/each}

          <!-- In-progress Marker Stroke Preview -->
          {#if currentPath}
            <path
              d={currentPath.d}
              stroke={selectedColor}
              stroke-width={strokeWidth}
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
              opacity="0.9"
            />
          {/if}

          <!-- In-progress Arrow Preview -->
          {#if currentArrow}
            <line
              x1={currentArrow.x1}
              y1={currentArrow.y1}
              x2={currentArrow.x2}
              y2={currentArrow.y2}
              stroke={selectedColor}
              stroke-width={strokeWidth}
              stroke-linecap="round"
              marker-end="url(#arrowhead-{selectedColorName})"
              opacity="0.9"
            />
          {/if}
        </svg>
      </div>
    </div>

    <!-- Bottom Status / Navigation Footer -->
    <div class="canvas-footer-hint">
      <span>💡 <strong>Canvas Controls:</strong> <strong>Scroll / Drag</strong> to pan in all directions. Use <strong>✕ Remove</strong> on any card to clean up your board. Use <strong>✏️ Marker</strong> or <strong>↗️ Arrow</strong> to draw notes &amp; relationships!</span>
      <span class="active-tool-indicator">Tool: <strong>{activeTool.toUpperCase()}</strong></span>
    </div>
  </div>
</div>

<style>
  .canvas-toolbox {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg-surface);
    border: 1px solid var(--border-light);
    border-radius: 8px;
    padding: 3px 8px;
  }

  .tool-group {
    display: flex;
    gap: 4px;
  }

  .tool-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 3px 8px;
    cursor: pointer;
    color: var(--text-muted);
    font-size: 13px;
    transition: all 0.15s ease;
  }

  .tool-btn small {
    font-size: 9px;
    font-weight: 700;
    margin-top: 1px;
    text-transform: uppercase;
  }

  .tool-btn:hover {
    background: var(--bg-hover);
    color: var(--text-main);
  }

  .tool-btn.active {
    background: #2563eb;
    color: #ffffff;
    border-color: #3b82f6;
  }

  .tool-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    pointer-events: none;
  }

  .history-group {
    border-left: 1px solid var(--border-light);
    padding-left: 4px;
    margin-left: 2px;
  }

  .color-picker-group {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-left: 8px;
    border-left: 1px solid var(--border-light);
  }

  .color-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: transform 0.15s;
  }

  .color-dot:hover {
    transform: scale(1.15);
  }

  .color-dot.active {
    border-color: #ffffff;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
    transform: scale(1.2);
  }

  .stroke-select {
    background: var(--bg-surface);
    border: 1px solid var(--border-light);
    color: var(--text-main);
    border-radius: 4px;
    font-size: 11px;
    padding: 2px 4px;
  }

  .canvas-btn-sm {
    background: transparent;
    border: 1px solid var(--border-light);
    color: var(--text-muted);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 11px;
    cursor: pointer;
  }

  .canvas-btn-sm:hover {
    background: #ef4444;
    color: #ffffff;
    border-color: #dc2626;
  }

  /* Table Picker Dropdown */
  .table-picker-container {
    position: relative;
  }

  .table-picker-btn {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .hidden-pill {
    background: #f59e0b;
    color: #0f172a;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 10px;
  }

  .chevron {
    font-size: 10px;
    opacity: 0.7;
  }

  .table-picker-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    width: 260px;
    background: var(--bg-surface);
    border: 1px solid var(--border-light);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
    border-radius: 8px;
    z-index: 9999;
    padding: 8px;
  }

  .picker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 6px 8px 6px;
    border-bottom: 1px solid var(--border-light);
    font-size: 12px;
  }

  .picker-action-link {
    background: transparent;
    border: none;
    color: #3b82f6;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .picker-list {
    max-height: 240px;
    overflow-y: auto;
    padding: 6px 0;
  }

  .picker-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    border-radius: 6px;
    font-size: 12px;
  }

  .picker-item:hover {
    background: var(--bg-hover);
  }

  .picker-table-name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
  }

  .query-badge {
    background: #2563eb;
    color: #ffffff;
    font-size: 9px;
    padding: 1px 4px;
    border-radius: 3px;
  }

  .btn-restore-table {
    background: #10b981;
    color: #ffffff;
    border: none;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-hide-table {
    background: transparent;
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 11px;
    cursor: pointer;
  }

  .btn-hide-table:hover {
    background: #ef4444;
    color: #ffffff;
  }

  /* Card Header Remove Button */
  .btn-remove-card {
    font-size: 12px;
    color: var(--text-muted);
  }

  .btn-remove-card:hover {
    color: #ef4444 !important;
    background-color: rgba(239, 68, 68, 0.15) !important;
  }

  /* Viewport Cursors */
  .canvas-viewport.tool-pan {
    cursor: grab;
  }
  .canvas-viewport.tool-pan:active {
    cursor: grabbing;
  }
  .canvas-viewport.tool-marker {
    cursor: crosshair;
  }
  .canvas-viewport.tool-arrow {
    cursor: crosshair;
  }
  .canvas-viewport.tool-eraser {
    cursor: cell;
  }

  /* Drawing SVG Layer */
  .drawing-svg-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 999;
  }

  .drawing-svg-layer.interactive {
    pointer-events: all;
  }

  .drawing-stroke {
    pointer-events: stroke;
  }

  .drawing-arrow {
    pointer-events: stroke;
  }

  .drawing-stroke.erasable:hover,
  .drawing-arrow.erasable:hover {
    stroke: #ef4444 !important;
    opacity: 0.5;
    cursor: pointer;
  }

  .active-tool-indicator {
    font-size: 11px;
    color: #3b82f6;
  }
</style>
