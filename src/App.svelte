<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { comparisonTablesStore, oracleDb } from './lib/db-store.js';

  import Header from './components/Header.svelte';
  import SchemaSidebar from './components/SchemaSidebar.svelte';
  import SqlEditor from './components/SqlEditor.svelte';
  import OutputView from './components/OutputView.svelte';
  import AvailableTablesSidebar from './components/AvailableTablesSidebar.svelte';
  import TableCanvasModal from './components/TableCanvasModal.svelte';

  const DEFAULT_QUERY = `-- Demo Queries (Insert & Select)
SELECT name, course_id FROM students;
SELECT * FROM courses;`;
  const UI_STATE_STORAGE_KEY = 'ORACLE_STUDIO_UI_STATE';
  let theme = 'theme-light';
  let editorCode = DEFAULT_QUERY;
  let queryResults = [];
  let queryStatus = 'Ready';

  let isLeftCollapsed = false;
  let isRightCollapsed = false;
  let isCanvasOpen = false;
  let isOutputCollapsed = false;
  let leftSidebarWidth = 250;
  let rightSidebarWidth = 320;

  let editorComponent;
  let tableCanvasComponent;
  let mainWorkspaceEl;
  let appBodyEl;
  let editorHeight = null;
  let isResizing = false;
  let resizingSidebar = null;
  let uiStateLoaded = false;

  $: if (uiStateLoaded) {
    try {
      localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify({
        theme,
        editorCode,
        queryResults,
        queryStatus,
        isLeftCollapsed,
        isRightCollapsed,
        isCanvasOpen,
        isOutputCollapsed,
        leftSidebarWidth,
        rightSidebarWidth,
        editorHeight
      }));
    } catch (error) {
      console.error('Failed to save workspace state', error);
    }
  }

  function handleToggleTheme() {
    theme = theme === 'theme-light' ? 'theme-dark' : 'theme-light';
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(theme);
  }

  function handleResetDb() {
    if (confirm('Reset the database, workspace layout, query results, and Tables window to their defaults?')) {
      oracleDb.resetDatabase();
      comparisonTablesStore.set([]);
      editorCode = DEFAULT_QUERY;
      queryResults = [];
      queryStatus = 'Ready';
      isLeftCollapsed = false;
      isRightCollapsed = false;
      isCanvasOpen = false;
      isOutputCollapsed = false;
      leftSidebarWidth = 250;
      rightSidebarWidth = 320;
      editorHeight = null;
      theme = 'theme-light';
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(theme);
      tableCanvasComponent?.resetCanvasState();
      try {
        localStorage.removeItem('ORACLE_STUDIO_THEME');
        localStorage.removeItem('ORACLE_STUDIO_EDITOR_CODE');
      } catch (error) {
        console.error('Failed to clear legacy workspace state', error);
      }
    }
  }

  function handleAddComparisonTable(result) {
    const comparisonTables = get(comparisonTablesStore);
    const existingNames = new Set([
      ...Object.keys(oracleDb.getTables()),
      ...comparisonTables.map(table => table.name)
    ]);
    let number = comparisonTables.length + 1;
    let name = `QUERY_RESULT_${number}`;
    while (existingNames.has(name)) {
      number += 1;
      name = `QUERY_RESULT_${number}`;
    }

    comparisonTablesStore.update(tables => [...tables, {
      name,
      isQueryResult: true,
      columns: result.columns.map(column => ({
        name: column,
        type: 'QUERY RESULT',
        isPk: false,
        nullable: true
      })),
      rows: result.rows.map(row => ({ ...row }))
    }]);
    isCanvasOpen = true;
  }

  function runQueryScript(scriptText) {
    if (!scriptText || !scriptText.trim()) return;

    queryStatus = 'Executing...';

    setTimeout(() => {
      try {
        const results = oracleDb.executeScript(scriptText);
        queryResults = results;

        const hasError = results.some(r => r.type === 'ERROR');
        if (hasError) {
          queryStatus = 'Oracle Error';
        } else {
          const totalRows = results
            .filter(r => r.type === 'SELECT' || r.type === 'DESCRIBE')
            .reduce((sum, r) => sum + r.rows.length, 0);
          queryStatus = `Completed (${totalRows} rows)`;
        }
      } catch (err) {
        queryStatus = 'Error';
        queryResults = [{
          type: 'ERROR',
          command: scriptText,
          message: `ORA-00600: internal error code [${err.message || 'unknown'}]`
        }];
      }
    }, 10);
  }

  function handleInsertText(text) {
    if (editorComponent) {
      editorComponent.insertAtCursor(text);
    }
  }

  function handleCreateTableTemplate() {
    const template = `\nCREATE TABLE departments (
  dept_id NUMBER PRIMARY KEY,
  dept_name VARCHAR2(30) NOT NULL
);`;
    handleInsertText(template);
  }

  // Vertical Splitter Resizing with Pointer Capture & e.buttons safety
  function startSplitterResize(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    isResizing = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    document.body.classList.add('is-resizing');
  }

  function onSplitterMove(e) {
    if (!isResizing) return;
    if (e.buttons === 0) {
      stopSplitterResize();
      return;
    }
    if (mainWorkspaceEl) {
      const rect = mainWorkspaceEl.getBoundingClientRect();
      const newHeight = e.clientY - rect.top;
      if (newHeight > 80 && newHeight < rect.height - 80) {
        editorHeight = newHeight;
      }
    }
  }

  function onSplitterEnd(e) {
    if (isResizing) {
      if (e && e.pointerId) {
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      stopSplitterResize();
    }
  }

  function stopSplitterResize() {
    isResizing = false;
    document.body.classList.remove('is-resizing');
  }

  function clampSidebarWidths() {
    if (!appBodyEl) return;
    const rect = appBodyEl.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const minWidth = 180;
    const minWorkspaceWidth = 360;
    const available = rect.width - minWorkspaceWidth;
    if (available > 0) {
      if (leftSidebarWidth + rightSidebarWidth > available) {
        const excess = (leftSidebarWidth + rightSidebarWidth) - available;
        rightSidebarWidth = Math.max(minWidth, rightSidebarWidth - Math.ceil(excess / 2));
        leftSidebarWidth = Math.max(minWidth, available - rightSidebarWidth);
      }
    }
  }

  function startSidebarResize(event, side) {
    if (event.button !== 0) return;
    event.preventDefault();
    resizingSidebar = side;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) {}
    document.body.classList.add('is-sidebar-resizing');
  }

  function onSidebarResize(event) {
    if (!resizingSidebar || !appBodyEl || event.buttons === 0) return;
    const rect = appBodyEl.getBoundingClientRect();
    const minWidth = 180;
    const minWorkspaceWidth = 360;

    if (resizingSidebar === 'left') {
      const maxWidth = Math.max(minWidth, rect.width - rightSidebarWidth - minWorkspaceWidth);
      leftSidebarWidth = Math.min(maxWidth, Math.max(minWidth, event.clientX - rect.left));
    } else {
      const maxWidth = Math.max(minWidth, rect.width - leftSidebarWidth - minWorkspaceWidth);
      rightSidebarWidth = Math.min(maxWidth, Math.max(minWidth, rect.right - event.clientX));
    }
  }

  function stopSidebarResize(event) {
    if (!resizingSidebar) return;
    try {
      if (event?.currentTarget?.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch (_) {}
    resizingSidebar = null;
    document.body.classList.remove('is-sidebar-resizing');
  }

  onMount(() => {
    let restoredWorkspace = false;
    let hasLegacyEditorCode = false;
    try {
      const savedState = localStorage.getItem(UI_STATE_STORAGE_KEY);
      if (savedState) {
        const state = JSON.parse(savedState);
        if (state && typeof state === 'object') {
          restoredWorkspace = true;
          if (state.theme === 'theme-dark' || state.theme === 'theme-light') theme = state.theme;
          if (typeof state.editorCode === 'string') editorCode = state.editorCode;
          if (Array.isArray(state.queryResults)) queryResults = state.queryResults;
          if (typeof state.queryStatus === 'string') queryStatus = state.queryStatus === 'Executing...' ? 'Ready' : state.queryStatus;
          if (typeof state.isLeftCollapsed === 'boolean') isLeftCollapsed = state.isLeftCollapsed;
          if (typeof state.isRightCollapsed === 'boolean') isRightCollapsed = state.isRightCollapsed;
          if (typeof state.isCanvasOpen === 'boolean') isCanvasOpen = state.isCanvasOpen;
          if (typeof state.isOutputCollapsed === 'boolean') {
            isOutputCollapsed = state.isOutputCollapsed;
          } else if (typeof state.isEditorFullscreen === 'boolean') {
            isOutputCollapsed = state.isEditorFullscreen;
          }
          if (Number.isFinite(state.leftSidebarWidth) && state.leftSidebarWidth >= 180) leftSidebarWidth = state.leftSidebarWidth;
          if (Number.isFinite(state.rightSidebarWidth) && state.rightSidebarWidth >= 180) rightSidebarWidth = state.rightSidebarWidth;
          if (state.editorHeight === null || (Number.isFinite(state.editorHeight) && state.editorHeight > 0)) editorHeight = state.editorHeight;
        }
      } else {
        const savedTheme = localStorage.getItem('ORACLE_STUDIO_THEME');
        if (savedTheme === 'theme-dark' || savedTheme === 'theme-light') theme = savedTheme;
        const savedEditorCode = localStorage.getItem('ORACLE_STUDIO_EDITOR_CODE');
        hasLegacyEditorCode = savedEditorCode !== null;
        if (savedEditorCode !== null) editorCode = savedEditorCode;
      }
    } catch (error) {
      console.error('Failed to restore workspace state', error);
    }

    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(theme);

    uiStateLoaded = true;
    if (!restoredWorkspace && !hasLegacyEditorCode) {
      runQueryScript(editorCode);
    }

    clampSidebarWidths();
    window.addEventListener('resize', clampSidebarWidths);
    window.addEventListener('mouseup', stopSplitterResize);
    window.addEventListener('pointerup', stopSplitterResize);
    window.addEventListener('blur', stopSplitterResize);
    window.addEventListener('pointerup', stopSidebarResize);
    window.addEventListener('blur', stopSidebarResize);

    return () => {
      window.removeEventListener('resize', clampSidebarWidths);
      window.removeEventListener('mouseup', stopSplitterResize);
      window.removeEventListener('pointerup', stopSplitterResize);
      window.removeEventListener('blur', stopSplitterResize);
      window.removeEventListener('pointerup', stopSidebarResize);
      window.removeEventListener('blur', stopSidebarResize);
    };
  });
</script>

<div class="app-container {theme}">
  <Header 
    {theme}
    onOpenCanvas={() => isCanvasOpen = true}
    onResetDb={handleResetDb}
    onToggleTheme={handleToggleTheme}
  />

  <main class="app-body" bind:this={appBodyEl}>
    <SchemaSidebar 
      collapsed={isLeftCollapsed}
      width={leftSidebarWidth}
      onToggleCollapse={() => isLeftCollapsed = !isLeftCollapsed}
      onInsertText={handleInsertText}
      onCreateTableTemplate={handleCreateTableTemplate}
    />

    {#if !isLeftCollapsed}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="sidebar-splitter"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize schema sidebar"
        on:pointerdown={(event) => startSidebarResize(event, 'left')}
        on:pointermove={onSidebarResize}
        on:pointerup={stopSidebarResize}
        on:pointercancel={stopSidebarResize}
      ></div>
    {/if}

    <section class="main-workspace" bind:this={mainWorkspaceEl}>
      <div
        class="editor-panel"
        style={isOutputCollapsed ? 'flex: 1; min-height: 0;' : editorHeight ? `height: ${editorHeight}px; flex: none;` : ''}
      >
        <SqlEditor 
          bind:this={editorComponent}
          bind:code={editorCode}
          onRun={runQueryScript}
          outputCollapsed={isOutputCollapsed}
          onToggleOutput={() => isOutputCollapsed = !isOutputCollapsed}
          {theme}
          {isLeftCollapsed}
          onUncollapseLeft={() => isLeftCollapsed = false}
        />
      </div>

      {#if !isOutputCollapsed}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
          class="workspace-splitter"
          on:pointerdown={startSplitterResize}
          on:pointermove={onSplitterMove}
          on:pointerup={onSplitterEnd}
          on:pointercancel={onSplitterEnd}
        ></div>

        <OutputView 
          results={queryResults}
          status={queryStatus}
          onAddToTables={handleAddComparisonTable}
          onClear={() => { queryResults = []; queryStatus = 'Ready'; }}
        />
      {/if}
    </section>

    {#if !isRightCollapsed}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="sidebar-splitter"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize available tables sidebar"
        on:pointerdown={(event) => startSidebarResize(event, 'right')}
        on:pointermove={onSidebarResize}
        on:pointerup={stopSidebarResize}
        on:pointercancel={stopSidebarResize}
      ></div>
    {/if}

    <AvailableTablesSidebar
      collapsed={isRightCollapsed}
      width={rightSidebarWidth}
      onToggleCollapse={() => isRightCollapsed = !isRightCollapsed}
    />
  </main>

  <TableCanvasModal
    bind:this={tableCanvasComponent}
    visible={isCanvasOpen}
    onClose={() => isCanvasOpen = false}
  />

</div>
