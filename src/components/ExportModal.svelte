<script>
  import { databasesStore, activeDatabaseStore, tablesStore, oracleDb } from '../lib/db-store.js';
  import { downloadFile } from '../lib/file-utils.js';

  export let visible = false;
  export let initialScope = 'database'; // 'database' | 'table' | 'editor'
  export let initialTableName = '';
  export let initialDbKey = '';
  export let editorCode = '';
  export let onClose = () => {};
  export let onLoadIntoEditor = (sql) => {};

  let scope = initialScope; // 'database' | 'table' | 'editor'
  let selectedDbKey = initialDbKey || $activeDatabaseStore || 'SQL_CLASS';
  let selectedTable = initialTableName || '';
  let format = 'sql'; // 'sql' | 'csv'

  let includeDdl = true;
  let includeData = true;
  let includeDrop = false;
  let includeCommit = true;

  let previewText = '';
  let copyFeedback = false;

  $: if (visible) {
    if (initialScope) scope = initialScope;
    if (initialDbKey) selectedDbKey = initialDbKey;
    if (initialTableName) selectedTable = initialTableName;
  }

  // List of tables for selected database
  $: currentDbTables = Object.keys($databasesStore[selectedDbKey]?.tables || {}).filter(t => t !== 'DUAL');

  // Set default selected table if empty
  $: if (scope === 'table' && !selectedTable && currentDbTables.length > 0) {
    selectedTable = currentDbTables[0];
  }

  // Suggested filename
  $: suggestedFileName = (() => {
    if (scope === 'editor') return 'worksheet_script.sql';
    if (scope === 'table') {
      const tbl = (selectedTable || 'table').toLowerCase();
      return format === 'csv' ? `${tbl}.csv` : `${tbl}.sql`;
    }
    const db = (selectedDbKey || 'database').toLowerCase();
    return `${db}_export.sql`;
  })();

  // Generate preview whenever options change
  $: {
    try {
      if (scope === 'editor') {
        previewText = editorCode || '-- No SQL code in editor.';
      } else if (scope === 'table') {
        if (!selectedTable) {
          previewText = '-- Please select a table to export.';
        } else if (format === 'csv') {
          previewText = oracleDb.exportTableToCsv(selectedTable, selectedDbKey);
        } else {
          previewText = oracleDb.exportTableToSql(selectedTable, {
            includeDdl,
            includeData,
            includeDrop,
            includeCommit
          }, selectedDbKey);
        }
      } else {
        // scope === 'database'
        previewText = oracleDb.exportDatabaseToSql({
          includeDdl,
          includeData,
          includeDrop,
          includeCommit
        }, selectedDbKey);
      }
    } catch (err) {
      previewText = `-- Export error: ${err.message || String(err)}`;
    }
  }

  function handleCopy() {
    if (!previewText) return;
    navigator.clipboard.writeText(previewText).then(() => {
      copyFeedback = true;
      setTimeout(() => copyFeedback = false, 2000);
    });
  }

  function handleDownload() {
    if (!previewText) return;
    const mime = format === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8';
    downloadFile(suggestedFileName, previewText, mime);
    onClose();
  }

  function handleOpenInEditor() {
    if (!previewText) return;
    onLoadIntoEditor(previewText);
    onClose();
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function handleKeydown(e) {
    if (visible && e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="export-modal-backdrop" on:click={handleBackdropClick}>
    <div class="export-modal-dialog">
      <!-- Modal Header -->
      <div class="export-modal-header">
        <div class="header-title-wrap">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <h3>Export SQL / Data</h3>
          <span class="badge-oracle">Oracle SQL Developer</span>
        </div>
        <button class="btn-close-modal" on:click={onClose} title="Close">✕</button>
      </div>

      <!-- Modal Body -->
      <div class="export-modal-body">
        <div class="export-form-grid">
          <!-- Scope Selection -->
          <div class="form-group">
            <label for="export-scope">Export Target</label>
            <select id="export-scope" bind:value={scope} class="form-select">
              <option value="database">Entire Database (Schema &amp; Data)</option>
              <option value="table">Single Table</option>
              <option value="editor">Current SQL Editor Script</option>
            </select>
          </div>

          <!-- Database Selection (if scope is database or table) -->
          {#if scope === 'database' || scope === 'table'}
            <div class="form-group">
              <label for="export-db">Database Connection</label>
              <select id="export-db" bind:value={selectedDbKey} class="form-select">
                {#each Object.entries($databasesStore) as [key, db]}
                  <option value={key}>{db.name} ({key})</option>
                {/each}
              </select>
            </div>
          {/if}

          <!-- Table Selection (if scope is table) -->
          {#if scope === 'table'}
            <div class="form-group">
              <label for="export-table">Select Table</label>
              <select id="export-table" bind:value={selectedTable} class="form-select">
                {#if currentDbTables.length === 0}
                  <option value="">(No tables in this database)</option>
                {:else}
                  {#each currentDbTables as t}
                    <option value={t}>{t}</option>
                  {/each}
                {/if}
              </select>
            </div>

            <!-- Format (SQL vs CSV) -->
            <div class="form-group">
              <label for="export-format">Export Format</label>
              <select id="export-format" bind:value={format} class="form-select">
                <option value="sql">SQL Script (*.sql)</option>
                <option value="csv">CSV Data (*.csv)</option>
              </select>
            </div>
          {/if}
        </div>

        <!-- SQL Specific Options -->
        {#if (scope !== 'table' || format === 'sql') && scope !== 'editor'}
          <div class="export-options-box">
            <span class="options-title">SQL Generation Options:</span>
            <div class="options-row">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={includeDdl} />
                <span>DDL (CREATE TABLE)</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={includeData} />
                <span>Data (INSERT INTO)</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={includeDrop} />
                <span>DROP TABLE Statement</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={includeCommit} />
                <span>COMMIT at end</span>
              </label>
            </div>
          </div>
        {/if}

        <!-- Output Filename preview -->
        <div class="filename-preview-row">
          <span class="fn-label">Output File:</span>
          <code class="fn-code">{suggestedFileName}</code>
          <span class="fn-size">{previewText ? `${previewText.split('\n').length} lines (${(previewText.length / 1024).toFixed(1)} KB)` : 'Empty'}</span>
        </div>

        <!-- Preview Text Area -->
        <div class="preview-container">
          <div class="preview-header">
            <span>Live Script Preview</span>
            <button class="btn-copy-preview" on:click={handleCopy} title="Copy to clipboard">
              {#if copyFeedback}
                ✓ Copied!
              {:else}
                📋 Copy
              {/if}
            </button>
          </div>
          <pre class="preview-box"><code>{previewText}</code></pre>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="export-modal-footer">
        <button class="btn-modal-secondary" on:click={onClose}>
          Cancel
        </button>

        {#if scope !== 'table' || format === 'sql'}
          <button class="btn-modal-editor" on:click={handleOpenInEditor} title="Paste this script into SQL Worksheet">
            Open in SQL Editor
          </button>
        {/if}

        <button class="btn-modal-primary" on:click={handleDownload}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Download {suggestedFileName}</span>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .export-modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 16px;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .export-modal-dialog {
    background: var(--bg-surface, #ffffff);
    color: var(--text-main, #0f172a);
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 8px;
    width: 100%;
    max-width: 680px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
  }

  .export-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
    background: var(--bg-header, #f8fafc);
    border-radius: 8px 8px 0 0;
  }

  .header-title-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-title-wrap h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--text-main, #0f172a);
  }

  .badge-oracle {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    background: #e0e7ff;
    color: #3730a3;
    padding: 2px 7px;
    border-radius: 4px;
    letter-spacing: 0.5px;
  }

  .btn-close-modal {
    background: transparent;
    border: none;
    font-size: 16px;
    color: var(--text-muted, #64748b);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .btn-close-modal:hover {
    background: rgba(0,0,0,0.06);
    color: var(--text-main, #0f172a);
  }

  .export-modal-body {
    padding: 16px 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .export-form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted, #475569);
  }

  .form-select {
    padding: 7px 10px;
    font-size: 13px;
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 6px;
    background: var(--bg-surface, #ffffff);
    color: var(--text-main, #0f172a);
  }

  .form-select:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  .export-options-box {
    background: var(--bg-subtle, #f1f5f9);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 6px;
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .options-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--text-muted, #64748b);
    letter-spacing: 0.5px;
  }

  .options-row {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }

  .checkbox-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-main, #334155);
    cursor: pointer;
  }

  .filename-preview-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }

  .fn-label {
    font-weight: 600;
    color: var(--text-muted, #64748b);
  }

  .fn-code {
    background: var(--bg-code, #f8fafc);
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 4px;
    padding: 2px 7px;
    font-family: monospace;
    font-weight: 700;
    color: #1e40af;
  }

  .fn-size {
    color: var(--text-muted, #64748b);
    font-size: 11px;
  }

  .preview-container {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 6px;
    overflow: hidden;
  }

  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-header, #f8fafc);
    padding: 6px 12px;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted, #64748b);
  }

  .btn-copy-preview {
    background: transparent;
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 4px;
    font-size: 11px;
    padding: 2px 8px;
    cursor: pointer;
    color: var(--text-main, #334155);
  }

  .btn-copy-preview:hover {
    background: var(--bg-subtle, #f1f5f9);
  }

  .preview-box {
    margin: 0;
    padding: 12px;
    background: var(--bg-editor, #1e1e24);
    color: #d1d5db;
    font-family: 'Fira Code', Consolas, monospace;
    font-size: 11.5px;
    line-height: 1.5;
    max-height: 220px;
    overflow-y: auto;
    white-space: pre;
  }

  .export-modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 18px;
    border-top: 1px solid var(--border-color, #e2e8f0);
    background: var(--bg-header, #f8fafc);
    border-radius: 0 0 8px 8px;
  }

  .btn-modal-secondary {
    padding: 7px 14px;
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 6px;
    background: transparent;
    color: var(--text-main, #475569);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-modal-secondary:hover {
    background: rgba(0,0,0,0.04);
  }

  .btn-modal-editor {
    padding: 7px 14px;
    border: 1px solid #93c5fd;
    border-radius: 6px;
    background: #eff6ff;
    color: #1d4ed8;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-modal-editor:hover {
    background: #dbeafe;
  }

  .btn-modal-primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 16px;
    border: none;
    border-radius: 6px;
    background: #2563eb;
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  }

  .btn-modal-primary:hover {
    background: #1d4ed8;
  }
</style>
