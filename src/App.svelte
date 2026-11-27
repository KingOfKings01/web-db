<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { comparisonTablesStore, oracleDb, activeDatabaseStore, databasesStore } from './lib/db-store.js';

  import Header from './components/Header.svelte';
  import ConnectionsSidebar from './components/ConnectionsSidebar.svelte';
  import SqlEditor from './components/SqlEditor.svelte';
  import OutputView from './components/OutputView.svelte';
  import AvailableTablesSidebar from './components/AvailableTablesSidebar.svelte';
  import TableCanvasModal from './components/TableCanvasModal.svelte';
  import MobileKeyboardStudio from './components/MobileKeyboardStudio.svelte';
  import NewConnectionModal from './components/NewConnectionModal.svelte';
  import ExportModal from './components/ExportModal.svelte';
  import ImportModal from './components/ImportModal.svelte';

  const DEFAULT_QUERY = `-- Demo Queries (Insert & Select)
SELECT name, course_id FROM students;
SELECT * FROM courses;`;
  const UI_STATE_STORAGE_KEY = 'ORACLE_STUDIO_UI_STATE';
  const SCRIPTS_STORAGE_KEY = 'ORACLE_STUDIO_SCRIPTS_BY_CONN_V1';
  const HISTORY_STORAGE_KEY = 'ORACLE_STUDIO_HISTORY_BY_CONN_V1';
  const RESULTS_STORAGE_KEY = 'ORACLE_STUDIO_RESULTS_BY_CONN_V1';

  let currentActiveDb = 'SQL_CLASS';
  let scriptsByConnection = {
    'SQL_CLASS': DEFAULT_QUERY,
    'ORACLE26': `-- ORACLE26 Worksheet\nSELECT sysdate FROM dual;\n`
  };
  let historyByConnection = {
    'SQL_CLASS': [],
    'ORACLE26': []
  };
  let resultsByConnection = {};
  let statusByConnection = {};

  let theme = 'theme-light';
  let editorCode = DEFAULT_QUERY;
  let queryResults = [];
  let queryStatus = 'Ready';

  let isLeftCollapsed = false;
  let isRightCollapsed = false;
  let isCanvasOpen = false;
  let isNewConnectionModalOpen = false;
  let isExportModalOpen = false;
  let exportScope = 'database';
  let exportTableName = '';
  let exportDbKey = '';
  let isImportModalOpen = false;
  let importTargetDbKey = '';
  let isOutputCollapsed = false;
  let leftSidebarWidth = 260;
  let rightSidebarWidth = 320;

  const VIEW_MODE_STORAGE_KEY = 'ORACLE_STUDIO_VIEW_MODE_V1';
  let currentViewMode = 'desktop'; // 'desktop' | 'vertical' | 'landscape'
  $: activeMobile = currentViewMode === 'vertical' || currentViewMode === 'landscape';

  function handleSwitchView(mode) {
    if (mode === 'vertical' || mode === 'landscape' || mode === 'desktop') {
      currentViewMode = mode;
      try {
        localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
      } catch (_) {}

      // Default to fullscreen when switching into mobile mode
      if (mode === 'vertical' || mode === 'landscape') {
        try {
          const docEl = document.documentElement;
          if (!document.fullscreenElement) {
            if (docEl.requestFullscreen) {
              docEl.requestFullscreen().catch(() => {});
            } else if (docEl.webkitRequestFullscreen) {
              docEl.webkitRequestFullscreen();
            }
          }
        } catch (_) {}
      }
    }
  }

  function handleToggleMobileView(mode) {
    if (mode && typeof mode === 'string') {
      handleSwitchView(mode);
    } else {
      handleSwitchView(activeMobile ? 'desktop' : 'vertical');
    }
  }

  function handleExitMobile() {
    handleSwitchView('desktop');
  }

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

  function saveConnectionState() {
    try {
      localStorage.setItem(SCRIPTS_STORAGE_KEY, JSON.stringify(scriptsByConnection));
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyByConnection));
      localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(resultsByConnection));
    } catch (e) {
      console.error('Failed to save connection state', e);
    }
  }

  // Reactive connection switch when active database changes
  $: if (uiStateLoaded && $activeDatabaseStore) {
    const targetDb = $activeDatabaseStore.toUpperCase();
    if (targetDb !== currentActiveDb) {
      // 1. Save state for outgoing connection
      const outgoingCode = editorComponent ? editorComponent.getCode() : editorCode;
      scriptsByConnection[currentActiveDb] = outgoingCode;
      resultsByConnection[currentActiveDb] = queryResults;
      statusByConnection[currentActiveDb] = queryStatus;

      // 2. Switch current connection key
      currentActiveDb = targetDb;

      // 3. Initialize target state if missing
      if (scriptsByConnection[targetDb] === undefined) {
        scriptsByConnection[targetDb] = targetDb === 'SQL_CLASS' 
          ? DEFAULT_QUERY 
          : `-- ${targetDb} Worksheet\nSELECT sysdate FROM dual;\n`;
      }
      if (!historyByConnection[targetDb]) {
        historyByConnection[targetDb] = [];
      }
      if (!resultsByConnection[targetDb]) {
        resultsByConnection[targetDb] = [];
      }
      if (!statusByConnection[targetDb]) {
        statusByConnection[targetDb] = 'Ready';
      }

      // 4. Load incoming connection's script & output
      editorCode = scriptsByConnection[targetDb];
      if (editorComponent) {
        editorComponent.setCode(editorCode);
      }
      queryResults = resultsByConnection[targetDb];
      queryStatus = statusByConnection[targetDb];

      saveConnectionState();
    }
  }

  // Keep active connection's script synchronized as user types
  $: if (uiStateLoaded && currentActiveDb && editorCode !== undefined) {
    scriptsByConnection[currentActiveDb] = editorCode;
    try {
      localStorage.setItem(SCRIPTS_STORAGE_KEY, JSON.stringify(scriptsByConnection));
    } catch (_) {}
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
      currentActiveDb = 'SQL_CLASS';
      scriptsByConnection = {
        'SQL_CLASS': DEFAULT_QUERY,
        'ORACLE26': `-- ORACLE26 Worksheet\nSELECT sysdate FROM dual;\n`
      };
      historyByConnection = {
        'SQL_CLASS': [],
        'ORACLE26': []
      };
      resultsByConnection = {};
      statusByConnection = {};
      editorCode = DEFAULT_QUERY;
      if (editorComponent) {
        editorComponent.setCode(editorCode);
      }
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
        localStorage.removeItem(SCRIPTS_STORAGE_KEY);
        localStorage.removeItem(HISTORY_STORAGE_KEY);
        localStorage.removeItem(RESULTS_STORAGE_KEY);
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
    const activeKey = (oracleDb.getActiveDatabase() || currentActiveDb || 'SQL_CLASS').toUpperCase();

    setTimeout(() => {
      try {
        const results = oracleDb.executeScript(scriptText);
        queryResults = results;

        const hasError = results.some(r => r.type === 'ERROR');
        let statusText = 'Ready';
        if (hasError) {
          statusText = 'Oracle Error';
        } else {
          const totalRows = results
            .filter(r => r.type === 'SELECT' || r.type === 'DESCRIBE')
            .reduce((sum, r) => sum + r.rows.length, 0);
          statusText = `Completed (${totalRows} rows)`;
        }
        queryStatus = statusText;

        // Record history item for this specific connection
        const historyItem = {
          id: Date.now() + Math.random().toString(36).slice(2, 6),
          sql: scriptText.trim(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          date: new Date().toLocaleDateString(),
          hasError,
          status: statusText,
          commandsCount: results.length
        };

        const existing = (historyByConnection[activeKey] || []).filter(h => h.sql !== scriptText.trim());
        historyByConnection[activeKey] = [historyItem, ...existing].slice(0, 50);
        historyByConnection = { ...historyByConnection };

        resultsByConnection[activeKey] = results;
        statusByConnection[activeKey] = statusText;
        scriptsByConnection[activeKey] = scriptText;
        saveConnectionState();
      } catch (err) {
        queryStatus = 'Error';
        queryResults = [{
          type: 'ERROR',
          command: scriptText,
          message: `ORA-00600: internal error code [${err.message || 'unknown'}]`
        }];
        resultsByConnection[activeKey] = queryResults;
        statusByConnection[activeKey] = queryStatus;
        saveConnectionState();
      }
    }, 10);
  }

  function handleSelectConnection(dbName) {
    try {
      oracleDb.connectDatabase(dbName);
    } catch (err) {
      alert(err.message || String(err));
    }
  }

  function handleClearHistory() {
    historyByConnection[currentActiveDb] = [];
    historyByConnection = { ...historyByConnection };
    saveConnectionState();
  }

  function handleLoadHistoryItem(sql) {
    handleLoadIntoEditor(sql);
    scriptsByConnection[currentActiveDb] = sql;
    saveConnectionState();
  }

  function handleClearOutput() {
    queryResults = [];
    queryStatus = 'Ready';
    resultsByConnection[currentActiveDb] = [];
    statusByConnection[currentActiveDb] = 'Ready';
    saveConnectionState();
  }

  function handleInsertText(text) {
    if (editorComponent) {
      editorComponent.insertAtCursor(text);
    }
  }

  function handleOpenExport(scope = 'database', tableName = '', dbKey = '') {
    exportScope = scope;
    exportTableName = tableName;
    exportDbKey = dbKey || oracleDb.getActiveDatabase();
    isExportModalOpen = true;
  }

  function handleOpenImport(dbKey = '') {
    importTargetDbKey = dbKey || oracleDb.getActiveDatabase();
    isImportModalOpen = true;
  }

  function handleLoadIntoEditor(sql) {
    editorCode = sql;
    if (editorComponent) {
      editorComponent.setCode(sql);
    }
  }

  function handleExecuteImportedScript(sql, dbName) {
    if (dbName && dbName.toUpperCase() !== oracleDb.getActiveDatabase().toUpperCase()) {
      oracleDb.connectDatabase(dbName);
    }
    handleLoadIntoEditor(sql);
    runQueryScript(sql);
  }

  function handleCreateTableTemplate() {
    const template = `\nCREATE TABLE departments (
  dept_id NUMBER PRIMARY KEY,
  dept_name VARCHAR2(30) NOT NULL
);`;
    handleInsertText(template);
  }

  function handleCreateAndConnect(connInfo) {
    try {
      const { name, username, password } = connInfo;
      const databases = oracleDb.getDatabases();
      const key = name.toUpperCase().trim();
      if (!databases[key]) {
        oracleDb.createDatabase(name, username, password);
      }
      const res = oracleDb.connectDatabase(name, username, password);
      queryStatus = res.message || `Connected to ${name}.`;
      queryResults = [{
        type: 'DDL',
        command: `CONNECT ${username}@${name}`,
        message: res.message || `Connected to ${name}.`
      }];
      isNewConnectionModalOpen = false;
    } catch (err) {
      alert(err.message || String(err));
    }
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
      const savedScripts = localStorage.getItem(SCRIPTS_STORAGE_KEY);
      if (savedScripts) {
        scriptsByConnection = JSON.parse(savedScripts);
      }
      const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (savedHistory) {
        historyByConnection = JSON.parse(savedHistory);
      }
      const savedResults = localStorage.getItem(RESULTS_STORAGE_KEY);
      if (savedResults) {
        resultsByConnection = JSON.parse(savedResults);
      }

      currentActiveDb = (oracleDb.getActiveDatabase() || 'SQL_CLASS').toUpperCase();

      const savedState = localStorage.getItem(UI_STATE_STORAGE_KEY);
      if (savedState) {
        const state = JSON.parse(savedState);
        if (state && typeof state === 'object') {
          restoredWorkspace = true;
          if (state.theme === 'theme-dark' || state.theme === 'theme-light') theme = state.theme;
          if (typeof state.editorCode === 'string' && !savedScripts) {
            scriptsByConnection[currentActiveDb] = state.editorCode;
          }
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
        if (savedEditorCode !== null && !savedScripts) {
          scriptsByConnection[currentActiveDb] = savedEditorCode;
        }
      }
    } catch (error) {
      console.error('Failed to restore workspace state', error);
    }

    if (scriptsByConnection[currentActiveDb] !== undefined) {
      editorCode = scriptsByConnection[currentActiveDb];
    } else {
      editorCode = currentActiveDb === 'SQL_CLASS' ? DEFAULT_QUERY : `-- ${currentActiveDb} Worksheet\nSELECT sysdate FROM dual;\n`;
      scriptsByConnection[currentActiveDb] = editorCode;
    }

    if (resultsByConnection[currentActiveDb]) {
      queryResults = resultsByConnection[currentActiveDb];
    }
    if (statusByConnection[currentActiveDb]) {
      queryStatus = statusByConnection[currentActiveDb];
    }

    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(theme);

    uiStateLoaded = true;
    if (!restoredWorkspace && !hasLegacyEditorCode) {
      runQueryScript(editorCode);
    }

    try {
      const savedView = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (savedView === 'vertical' || savedView === 'landscape' || savedView === 'desktop') {
        currentViewMode = savedView;
      } else {
        if (window.innerWidth <= 768) {
          currentViewMode = window.innerWidth > window.innerHeight ? 'landscape' : 'vertical';
          localStorage.setItem(VIEW_MODE_STORAGE_KEY, currentViewMode);
        } else {
          currentViewMode = 'desktop';
        }
      }
    } catch (_) {}

    function checkViewport() {
      clampSidebarWidths();
    }

    checkViewport();
    window.addEventListener('resize', checkViewport);
    window.addEventListener('mouseup', stopSplitterResize);
    window.addEventListener('pointerup', stopSplitterResize);
    window.addEventListener('blur', stopSplitterResize);
    window.addEventListener('pointerup', stopSidebarResize);
    window.addEventListener('blur', stopSidebarResize);

    return () => {
      window.removeEventListener('resize', checkViewport);
      window.removeEventListener('mouseup', stopSplitterResize);
      window.removeEventListener('pointerup', stopSplitterResize);
      window.removeEventListener('blur', stopSplitterResize);
      window.removeEventListener('pointerup', stopSidebarResize);
      window.removeEventListener('blur', stopSidebarResize);
    };
  });
