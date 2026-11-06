<script>
  import { tablesStore } from '../lib/db-store.js';

  export let collapsed = false;
  export let width = 320;
  export let onToggleCollapse = () => {};

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
</script>

<aside class="sidebar sidebar-right" class:collapsed={collapsed} style="width: {collapsed ? 34 : width}px;">
  <div class="sidebar-header">
    <button
      class="btn-sidebar-toggle"
      on:click={onToggleCollapse}
      title={collapsed ? 'Show Available Tables' : 'Collapse Sidebar'}
      aria-label={collapsed ? 'Show Available Tables' : 'Collapse Sidebar'}
    >
      {collapsed ? '‹' : '›'}
    </button>
    {#if !collapsed}
      <div class="sidebar-title">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
        <span>Available Tables</span>
      </div>
      <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Live</span>
    {/if}
  </div>

  <div class="sidebar-content right-tables-container">
    {#each Object.entries($tablesStore) as [tableName, table]}
      {#if tableName !== 'DUAL'}
        <div class="available-table-card">
          <div class="card-head">
            <span class="table-name">{capitalize(tableName)}</span>
            <span class="table-count">{table.rows.length} rows</span>
          </div>
          <div style="overflow-x: auto;">
            <table>
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
                    <td colspan="{table.columns.length}" style="text-align: center; color: var(--text-subtle);">
                      (Empty)
                    </td>
                  </tr>
                {:else}
                  {#each table.rows.slice(0, 10) as row}
                    <tr>
                      {#each table.columns as col}
                        <td>
                          {#if row[col.name] === null || row[col.name] === undefined}
                            <span class="null-pill">null</span>
                          {:else}
                            {row[col.name]}
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
    {/each}
  </div>
</aside>
