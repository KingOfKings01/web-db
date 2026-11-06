<script>
  export let results = [];
  export let status = 'Ready';
  export let onAddToTables = () => {};
  export let onClear = () => {};
  let previousResults;
  let addedResultIndexes = new Set();

  $: if (results !== previousResults) {
    previousResults = results;
    addedResultIndexes = new Set();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
</script>

<div class="output-section">
  <div class="section-toolbar">
    <div class="toolbar-left">
      <span class="section-heading">Output</span>
      <span 
        class="output-status-pill" 
        class:success={status.includes('Completed')} 
        class:error={status.includes('Error')}
      >
        {status}
      </span>
    </div>
    <div class="toolbar-right">
      <button class="btn-text-action" on:click={onClear} title="Clear Output">Clear</button>
    </div>
  </div>

  <div class="output-display">
    {#if !results || results.length === 0}
      <div class="empty-output-state">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <p>Write SQL queries above and click <strong>Run</strong>.</p>
        <p class="sub-text">Tables created, inserted, or queried will show here in Oracle format.</p>
      </div>
    {:else}
      {#each results as res, resultIndex}
        {#if res.type === 'ERROR'}
          <div class="oracle-error-box">
            <div class="oracle-error-header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{res.message}</span>
            </div>
            <div class="oracle-error-sql">
              Command: <code>{res.command}</code>
            </div>
          </div>
        {:else if res.type === 'DML' || res.type === 'DDL'}
          <div class="query-result-block">
            <div class="query-result-header">
              <span class="query-command-text">{res.command}</span>
              <span class="query-meta-badge">SUCCESS</span>
            </div>
            <div class="dml-feedback-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 6L9 17l-5-5"></path>
              </svg>
              <span>{res.message}</span>
            </div>
          </div>
        {:else if res.type === 'SELECT' || res.type === 'DESCRIBE'}
          <div class="query-result-block">
            <div class="query-result-header">
              <span class="query-meta-badge">{res.rows.length} row{res.rows.length === 1 ? '' : 's'} ({res.executionTimeMs || 0} ms)</span>
              <button
                class="btn-text-action"
                disabled={addedResultIndexes.has(resultIndex)}
                on:click={() => {
                  onAddToTables(res);
                  addedResultIndexes = new Set(addedResultIndexes).add(resultIndex);
                }}
              >
                {addedResultIndexes.has(resultIndex) ? 'Added to Tables' : 'Add to Tables'}
              </button>
            </div>
            <div class="table-responsive">
              <table class="output-data-table">
                <thead>
                  <tr>
                    {#each res.columns as col}
                      <th>{col.toLowerCase()}</th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#if res.rows.length === 0}
                    <tr>
                      <td colspan="{res.columns.length}" style="text-align: center; padding: 18px; color: var(--text-muted); font-style: italic;">
                        0 rows selected.
                      </td>
                    </tr>
                  {:else}
                    {#each res.rows as row}
                      <tr>
                        {#each res.columns as col}
                          <td>
                            {#if row[col] === null || row[col] === undefined}
                              <span class="null-pill">(null)</span>
                            {:else}
                              {row[col]}
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
    {/if}
  </div>
</div>
