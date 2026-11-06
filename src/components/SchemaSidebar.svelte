<script>
  import { tablesStore, viewsStore } from '../lib/db-store.js';

  export let collapsed = false;
  export let width = 250;
  export let onToggleCollapse = () => {};
  export let onInsertText = (text) => {};
  export let onCreateTableTemplate = () => {};

  // Track collapsed status of individual tables
  let collapsedTables = {};

  function toggleTable(name) {
    collapsedTables[name] = !collapsedTables[name];
  }

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
</script>

<aside class="sidebar sidebar-left" class:collapsed={collapsed} style="width: {width}px;">
  <div class="sidebar-header">
    <div class="sidebar-title">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="3" y1="9" x2="21" y2="9"></line>
        <line x1="9" y1="21" x2="9" y2="9"></line>
      </svg>
      <span>Tables Schema</span>
    </div>
    <button class="btn-sidebar-toggle" on:click={onToggleCollapse} title="Collapse Sidebar">
      &lsaquo;
    </button>
  </div>

  <div class="sidebar-content">
    {#each Object.entries($tablesStore) as [tableName, table]}
      {#if tableName !== 'DUAL'}
        <div class="schema-table-item">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="schema-table-header" on:click={() => toggleTable(tableName)}>
            <div class="schema-table-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
              <span>{capitalize(tableName)}</span>
            </div>
            <span class="schema-toggle-icon">
              {collapsedTables[tableName] ? '[+]' : '[-]'}
            </span>
          </div>

          {#if !collapsedTables[tableName]}
            <div class="schema-columns-list">
              {#each table.columns as col}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div 
                  class="schema-column-row" 
                  on:click={() => onInsertText(col.name.toLowerCase())} 
                  title="Click to insert column into SQL editor"
                >
                  <span class="schema-col-name">
                    {#if col.isPk}<span class="schema-col-pk-badge">🔑</span>{/if}
                    {col.name.toLowerCase()}
                  </span>
                  <span class="schema-col-type">[{col.type.toLowerCase()}]</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    {/each}

    {#if Object.keys($viewsStore).length > 0}
      <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin: 12px 0 6px 4px; text-transform: uppercase;">
        Views
      </div>
      {#each Object.keys($viewsStore) as viewName}
        <div class="schema-table-item">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="schema-table-header" on:click={() => onInsertText(`SELECT * FROM ${viewName};`)}>
            <div class="schema-table-title" style="color: #0d9488;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              <span>{capitalize(viewName)}</span>
            </div>
            <span class="schema-toggle-icon">[view]</span>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <div class="sidebar-footer">
    <button class="btn-sidebar-action" on:click={onCreateTableTemplate}>+ Create Table</button>
  </div>
</aside>
