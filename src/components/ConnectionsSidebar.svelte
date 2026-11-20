<script>
  import { databasesStore, activeDatabaseStore, oracleDb } from '../lib/db-store.js';
  import { downloadFile } from '../lib/file-utils.js';

  export let collapsed = false;
  export let width = 260;
  export let onToggleCollapse = () => {};
  export let onInsertText = (text) => {};
  export let onOpenNewConnection = () => {};
  export let onOpenExport = (scope, name, dbKey) => {};
  export let onOpenImport = (dbKey) => {};

  // Track expanded nodes in tree
  let isRootExpanded = true;
  let expandedDatabases = { 'SQL_CLASS': true, 'ORACLE26': false };
  let expandedTablesFolders = { 'SQL_CLASS': true, 'ORACLE26': true };
  let expandedTables = {};

  // Context Menu State
  let contextMenuVisible = false;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let contextMenuType = null; // 'db' | 'table'
  let contextMenuTarget = null; // db object or table info object

  // Rename Dialog State
  let renameModalVisible = false;
  let renameType = null; // 'db' | 'table'
  let renameOldName = '';
  let renameNewName = '';
  let renameDbKey = null;
  let renameError = '';

  // Confirm Action Dialog State (Drop / Truncate)
  let confirmModalVisible = false;
  let confirmTitle = '';
  let confirmMessage = '';
  let confirmButtonText = 'Confirm';
  let confirmButtonClass = 'btn-danger';
  let confirmAction = () => {};

  function toggleRoot() {
    isRootExpanded = !isRootExpanded;
  }

  function toggleDatabase(dbKey, e) {
    if (e) e.stopPropagation();
    expandedDatabases[dbKey] = !expandedDatabases[dbKey];
    expandedDatabases = { ...expandedDatabases };
  }

  function toggleTablesFolder(dbKey, e) {
    if (e) e.stopPropagation();
    expandedTablesFolders[dbKey] = !expandedTablesFolders[dbKey];
    expandedTablesFolders = { ...expandedTablesFolders };
  }

  function toggleTable(fullKey, e) {
    if (e) e.stopPropagation();
    expandedTables[fullKey] = !expandedTables[fullKey];
    expandedTables = { ...expandedTables };
  }

  function handleSelectDatabase(dbName, e) {
    if (e) e.stopPropagation();
    try {
      const active = $activeDatabaseStore.toUpperCase();
      const target = dbName.toUpperCase();
      if (active !== target) {
        oracleDb.connectDatabase(dbName);
      }
      expandedDatabases[target] = true;
      expandedDatabases = { ...expandedDatabases };
    } catch (err) {
      alert(err.message || String(err));
    }
  }

  function handleRefresh() {
    oracleDb.notifyChange();
  }

  // Close context menu on outside click or escape
  function closeContextMenu() {
    contextMenuVisible = false;
    contextMenuType = null;
    contextMenuTarget = null;
  }

  function handleWindowKeydown(e) {
    if (e.key === 'Escape') {
      closeContextMenu();
      if (renameModalVisible) renameModalVisible = false;
      if (confirmModalVisible) confirmModalVisible = false;
    }
  }

  // Open Context Menu on Database Node
  function openDbContextMenu(db, e) {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 190;
    const menuHeight = 170;
    const clickX = e.clientX;
    const clickY = e.clientY;

    contextMenuX = (clickX + menuWidth > window.innerWidth) ? (window.innerWidth - menuWidth - 10) : clickX;
    contextMenuY = (clickY + menuHeight > window.innerHeight) ? (window.innerHeight - menuHeight - 10) : clickY;
    contextMenuType = 'db';
    contextMenuTarget = db;
    contextMenuVisible = true;
  }

  // Open Context Menu on Table Node
  function openTableContextMenu(dbKey, tableName, table, e) {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 200;
    const menuHeight = 220;
    const clickX = e.clientX;
    const clickY = e.clientY;

    contextMenuX = (clickX + menuWidth > window.innerWidth) ? (window.innerWidth - menuWidth - 10) : clickX;
    contextMenuY = (clickY + menuHeight > window.innerHeight) ? (window.innerHeight - menuHeight - 10) : clickY;
    contextMenuType = 'table';
    contextMenuTarget = { dbKey, tableName, table };
    contextMenuVisible = true;
  }

  // Context Menu Actions - Database
  function handleDbConnect() {
    const db = contextMenuTarget;
    closeContextMenu();
    if (db) {
      handleSelectDatabase(db.name);
    }
  }

  function handleDbDisconnect() {
    const db = contextMenuTarget;
    closeContextMenu();
    if (db) {
      oracleDb.disconnectDatabase(db.name);
    }
  }

  function handleDbRefresh() {
    closeContextMenu();
    handleRefresh();
  }

  function handleDbExport() {
    const db = contextMenuTarget;
    closeContextMenu();
    if (db) {
      const dbKey = Object.keys($databasesStore).find(k => $databasesStore[k]?.name === db.name) || db.name;
      onOpenExport('database', db.name, dbKey);
    }
  }

  function handleDbImport() {
    const db = contextMenuTarget;
    closeContextMenu();
    if (db) {
      const dbKey = Object.keys($databasesStore).find(k => $databasesStore[k]?.name === db.name) || db.name;
      onOpenImport(dbKey);
    }
  }

  function handleDbRename() {
    const db = contextMenuTarget;
    closeContextMenu();
    if (db) {
      renameType = 'db';
      renameOldName = db.name;
      renameNewName = db.name;
      renameError = '';
      renameModalVisible = true;
    }
  }

  function handleDbDrop() {
    const db = contextMenuTarget;
    closeContextMenu();
    if (db) {
      confirmTitle = `Drop Database / Connection`;
      confirmMessage = `Are you sure you want to drop connection '${db.name}' and all its schemas?`;
      confirmButtonText = 'Drop Database';
      confirmButtonClass = 'btn-danger';
      confirmAction = () => {
        try {
          oracleDb.dropDatabase(db.name);
        } catch (err) {
          alert(err.message || String(err));
        }
      };
      confirmModalVisible = true;
    }
  }

  // Context Menu Actions - Table
  function handleTableQuery() {
    const { tableName } = contextMenuTarget;
    closeContextMenu();
    onInsertText(`SELECT * FROM ${tableName.toLowerCase()};\n`);
  }

  function handleTableDesc() {
    const { tableName } = contextMenuTarget;
    closeContextMenu();
    onInsertText(`DESC ${tableName.toLowerCase()};\n`);
  }

  function handleTableCount() {
    const { tableName } = contextMenuTarget;
    closeContextMenu();
    onInsertText(`SELECT COUNT(*) AS total_rows FROM ${tableName.toLowerCase()};\n`);
  }

  function handleTableExportSql() {
    const { dbKey, tableName } = contextMenuTarget;
    closeContextMenu();
    onOpenExport('table', tableName, dbKey);
  }

  function handleTableExportCsv() {
    const { dbKey, tableName } = contextMenuTarget;
    closeContextMenu();
    try {
      const csv = oracleDb.exportTableToCsv(tableName, dbKey);
      downloadFile(`${tableName.toLowerCase()}.csv`, csv, 'text/csv;charset=utf-8');
    } catch (err) {
      alert(err.message || String(err));
    }
  }

  function handleTableRename() {
    const { dbKey, tableName } = contextMenuTarget;
    closeContextMenu();
    renameType = 'table';
    renameDbKey = dbKey;
    renameOldName = tableName;
    renameNewName = tableName;
    renameError = '';
    renameModalVisible = true;
  }

  function handleTableTruncate() {
    const { dbKey, tableName } = contextMenuTarget;
    closeContextMenu();
    confirmTitle = `Truncate Table`;
    confirmMessage = `Are you sure you want to truncate table '${tableName}'? All rows will be permanently deleted.`;
    confirmButtonText = 'Truncate Table';
    confirmButtonClass = 'btn-warning';
    confirmAction = () => {
      try {
        oracleDb.truncateTable(tableName, dbKey);
      } catch (err) {
        alert(err.message || String(err));
      }
    };
    confirmModalVisible = true;
  }

  function handleTableDrop() {
    const { dbKey, tableName } = contextMenuTarget;
    closeContextMenu();
    confirmTitle = `Drop Table`;
    confirmMessage = `Are you sure you want to drop table '${tableName}'? This table and all its data will be removed.`;
    confirmButtonText = 'Drop Table';
    confirmButtonClass = 'btn-danger';
    confirmAction = () => {
      try {
        oracleDb.dropTable(tableName, dbKey);
      } catch (err) {
        alert(err.message || String(err));
      }
    };
    confirmModalVisible = true;
  }

  // Submit Rename Modal
  function submitRename() {
    const trimmed = renameNewName.trim();
    if (!trimmed) {
      renameError = 'Name cannot be empty.';
      return;
    }

    try {
      if (renameType === 'db') {
        oracleDb.renameDatabase(renameOldName, trimmed);
      } else if (renameType === 'table') {
        oracleDb.renameTable(renameOldName, trimmed, renameDbKey);
      }
      renameModalVisible = false;
    } catch (err) {
      renameError = err.message || String(err);
    }
  }
