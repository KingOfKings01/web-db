/**
 * Interactive Full-Window Draggable Table Canvas & Visual Compare Board
 * Allows students to drag tables freely, place them side-by-side to compare,
 * inspect relationships, search across tables, and auto-tile.
 */

class TableCanvasBoard {
  constructor(containerElement, database) {
    this.container = containerElement;
    this.db = database;
    this.tableCards = new Map(); // tableName -> { element, x, y, width, height, minimized }
    this.activeDrag = null;
    this.highestZIndex = 100;
    this.zoomLevel = 1.0;
    this.panOffset = { x: 0, y: 0 };
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };

    this.initDOM();
    this.bindEvents();
    this.renderTables();

    // Listen to database changes
    this.db.onChange(() => {
      this.refreshData();
    });
  }

  initDOM() {
    this.container.classList.add('table-canvas-container');
    this.container.innerHTML = `
      <div class="canvas-toolbar">
        <div class="canvas-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="9" y1="21" x2="9" y2="9"></line>
          </svg>
          <span>Database Visual Canvas &amp; Table Compare</span>
        </div>
        <div class="canvas-actions">
          <div class="canvas-search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" id="canvas-search-input" placeholder="Search across all tables..." />
          </div>
          <div class="canvas-zoom-controls">
            <button class="canvas-btn icon-only" id="canvas-zoom-out" title="Zoom Out">-</button>
            <span id="canvas-zoom-val">100%</span>
            <button class="canvas-btn icon-only" id="canvas-zoom-in" title="Zoom In">+</button>
            <button class="canvas-btn icon-only" id="canvas-zoom-reset" title="Reset View">⟲</button>
          </div>
          <button class="canvas-btn canvas-btn-close" id="canvas-btn-close" title="Return to SQL Editor">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <span>Close Full Window</span>
          </button>
        </div>
      </div>
      <div class="canvas-viewport" id="canvas-viewport">
        <div class="canvas-workspace" id="canvas-workspace">
          <!-- Draggable Table Cards dynamically inserted here -->
        </div>
      </div>
      <div class="canvas-footer-hint">
        💡 <strong>Tip:</strong> Click &amp; drag the header of any table to position anywhere. Place tables next to each other to compare columns or foreign keys! Hovering values highlights matching IDs.
      </div>
    `;

    this.viewport = this.container.querySelector('#canvas-viewport');
    this.workspace = this.container.querySelector('#canvas-workspace');
    this.zoomValSpan = this.container.querySelector('#canvas-zoom-val');
    this.searchInput = this.container.querySelector('#canvas-search-input');
  }

  bindEvents() {
    // Toolbar buttons
    this.container.querySelector('#canvas-btn-close').addEventListener('click', () => {
      this.hide();
    });

    this.container.querySelector('#canvas-zoom-in').addEventListener('click', () => {
      this.setZoom(this.zoomLevel + 0.15);
    });

    this.container.querySelector('#canvas-zoom-out').addEventListener('click', () => {
      this.setZoom(this.zoomLevel - 0.15);
    });

    this.container.querySelector('#canvas-zoom-reset').addEventListener('click', () => {
      this.resetView();
    });

    // Cross-table search highlight
    this.searchInput.addEventListener('input', (e) => {
      this.filterSearch(e.target.value.trim().toLowerCase());
    });

    // Keyboard Escape key to exit or cancel drag
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.stopDrag();
        this.stopPanning();
        if (this.container.classList.contains('visible')) {
          this.hide();
        }
      }
    });

    // Panning canvas via background drag using Pointer Events & Pointer Capture
    this.viewport.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target === this.viewport || e.target === this.workspace) {
        e.preventDefault();
        this.isPanning = true;
        this.panPointerId = e.pointerId;
        this.panStart = { x: e.clientX - this.panOffset.x, y: e.clientY - this.panOffset.y };
        this.viewport.style.cursor = 'grabbing';
        try { this.viewport.setPointerCapture(e.pointerId); } catch (_) {}
      }
    });

    this.viewport.addEventListener('pointermove', (e) => {
      if (!this.isPanning) return;
      if (e.buttons === 0) {
        this.stopPanning();
        return;
      }
      this.panOffset.x = e.clientX - this.panStart.x;
      this.panOffset.y = e.clientY - this.panStart.y;
      this.updateWorkspaceTransform();
    });

    const stopPan = (e) => {
      if (this.isPanning && (!e || !e.pointerId || e.pointerId === this.panPointerId)) {
        if (this.panPointerId) {
          try { this.viewport.releasePointerCapture(this.panPointerId); } catch (_) {}
          this.panPointerId = null;
        }
        this.stopPanning();
      }
    };

    this.viewport.addEventListener('pointerup', stopPan);
    this.viewport.addEventListener('pointercancel', stopPan);

    // Global fail-safes to prevent getting stuck in drag or pan mode
    window.addEventListener('mouseup', () => {
      this.stopDrag();
      this.stopPanning();
    });

    window.addEventListener('pointerup', () => {
      this.stopDrag();
      this.stopPanning();
    });

    window.addEventListener('blur', () => {
      this.stopDrag();
      this.stopPanning();
    });
  }

  stopPanning() {
    this.isPanning = false;
    this.viewport.style.cursor = 'default';
  }

  stopDrag() {
    if (this.activeDrag) {
      if (this.activeDrag.header && this.activeDrag.pointerId) {
        try { this.activeDrag.header.releasePointerCapture(this.activeDrag.pointerId); } catch (_) {}
      }
      this.activeDrag.element.classList.remove('is-dragging');
      this.activeDrag = null;
    }
    document.body.classList.remove('is-canvas-dragging');
  }

  show() {
    this.container.classList.add('visible');
    this.refreshData();
    // Default arrangement if first time
    if (this.tableCards.size <= 2) {
      this.arrangeSideBySide();
    }
  }

  hide() {
    this.stopDrag();
    this.stopPanning();
    this.container.classList.remove('visible');
  }

  setZoom(lvl) {
    this.zoomLevel = Math.min(1.8, Math.max(0.5, lvl));
    this.zoomValSpan.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    this.updateWorkspaceTransform();
  }

  resetView() {
    this.zoomLevel = 1.0;
    this.panOffset = { x: 0, y: 0 };
    this.zoomValSpan.textContent = '100%';
    this.updateWorkspaceTransform();
  }

  updateWorkspaceTransform() {
    this.workspace.style.transform = `translate(${this.panOffset.x}px, ${this.panOffset.y}px) scale(${this.zoomLevel})`;
  }

  renderTables() {
    this.workspace.innerHTML = '';
    this.tableCards.clear();

    const tables = this.db.getTables();
    const tableNames = Object.keys(tables).filter(t => t !== 'DUAL');

    let initialX = 40;
    let initialY = 40;

    tableNames.forEach((name, idx) => {
      const table = tables[name];
      const card = this.createTableCard(table, initialX, initialY);
      this.workspace.appendChild(card.element);
      this.tableCards.set(name, card);

      initialX += 450;
      if (initialX > 950) {
        initialX = 40;
        initialY += 380;
      }
    });
  }

  refreshData() {
    const tables = this.db.getTables();
    const tableNames = Object.keys(tables).filter(t => t !== 'DUAL');

    // Remove cards for tables that no longer exist
    for (const [name, cardMeta] of this.tableCards.entries()) {
      if (!tables[name]) {
        cardMeta.element.remove();
        this.tableCards.delete(name);
      }
    }

    // Add or update cards
    tableNames.forEach((name, idx) => {
      const table = tables[name];
      if (this.tableCards.has(name)) {
        this.updateCardContent(this.tableCards.get(name), table);
      } else {
        const x = 40 + (idx * 450) % 900;
        const y = 40 + Math.floor((idx * 450) / 900) * 380;
        const card = this.createTableCard(table, x, y);
        this.workspace.appendChild(card.element);
        this.tableCards.set(name, card);
      }
    });
  }

  createTableCard(table, x, y) {
    const card = document.createElement('div');
    card.className = 'draggable-table-card';
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
    card.style.zIndex = ++this.highestZIndex;

    const cardMeta = {
      name: table.name,
      element: card,
      x: x,
      y: y,
      minimized: false
    };

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="9" y1="21" x2="9" y2="9"></line>
          </svg>
          <span class="table-name-label">${table.name}</span>
          <span class="row-count-badge">${table.rows.length} rows</span>
        </div>
        <div class="card-controls">
          <button class="card-ctrl-btn btn-compare-pin" title="Pin / Highlight Table">📌</button>
          <button class="card-ctrl-btn btn-minimize" title="Minimize / Expand">−</button>
        </div>
      </div>
      <div class="card-body">
        <div class="table-schema-summary">
          ${table.columns.map(c => `
            <span class="schema-col-pill ${c.isPk ? 'is-pk' : ''}">
              ${c.isPk ? '🔑 ' : ''}${c.name.toLowerCase()} <small>[${c.type.toLowerCase()}]</small>
            </span>
          `).join('')}
        </div>
        <div class="table-data-wrapper">
          <table class="card-data-table">
            <thead>
              <tr>
                ${table.columns.map(c => `<th>${c.name.toLowerCase()}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${this.generateRowsHTML(table)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Make Card Draggable with Pointer Events & Pointer Capture
    const header = card.querySelector('.card-header');
    header.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.card-controls')) return;
      e.preventDefault();

      this.bringToFront(card);
      try { header.setPointerCapture(e.pointerId); } catch (_) {}

      this.activeDrag = {
        header: header,
        pointerId: e.pointerId,
        element: card,
        cardMeta: cardMeta,
        startX: e.clientX,
        startY: e.clientY,
        initialX: cardMeta.x,
        initialY: cardMeta.y
      };
      card.classList.add('is-dragging');
      document.body.classList.add('is-canvas-dragging');
    });

    header.addEventListener('pointermove', (e) => {
      if (!this.activeDrag || this.activeDrag.pointerId !== e.pointerId) return;
      if (e.buttons === 0) {
        this.stopDrag();
        return;
      }
      const dx = (e.clientX - this.activeDrag.startX) / this.zoomLevel;
      const dy = (e.clientY - this.activeDrag.startY) / this.zoomLevel;

      const newX = Math.max(10, this.activeDrag.initialX + dx);
      const newY = Math.max(10, this.activeDrag.initialY + dy);

      this.activeDrag.cardMeta.x = newX;
      this.activeDrag.cardMeta.y = newY;

      this.activeDrag.element.style.left = `${newX}px`;
      this.activeDrag.element.style.top = `${newY}px`;
    });

    const stopCardDrag = (e) => {
      if (this.activeDrag && (!e || !e.pointerId || this.activeDrag.pointerId === e.pointerId)) {
        this.stopDrag();
      }
    };

    header.addEventListener('pointerup', stopCardDrag);
    header.addEventListener('pointercancel', stopCardDrag);

    // Bring to front on click anywhere on card
    card.addEventListener('pointerdown', () => {
      this.bringToFront(card);
    });

    // Minimize toggle
    const minBtn = card.querySelector('.btn-minimize');
    minBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cardMeta.minimized = !cardMeta.minimized;
      card.classList.toggle('minimized', cardMeta.minimized);
      minBtn.textContent = cardMeta.minimized ? '+' : '−';
    });

    // Pin toggle
    const pinBtn = card.querySelector('.btn-compare-pin');
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      card.classList.toggle('is-pinned');
      pinBtn.classList.toggle('active');
    });

    // Relational Hover Matching
    this.bindValueHovering(card);

    return cardMeta;
  }

  updateCardContent(cardMeta, table) {
    const card = cardMeta.element;
    card.querySelector('.table-name-label').textContent = table.name;
    card.querySelector('.row-count-badge').textContent = `${table.rows.length} rows`;

    const schemaSummary = card.querySelector('.table-schema-summary');
    schemaSummary.innerHTML = table.columns.map(c => `
      <span class="schema-col-pill ${c.isPk ? 'is-pk' : ''}">
        ${c.isPk ? '🔑 ' : ''}${c.name.toLowerCase()} <small>[${c.type.toLowerCase()}]</small>
      </span>
    `).join('');

    const theadTr = card.querySelector('.card-data-table thead tr');
    theadTr.innerHTML = `
      ${table.columns.map(c => `<th>${c.name.toLowerCase()}</th>`).join('')}
    `;

    const tbody = card.querySelector('.card-data-table tbody');
    tbody.innerHTML = this.generateRowsHTML(table);

    this.bindValueHovering(card);
  }

  generateRowsHTML(table) {
    if (table.rows.length === 0) {
      return `<tr><td colspan="${table.columns.length}" class="empty-table-msg">(No rows in table)</td></tr>`;
    }

    return table.rows.map(row => `
      <tr>
        ${table.columns.map(col => {
          const val = row[col.name];
          const display = (val === null || val === undefined) ? '<span class="null-val">(null)</span>' : String(val);
          const rawVal = (val === null || val === undefined) ? '' : String(val);
          return `<td data-col="${col.name}" data-val="${rawVal}">${display}</td>`;
        }).join('')}
      </tr>
    `).join('');
  }

  bindValueHovering(card) {
    const cells = card.querySelectorAll('td[data-val]');
    cells.forEach(cell => {
      cell.addEventListener('mouseenter', () => {
        const val = cell.getAttribute('data-val');
        if (!val) return;
        this.highlightMatchingValues(val);
      });
      cell.addEventListener('mouseleave', () => {
        this.clearMatchingHighlights();
      });
    });
  }

  highlightMatchingValues(val) {
    this.clearMatchingHighlights();
    const matches = this.workspace.querySelectorAll(`td[data-val="${val}"]`);
    if (matches.length > 1) {
      matches.forEach(m => m.classList.add('highlight-relation-match'));
    }
  }

  clearMatchingHighlights() {
    this.workspace.querySelectorAll('.highlight-relation-match').forEach(m => {
      m.classList.remove('highlight-relation-match');
    });
  }

  bringToFront(cardElement) {
    cardElement.style.zIndex = ++this.highestZIndex;
  }

  arrangeSideBySide() {
    const cards = Array.from(this.tableCards.values());
    if (cards.length === 0) return;

    this.resetView();
    const cardWidth = 460;
    const gap = 30;
    let currentX = 40;

    cards.forEach(card => {
      card.x = currentX;
      card.y = 40;
      card.element.style.transition = 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
      card.element.style.left = `${card.x}px`;
      card.element.style.top = `${card.y}px`;
      currentX += cardWidth + gap;

      setTimeout(() => {
        card.element.style.transition = '';
      }, 350);
    });
  }

  arrangeGrid() {
    const cards = Array.from(this.tableCards.values());
    if (cards.length === 0) return;

    this.resetView();
    const cols = 2;
    const cardWidth = 460;
    const cardHeight = 360;
    const gap = 30;

    cards.forEach((card, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);

      card.x = 40 + col * (cardWidth + gap);
      card.y = 40 + row * (cardHeight + gap);

      card.element.style.transition = 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
      card.element.style.left = `${card.x}px`;
      card.element.style.top = `${card.y}px`;

      setTimeout(() => {
        card.element.style.transition = '';
      }, 350);
    });
  }

  filterSearch(term) {
    const cards = Array.from(this.tableCards.values());
    cards.forEach(cardMeta => {
      const card = cardMeta.element;
      const cells = card.querySelectorAll('td[data-val]');
      let cardHasMatch = false;

      cells.forEach(cell => {
        const val = cell.getAttribute('data-val').toLowerCase();
        if (term && val.includes(term)) {
          cell.classList.add('search-hit');
          cardHasMatch = true;
        } else {
          cell.classList.remove('search-hit');
        }
      });

      if (term) {
        card.classList.toggle('has-search-hit', cardHasMatch);
        card.classList.toggle('faded-search', !cardHasMatch);
      } else {
        card.classList.remove('has-search-hit');
        card.classList.remove('faded-search');
      }
    });
  }
}

if (typeof window !== 'undefined') {
  window.TableCanvasBoard = TableCanvasBoard;
}
