<script>
  import { databasesStore, activeDatabaseStore, oracleDb } from '../lib/db-store.js';

  export let visible = false;
  export let onClose = () => {};
  export let onLoadIntoEditor = (sql) => {};
  export let onExecuteScript = (sql, dbName) => {};

  let selectedDbKey = $activeDatabaseStore || 'SQL_CLASS';
  let fileContent = '';
  let fileName = '';
  let fileSize = 0;
  let fileType = '';
  let isDragging = false;
  let executionResult = null;
  let isExecuting = false;

  $: if (visible && $activeDatabaseStore) {
    selectedDbKey = $activeDatabaseStore;
  }

  function handleFileSelected(file) {
    if (!file) return;
    fileName = file.name;
    fileSize = file.size;
    fileType = file.name.endsWith('.csv') ? 'csv' : 'sql';

    const reader = new FileReader();
    reader.onload = (e) => {
      fileContent = String(e.target?.result || '');
      executionResult = null;
    };
    reader.readAsText(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    isDragging = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileSelected(file);
  }

  function handleDragOver(e) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave() {
    isDragging = false;
  }

  function handleFileInputChange(e) {
    const file = e.target?.files?.[0];
    if (file) handleFileSelected(file);
  }

  function handleLoadToEditor() {
    if (!fileContent) return;
    onLoadIntoEditor(fileContent);
    onClose();
  }

  function handleExecuteNow() {
    if (!fileContent) return;
    isExecuting = true;
    try {
      if (selectedDbKey !== $activeDatabaseStore) {
        oracleDb.connectDatabase(selectedDbKey);
      }
      onExecuteScript(fileContent, selectedDbKey);
      onClose();
    } catch (err) {
      executionResult = {
        success: false,
        message: err.message || String(err)
      };
    } finally {
      isExecuting = false;
    }
  }

  function resetFile() {
    fileContent = '';
    fileName = '';
    fileSize = 0;
    fileType = '';
    executionResult = null;
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
  <div class="import-modal-backdrop" on:click={handleBackdropClick}>
    <div class="import-modal-dialog">
      <!-- Modal Header -->
      <div class="import-modal-header">
        <div class="header-title-wrap">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <h3>Import SQL Script / Data</h3>
          <span class="badge-oracle">Oracle SQL Developer</span>
        </div>
        <button class="btn-close-modal" on:click={onClose} title="Close">✕</button>
      </div>

      <!-- Modal Body -->
      <div class="import-modal-body">
        <!-- Target Database Connection -->
        <div class="form-group-target">
          <label for="import-target-db">Target Connection / Database:</label>
          <select id="import-target-db" bind:value={selectedDbKey} class="form-select">
            {#each Object.entries($databasesStore) as [key, db]}
              <option value={key}>{db.name} ({key})</option>
            {/each}
          </select>
        </div>

        {#if !fileContent}
          <!-- File Dropzone -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div 
            class="import-dropzone" 
            class:is-dragging={isDragging}
            on:drop={handleDrop}
            on:dragover={handleDragOver}
            on:dragleave={handleDragLeave}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.8">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="12" y1="18" x2="12" y2="12"></line>
              <line x1="9" y1="15" x2="12" y2="12"></line>
              <line x1="15" y1="15" x2="12" y2="12"></line>
            </svg>
            <div class="dropzone-text">
              <p class="dropzone-title">Drag &amp; Drop your <strong>.sql</strong> or <strong>.csv</strong> file here</p>
              <p class="dropzone-subtitle">or choose a file from your computer</p>
            </div>
            <label class="btn-browse-file">
              Browse File...
              <input type="file" accept=".sql,.txt,.csv" on:change={handleFileInputChange} style="display: none;" />
            </label>
          </div>
        {:else}
          <!-- File Loaded Info Card -->
          <div class="file-info-card">
            <div class="file-info-left">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <div class="file-meta">
                <strong class="file-name">{fileName}</strong>
                <span class="file-details">
                  {(fileSize / 1024).toFixed(1)} KB • {fileContent.split('\n').length} lines
                </span>
              </div>
            </div>
            <button class="btn-change-file" on:click={resetFile} title="Choose a different file">
              Change File
            </button>
          </div>

          <!-- Live Preview Box -->
          <div class="preview-container">
            <div class="preview-header">
              <span>Script Preview</span>
              <span class="preview-hint">Will run in connection: <strong>{selectedDbKey}</strong></span>
            </div>
            <pre class="preview-box"><code>{fileContent}</code></pre>
          </div>

          {#if executionResult && !executionResult.success}
            <div class="error-banner">
              <strong>Execution Error:</strong> {executionResult.message}
            </div>
          {/if}
        {/if}
      </div>

      <!-- Modal Footer -->
      <div class="import-modal-footer">
        <button class="btn-modal-secondary" on:click={onClose}>
          Cancel
        </button>

        {#if fileContent}
          <button class="btn-modal-editor" on:click={handleLoadToEditor} title="Load into SQL Worksheet without executing">
            Open in SQL Editor
          </button>

          <button class="btn-modal-primary" on:click={handleExecuteNow} disabled={isExecuting}>
            {#if isExecuting}
              Executing...
            {:else}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span>Execute in {selectedDbKey}</span>
            {/if}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .import-modal-backdrop {
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

  .import-modal-dialog {
    background: var(--bg-surface, #ffffff);
    color: var(--text-main, #0f172a);
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 8px;
    width: 100%;
    max-width: 640px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
  }

  .import-modal-header {
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
    background: #dcfce7;
    color: #166534;
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

  .import-modal-body {
    padding: 18px 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .form-group-target {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .form-group-target label {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-muted, #475569);
    white-space: nowrap;
  }

  .form-select {
    flex: 1;
    padding: 7px 10px;
    font-size: 13px;
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 6px;
    background: var(--bg-surface, #ffffff);
    color: var(--text-main, #0f172a);
  }

  .import-dropzone {
    border: 2px dashed #93c5fd;
    border-radius: 8px;
    background: #f8faff;
    padding: 32px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    text-align: center;
    transition: all 0.2s;
  }

  .import-dropzone.is-dragging {
    border-color: #2563eb;
    background: #eff6ff;
  }

  .dropzone-title {
    margin: 0;
    font-size: 14px;
    color: var(--text-main, #1e293b);
  }

  .dropzone-subtitle {
    margin: 4px 0 0 0;
    font-size: 12px;
    color: var(--text-muted, #64748b);
  }

  .btn-browse-file {
    margin-top: 6px;
    display: inline-block;
    padding: 7px 16px;
    background: #2563eb;
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }

  .btn-browse-file:hover {
    background: #1d4ed8;
  }

  .file-info-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
  }

  .file-info-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .file-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .file-name {
    font-size: 13px;
    color: #1e3a8a;
  }

  .file-details {
    font-size: 11px;
    color: #64748b;
  }

  .btn-change-file {
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 600;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    cursor: pointer;
    color: #334155;
  }

  .btn-change-file:hover {
    background: #f1f5f9;
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

  .preview-hint {
    font-size: 11px;
    color: #2563eb;
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

  .error-banner {
    padding: 8px 12px;
    background: #fee2e2;
    border: 1px solid #fca5a5;
    border-radius: 6px;
    color: #991b1b;
    font-size: 12px;
  }

  .import-modal-footer {
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
    background: #16a34a;
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  }

  .btn-modal-primary:hover {
    background: #15803d;
  }
</style>