</script>

<svelte:window on:click={closeContextMenu} on:keydown={handleWindowKeydown} />

<aside class="sidebar sidebar-left connections-sidebar" class:collapsed={collapsed} style="width: {collapsed ? 34 : width}px;">
  <div class="sidebar-header">
    <div class="sidebar-title">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
      </svg>
      <span>Connections</span>
    </div>
    <div class="header-actions">
      <!-- Green + Button matching Oracle SQL Developer -->
      <button 
        class="btn-icon-action btn-add-conn" 
        on:click={onOpenNewConnection} 
        title="New Database Connection..."
        aria-label="New Database Connection"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>

      <!-- Import SQL Script Button -->
      <button 
        class="btn-icon-action" 
        on:click={() => onOpenImport($activeDatabaseStore)} 
        title="Import SQL Script / Data..."
        aria-label="Import SQL"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      </button>

      <!-- Export Database SQL Button -->
      <button 
        class="btn-icon-action" 
        on:click={() => onOpenExport('database', '', $activeDatabaseStore)} 
        title="Export Database SQL..."
        aria-label="Export Database"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
      </button>

      <!-- Refresh Button -->
      <button 
        class="btn-icon-action" 
        on:click={handleRefresh} 
        title="Refresh Connections"
        aria-label="Refresh Connections"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
      </button>

      <!-- Collapse Sidebar Button -->
      <button 
        class="btn-sidebar-toggle" 
        on:click={onToggleCollapse} 
        title={collapsed ? 'Show Connections' : 'Collapse Sidebar'}
      >
        {collapsed ? '›' : '‹'}
      </button>
    </div>
  </div>

  <div class="sidebar-content connections-tree-container">
    <div class="tree-root">
      <!-- Root Node: Oracle Connections -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="tree-node tree-node-root" on:click={toggleRoot}>
        <span class="tree-toggle-symbol">{isRootExpanded ? '[-]' : '[+]'}</span>
        <!-- Cylinder stack icon -->
        <svg class="tree-icon icon-oracle-root" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2">
          <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
        </svg>
        <span class="node-label root-label">Oracle Connections</span>
      </div>

      {#if isRootExpanded}
        <div class="tree-children tree-dbs-list">
          {#each Object.entries($databasesStore) as [dbKey, db]}
            {@const isConnected = $activeDatabaseStore.toUpperCase() === dbKey.toUpperCase()}
            {@const isExpanded = expandedDatabases[dbKey] ?? isConnected}
            {@const tablesList = Object.entries(db.tables || {}).filter(([name]) => name !== 'DUAL')}

            <div class="tree-db-item" class:active-db={isConnected}>
              <!-- Database Node Row -->
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div 
                class="tree-node tree-node-db" 
                class:connected={isConnected}
                on:click={(e) => handleSelectDatabase(db.name, e)}
                on:contextmenu={(e) => openDbContextMenu(db, e)}
                title="Click to connect | Right-click for options"
              >
                <button 
                  class="btn-tree-expand" 
                  on:click={(e) => toggleDatabase(dbKey, e)} 
                  title={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? '[-]' : '[+]'}
                </button>

                <!-- Icon: Connected Plug if connected, Cylinder if disconnected -->
                {#if isConnected}
                  <span class="plug-connected-icon" title="Connected">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2">
                      <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                    </svg>
                    <span class="plug-dot"></span>
                  </span>
                {:else}
                  <svg class="tree-icon icon-db" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
                    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                  </svg>
                {/if}

                <span class="node-label db-name" class:active-label={isConnected}>
                  {db.name}
                </span>

                {#if isConnected}
                  <span class="badge-connected">connected</span>
                {/if}
              </div>

              <!-- Database Child Folders (Tables) -->
              {#if isExpanded}
                <div class="tree-children tree-db-children">
                  <!-- Tables Folder -->
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div 
                    class="tree-node tree-node-folder" 
                    on:click={(e) => toggleTablesFolder(dbKey, e)}
                  >
                    <button class="btn-tree-expand">
                      {expandedTablesFolders[dbKey] ? '[-]' : '[+]'}
                    </button>
                    <!-- Folder Icon -->
                    <svg class="tree-icon icon-folder" width="14" height="14" viewBox="0 0 24 24" fill="#fef08a" stroke="#ca8a04" stroke-width="1.8">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span class="node-label folder-label">Tables (Filtered)</span>
                    <span class="folder-count">({tablesList.length})</span>
                  </div>

                  {#if expandedTablesFolders[dbKey]}
                    <div class="tree-children tree-tables-list">
                      {#if tablesList.length === 0}
                        <div class="tree-empty-hint">No tables created yet</div>
                      {:else}
                        {#each tablesList as [tableName, table]}
                          {@const tableKey = `${dbKey}_${tableName}`}
                          {@const isTableExpanded = expandedTables[tableKey]}

                          <div class="tree-table-item">
                            <!-- Table Node Row -->
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div 
                              class="tree-node tree-node-table"
                              on:click={(e) => toggleTable(tableKey, e)}
                              on:contextmenu={(e) => openTableContextMenu(dbKey, tableName, table, e)}
                              title="Click to expand | Right-click for options"
                            >
                              <button class="btn-tree-expand">
                                {isTableExpanded ? '[-]' : '[+]'}
                              </button>
                              <!-- Table Grid Icon matching screenshot -->
                              <svg class="tree-icon icon-table-grid" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="3" y1="9" x2="21" y2="9"></line>
                                <line x1="3" y1="15" x2="21" y2="15"></line>
                                <line x1="12" y1="3" x2="12" y2="21"></line>
                              </svg>
                              <span class="node-label table-label">
                                {tableName}
                              </span>
                            </div>

                            <!-- Table Columns -->
                            {#if isTableExpanded}
                              <div class="tree-children tree-columns-list">
                                {#each table.columns as col}
                                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                                  <div 
                                    class="tree-node tree-node-col" 
                                    on:click={() => onInsertText(col.name.toLowerCase())}
                                    title="Click to insert '{col.name.toLowerCase()}'"
                                  >
                                    <!-- Column row icon matching screenshot -->
                                    <svg class="tree-icon icon-col" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
                                      <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                                      <line x1="3" y1="10" x2="21" y2="10"></line>
                                    </svg>
                                    <span class="node-label col-name">
                                      {col.name}
                                    </span>
                                  </div>
                                {/each}
                              </div>
                            {/if}
                          </div>
                        {/each}
                      {/if}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</aside>

<!-- Context Menu Popup -->
{#if contextMenuVisible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="context-menu-popup" 
    style="top: {contextMenuY}px; left: {contextMenuX}px;"
    on:click|stopPropagation
  >
    {#if contextMenuType === 'db'}
      {@const isConn = $activeDatabaseStore.toUpperCase() === contextMenuTarget.name.toUpperCase()}
      <div class="menu-header">
        <span class="menu-title">{contextMenuTarget.name}</span>
      </div>

      {#if !isConn}
        <button class="menu-item" on:click={handleDbConnect}>
          <span class="menu-icon">🔌</span> Connect
        </button>
      {:else}
        <button class="menu-item" on:click={handleDbDisconnect}>
          <span class="menu-icon">⏹️</span> Disconnect
        </button>
      {/if}

      <button class="menu-item" on:click={handleDbRefresh}>
        <span class="menu-icon">🔄</span> Refresh
      </button>

      <div class="menu-divider"></div>

      <button class="menu-item" on:click={handleDbExport}>
        <span class="menu-icon">📤</span> Export Database (SQL)...
      </button>

      <button class="menu-item" on:click={handleDbImport}>
        <span class="menu-icon">📥</span> Import SQL Script...
      </button>

      <div class="menu-divider"></div>

      <button class="menu-item" on:click={handleDbRename}>
        <span class="menu-icon">✏️</span> Rename Connection...
      </button>

      <button class="menu-item menu-danger" on:click={handleDbDrop}>
        <span class="menu-icon">🗑️</span> Drop Database...
      </button>

    {:else if contextMenuType === 'table'}
      <div class="menu-header">
        <span class="menu-title">{contextMenuTarget.tableName}</span>
      </div>

      <button class="menu-item" on:click={handleTableQuery}>
        <span class="menu-icon">📄</span> Query Data (SELECT *)
      </button>

      <button class="menu-item" on:click={handleTableDesc}>
        <span class="menu-icon">ℹ️</span> Describe (DESC)
      </button>

      <button class="menu-item" on:click={handleTableCount}>
        <span class="menu-icon">🔢</span> Count Rows
      </button>

      <div class="menu-divider"></div>

      <button class="menu-item" on:click={handleTableExportSql}>
        <span class="menu-icon">📤</span> Export Table (SQL)...
      </button>

      <button class="menu-item" on:click={handleTableExportCsv}>
        <span class="menu-icon">📊</span> Export Table (CSV)...
      </button>

      <div class="menu-divider"></div>

      <button class="menu-item" on:click={handleTableRename}>
        <span class="menu-icon">✏️</span> Rename Table...
      </button>

      <button class="menu-item menu-warning" on:click={handleTableTruncate}>
        <span class="menu-icon">🧹</span> Truncate Table...
      </button>

      <button class="menu-item menu-danger" on:click={handleTableDrop}>
        <span class="menu-icon">🗑️</span> Drop Table...
      </button>
    {/if}
  </div>
{/if}

<!-- Rename Modal Dialog -->
{#if renameModalVisible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="custom-modal-backdrop" on:click={() => renameModalVisible = false}>
    <div class="custom-modal-card" on:click|stopPropagation>
      <div class="custom-modal-header">
        <h4>Rename {renameType === 'db' ? 'Connection / Database' : 'Table'}</h4>
        <button class="btn-dialog-close" on:click={() => renameModalVisible = false}>&times;</button>
      </div>
      <div class="custom-modal-body">
        <div class="form-group-item">
          <label for="rename-old">Current Name</label>
          <input id="rename-old" type="text" value={renameOldName} disabled class="input-disabled" />
        </div>
        <div class="form-group-item">
          <label for="rename-new">New Name <span style="color: #ef4444;">*</span></label>
          <input 
            id="rename-new"
            type="text" 
            bind:value={renameNewName} 
            placeholder="Enter new name" 
            class="input-active"
            autofocus
            on:keydown={(e) => { if (e.key === 'Enter') submitRename(); }}
          />
        </div>
        {#if renameError}
          <div class="dialog-error-banner">{renameError}</div>
        {/if}
      </div>
      <div class="custom-modal-footer">
        <button class="btn-dialog-sec" on:click={() => renameModalVisible = false}>Cancel</button>
        <button class="btn-dialog-pri" on:click={submitRename}>Rename</button>
      </div>
    </div>
  </div>
{/if}

<!-- Confirmation Action Dialog -->
{#if confirmModalVisible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="custom-modal-backdrop" on:click={() => confirmModalVisible = false}>
    <div class="custom-modal-card" on:click|stopPropagation>
      <div class="custom-modal-header">
        <h4>{confirmTitle}</h4>
        <button class="btn-dialog-close" on:click={() => confirmModalVisible = false}>&times;</button>
      </div>
      <div class="custom-modal-body">
        <p class="confirm-body-text">{confirmMessage}</p>
      </div>
      <div class="custom-modal-footer">
        <button class="btn-dialog-sec" on:click={() => confirmModalVisible = false}>Cancel</button>
        <button 
          class="btn-dialog-pri {confirmButtonClass}" 
          on:click={() => {
            confirmAction();
            confirmModalVisible = false;
          }}
        >
          {confirmButtonText}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .connections-sidebar {
    background-color: var(--bg-surface);
    display: flex;
    flex-direction: column;
    user-select: none;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .btn-icon-action {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 3px 5px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
  }

  .btn-icon-action:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .btn-add-conn {
    background-color: rgba(34, 197, 94, 0.12);
  }

  .btn-add-conn:hover {
    background-color: rgba(34, 197, 94, 0.25);
  }

  .connections-tree-container {
    padding: 8px 6px 12px 6px;
    overflow-y: auto;
    font-size: 12px;
    flex: 1;
  }

  /* Tree Nodes */
  .tree-node {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 4px;
    border-radius: 4px;
    cursor: pointer;
    line-height: 1.3;
  }

  .tree-node:hover {
    background-color: var(--bg-hover);
  }

  .tree-node-root {
    font-weight: 700;
    color: var(--text-main);
    margin-bottom: 2px;
  }

  .tree-toggle-symbol {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--text-muted);
    width: 14px;
    text-align: center;
  }

  .btn-tree-expand {
    background: transparent;
    border: none;
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0;
    width: 16px;
    text-align: center;
    line-height: 1;
  }

  .btn-tree-expand:hover {
    color: var(--text-main);
  }

  /* Indentation & Tree Structure */
  .tree-children {
    padding-left: 14px;
    border-left: 1px dotted var(--border-medium, #cbd5e1);
    margin-left: 7px;
  }

  .tree-db-item {
    margin: 3px 0;
  }

  .tree-node-db {
    font-weight: 600;
    color: var(--text-main);
  }

  .tree-node-db.connected {
    background-color: rgba(16, 185, 129, 0.08);
  }

  .node-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .db-name {
    font-size: 12px;
  }

  .db-name.active-label {
    font-weight: 700;
    color: #047857;
  }

  body.theme-dark .db-name.active-label {
    color: #34d399;
  }

  .plug-connected-icon {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .plug-dot {
    position: absolute;
    bottom: -1px;
    right: -2px;
    width: 5px;
    height: 5px;
    background-color: #10b981;
    border-radius: 50%;
    border: 1px solid var(--bg-surface);
  }

  .badge-connected {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    background-color: rgba(16, 185, 129, 0.15);
    color: #059669;
    padding: 1px 4px;
    border-radius: 3px;
    margin-left: auto;
  }

  /* Folder Node */
  .tree-node-folder {
    color: var(--text-muted);
    font-size: 11.5px;
    font-weight: 600;
    margin: 2px 0;
  }

  .folder-count {
    font-size: 10px;
    color: var(--text-subtle);
  }

  /* Table Node */
  .tree-node-table {
    padding: 2px 3px;
  }

  .table-label {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-main);
  }

  /* Columns List */
  .tree-columns-list {
    padding-left: 18px;
    margin-left: 8px;
  }

  .tree-node-col {
    padding: 1.5px 2px;
    font-size: 11px;
    color: var(--text-muted);
  }

  .tree-node-col:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .col-name {
    font-family: var(--font-mono, monospace);
    font-size: 10.5px;
  }

  .tree-empty-hint {
    padding: 4px 6px;
    font-size: 11px;
    color: var(--text-subtle);
    font-style: italic;
  }

  /* ==========================================================================
     Context Menu Popup
     ========================================================================== */
  .context-menu-popup {
    position: fixed;
    z-index: 99999;
    background-color: var(--bg-surface, #ffffff);
    border: 1px solid var(--border-medium, #cbd5e1);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
    border-radius: 6px;
    min-width: 185px;
    padding: 4px 0;
    animation: menuFadeIn 0.12s ease-out;
  }

  @keyframes menuFadeIn {
    from { opacity: 0; transform: scale(0.97); }
    to { opacity: 1; transform: scale(1); }
  }

  .menu-header {
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--text-muted, #64748b);
    border-bottom: 1px solid var(--border-light, #e2e8f0);
    letter-spacing: 0.5px;
  }

  .menu-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: block;
  }

  .menu-item {
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-main, #1e293b);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background-color 0.1s;
  }

  .menu-item:hover {
    background-color: var(--bg-hover, #f1f5f9);
  }

  .menu-item.menu-danger {
    color: #dc2626;
  }

  .menu-item.menu-danger:hover {
    background-color: rgba(239, 68, 68, 0.1);
  }

  .menu-item.menu-warning {
    color: #d97706;
  }

  .menu-item.menu-warning:hover {
    background-color: rgba(245, 158, 11, 0.1);
  }

  .menu-icon {
    font-size: 12px;
    width: 16px;
    text-align: center;
  }

  .menu-divider {
    height: 1px;
    background-color: var(--border-light, #e2e8f0);
    margin: 4px 0;
  }

  /* ==========================================================================
     Centered Rename & Confirm Dialog Modals
     ========================================================================== */
  .custom-modal-backdrop {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100000;
    padding: 16px;
    box-sizing: border-box;
  }

  .custom-modal-card {
    background-color: var(--bg-surface, #ffffff);
    border-radius: 8px;
    border: 1px solid var(--border-medium, #cbd5e1);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
    width: 100%;
    max-width: 420px;
    overflow: hidden;
    animation: menuFadeIn 0.15s ease-out;
  }

  .custom-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-light, #e2e8f0);
    background-color: var(--bg-surface, #ffffff);
  }

  .custom-modal-header h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: var(--text-main, #1e293b);
  }

  .btn-dialog-close {
    background: transparent;
    border: none;
    font-size: 20px;
    line-height: 1;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px 4px;
  }

  .custom-modal-body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .form-group-item {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .form-group-item label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-main);
  }

  .input-disabled {
    padding: 7px 10px;
    font-size: 13px;
    border: 1px solid var(--border-light);
    border-radius: 5px;
    background-color: var(--bg-subtle, #f8fafc);
    color: var(--text-muted);
    outline: none;
  }

  .input-active {
    padding: 7px 10px;
    font-size: 13px;
    border: 1px solid var(--border-medium);
    border-radius: 5px;
    background-color: var(--bg-primary);
    color: var(--text-main);
    outline: none;
  }

  .input-active:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  .dialog-error-banner {
    padding: 6px 10px;
    font-size: 12px;
    color: #dc2626;
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 4px;
  }

  .confirm-body-text {
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--text-main);
  }

  .custom-modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 10px 16px;
    border-top: 1px solid var(--border-light);
    background-color: var(--bg-subtle, #f8fafc);
  }

  .btn-dialog-sec {
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    border-radius: 5px;
    border: 1px solid var(--border-medium);
    background-color: var(--bg-surface);
    color: var(--text-main);
    cursor: pointer;
  }

  .btn-dialog-sec:hover {
    background-color: var(--bg-hover);
  }

  .btn-dialog-pri {
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 600;
    border-radius: 5px;
    border: none;
    background-color: #2563eb;
    color: #ffffff;
    cursor: pointer;
  }

  .btn-dialog-pri:hover {
    background-color: #1d4ed8;
  }

  .btn-dialog-pri.btn-danger {
    background-color: #dc2626;
  }

  .btn-dialog-pri.btn-danger:hover {
    background-color: #b91c1c;
  }

  .btn-dialog-pri.btn-warning {
    background-color: #d97706;
  }

  .btn-dialog-pri.btn-warning:hover {
    background-color: #b45309;
  }
</style>