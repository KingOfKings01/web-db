<script>
  import { tablesStore } from '../lib/db-store.js';

  export let collapsed = false;
  export let width = 320;
  export let onToggleCollapse = () => {};

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  $: userTables = Object.entries($tablesStore || {}).filter(([tableName]) => tableName !== 'DUAL');
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
        <span>Available Tables</span>
      </div>
      <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Live</span>
    {/if}
  </div>

  <div class="sidebar-content right-tables-container">
    {#if userTables.length === 0}
      <div style="padding: 28px 14px; text-align: center; color: var(--text-muted); font-size: 12px;">
        <p style="margin: 0 0 6px 0; font-weight: 600; color: var(--text-main);">No Tables Available</p>
        <span style="font-size: 11px; color: var(--text-subtle);">Tables in the active database will appear here live.</span>
      </div>
    {:else}
      {#each userTables as [tableName, table]}
        <div class="available-table-card">
          <div class="card-head">
            <span class="table-name">{capitalize(tableName)}</span>
            <span class="table-count">{(table.rows?.length || 0)} rows</span>
          </div>
          <div style="overflow-x: auto;">
            <table>
              <thead>
                <tr>
                  {#each (table.columns || []) as col}
                    <th>{col.name.toLowerCase()}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#if !table.rows || table.rows.length === 0}
                  <tr>
                    <td colspan="{(table.columns?.length || 1)}" style="text-align: center; color: var(--text-subtle);">
                      (Empty)
                    </td>
                  </tr>
                {:else}
                  {#each table.rows.slice(0, 10) as row}
                    <tr>
                      {#each (table.columns || []) as col}
                        <td>
                          {#if row[col.name] === null || row[col.name] === undefined}
                            <span class="null-pill">null</span>
                          {:else if typeof row[col.name] === 'boolean'}
                            {row[col.name] ? 1 : 0}
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
      {/each}
    {/if}
  </div>
</aside>