</script>

{#if activeMobile}
  <MobileKeyboardStudio
    bind:code={editorCode}
    {theme}
    layoutMode={currentViewMode}
    onRun={runQueryScript}
    {queryResults}
    {queryStatus}
    onToggleTheme={handleToggleTheme}
    onExitMobile={handleExitMobile}
    onSwitchLayout={(mode) => handleSwitchView(mode)}
    onOpenImport={() => handleOpenImport()}
    onOpenExport={() => handleOpenExport('editor')}
  />
{:else}
  <div class="app-container {theme}">
    <Header 
      {theme}
      isMobileView={false}
      onSwitchView={handleSwitchView}
      onOpenCanvas={() => isCanvasOpen = true}
      onResetDb={handleResetDb}
      onToggleTheme={handleToggleTheme}
    />

    <main class="app-body" bind:this={appBodyEl}>
    <ConnectionsSidebar 
      collapsed={isLeftCollapsed}
      width={leftSidebarWidth}
      onToggleCollapse={() => isLeftCollapsed = !isLeftCollapsed}
      onInsertText={handleInsertText}
      onOpenNewConnection={() => isNewConnectionModalOpen = true}
      onOpenExport={handleOpenExport}
      onOpenImport={handleOpenImport}
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
          onOpenImport={() => handleOpenImport()}
          onOpenExport={() => handleOpenExport('editor')}
          activeConnection={currentActiveDb}
          databases={$databasesStore}
          history={historyByConnection[currentActiveDb] || []}
          onSelectConnection={handleSelectConnection}
          onClearHistory={handleClearHistory}
          onLoadHistoryItem={handleLoadHistoryItem}
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
          onClear={handleClearOutput}
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
</div>
{/if}

<TableCanvasModal
  bind:this={tableCanvasComponent}
  visible={isCanvasOpen}
  onClose={() => isCanvasOpen = false}
/>

<NewConnectionModal
  visible={isNewConnectionModalOpen}
  onClose={() => isNewConnectionModalOpen = false}
  onConnect={handleCreateAndConnect}
/>

<ExportModal
  visible={isExportModalOpen}
  initialScope={exportScope}
  initialTableName={exportTableName}
  initialDbKey={exportDbKey}
  editorCode={editorCode}
  onClose={() => isExportModalOpen = false}
  onLoadIntoEditor={handleLoadIntoEditor}
/>

<ImportModal
  visible={isImportModalOpen}
  onClose={() => isImportModalOpen = false}
  onLoadIntoEditor={handleLoadIntoEditor}
  onExecuteScript={handleExecuteImportedScript}
/>
