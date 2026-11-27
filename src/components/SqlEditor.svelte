<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import 'monaco-editor/min/vs/editor/editor.main.css';
  import { comparisonTablesStore, tablesStore } from '../lib/db-store.js';

  export let code = '';
  export let onRun = (sql) => {};
  export let isLeftCollapsed = false;
  export let onUncollapseLeft = () => {};
  export let outputCollapsed = false;
  export let onToggleOutput = () => {};
  export let theme = 'theme-light';
  export let onOpenImport = () => {};
  export let onOpenExport = () => {};
  export let activeConnection = 'SQL_CLASS';
  export let databases = {};
  export let history = [];
  export let onSelectConnection = (name) => {};
  export let onClearHistory = () => {};
  export let onLoadHistoryItem = (sql) => {};

  let host;
  let monaco;
  let editor;
  let modelListener;
  let completionProvider;
  let inlineCompletionProvider;
  let inlineTabAction;
  let lastEditorValue = '';
  let validationLine = null;
  let validationMessage = '';
  let showHistory = false;

  function handleWindowClick(e) {
    if (showHistory && !e.target.closest('.history-dropdown-anchor')) {
      showHistory = false;
    }
  }

  function handleWindowKeydown(e) {
    if (e.key === 'Escape' && showHistory) {
      showHistory = false;
    }
  }

  const sqlKeywords = [
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
    'DELETE', 'CREATE', 'TABLE', 'VIEW', 'DROP', 'ALTER', 'TRUNCATE',
    'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN',
    'NATURAL JOIN', 'NATURAL', 'USING', 'ON',
    'GROUP BY', 'HAVING', 'ORDER BY', 'ASC', 'DESC', 'DISTINCT', 'AS',
    'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS NULL', 'IS NOT NULL',
    'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'CHECK', 'UNIQUE', 'DEFAULT',
    'UNION', 'ALL', 'INTERSECT', 'MINUS', 'COMMIT', 'ROLLBACK', 'SAVEPOINT',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'EXISTS',
    'START WITH', 'CONNECT BY', 'PRIOR',
    'SHOW', 'CON_NAME', 'CONTAINER', 'USER', 'IDENTIFIED', 'BY', 'PASSWORD',
    'TABLESPACE', 'TEMPORARY', 'QUOTA', 'UNLIMITED', 'SESSION', 'ACCOUNT',
    'LOCK', 'UNLOCK', 'EXPIRE', 'GRANT', 'REVOKE', 'CONN', 'CONNECT', 'DISCONNECT',
    'ROLE', 'CASCADE', 'ORACLE_MAINTAINED', 'DBA_USERS', 'ALL_USERS', 'USER_USERS',
    'DBA_SYS_PRIVS', 'DBA_ROLE_PRIVS', 'DBA_TAB_PRIVS', 'V$PDBS', 'SESSION_PRIVS',
    'DBA_ROLES', 'ROLE_SYS_PRIVS', 'ROLE_TAB_PRIVS', 'DBA_TS_QUOTAS'
  ];

  function getSchemaNames() {
    const tables = [
      ...Object.values(get(tablesStore)).filter(table => table.name !== 'DUAL'),
      ...get(comparisonTablesStore)
    ];
    const tableNames = [...new Set(tables.map(table => table.name))];
    const columnNames = [...new Set(tables.flatMap(table => table.columns.map(column => column.name)))];
    return { tables, tableNames, columnNames };
  }

  function getCandidates(model, position) {
    const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
    const word = model.getWordUntilPosition(position);
    const prefix = word.word;
    const tableContext = /\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+[a-zA-Z0-9_$#]*$/i.test(line);
    const { tables, tableNames, columnNames } = getSchemaNames();
    const names = tableContext ? tableNames : [...tableNames, ...columnNames];
    const candidates = [...new Set([...names, ...(tableContext ? [] : sqlKeywords)])];
    return {
      prefix,
      word,
      candidates: candidates
        .filter(name => name.toLowerCase().startsWith(prefix.toLowerCase()))
        .sort((a, b) => a.localeCompare(b)),
      tables
    };
  }

  function configureCompletions() {
    completionProvider = monaco.languages.registerCompletionItemProvider('sql', {
      triggerCharacters: ['.'],
      provideCompletionItems(model, position) {
        const { prefix, word, candidates, tables } = getCandidates(model, position);
        const range = new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn
        );
        return {
          suggestions: candidates.map(label => ({
            label,
            kind: tables.some(table => table.name === label)
              ? monaco.languages.CompletionItemKind.Class
              : sqlKeywords.includes(label)
                ? monaco.languages.CompletionItemKind.Keyword
                : monaco.languages.CompletionItemKind.Field,
            insertText: label,
            range,
            sortText: `${label.toLowerCase().startsWith(prefix.toLowerCase()) ? '0' : '1'}${label}`
          }))
        };
      }
    });

    inlineCompletionProvider = monaco.languages.registerInlineCompletionsProvider('sql', {
      provideInlineCompletions(model, position) {
        const { prefix, word, candidates } = getCandidates(model, position);
        if (!prefix) return { items: [] };
        const candidate = candidates.find(name =>
          name.toLowerCase().startsWith(prefix.toLowerCase()) &&
          name.length > prefix.length
        );
        if (!candidate) return { items: [] };
        const suggestion = prefix === prefix.toLowerCase() ? candidate.toLowerCase() : candidate;
        return {
          items: [{
            insertText: suggestion,
            range: new monaco.Range(
              position.lineNumber,
              word.startColumn,
              position.lineNumber,
              word.endColumn
            )
          }]
        };
      },
      disposeInlineCompletions() {}
    });
  }

  function to6Hex(color, fallback) {
    if (!color || typeof color !== 'string') return fallback;
    const c = color.trim();
    if (/^#?[0-9A-Fa-f]{3}$/.test(c)) {
      const raw = c.replace('#', '');
      return '#' + raw[0] + raw[0] + raw[1] + raw[1] + raw[2] + raw[2];
    }
    if (/^#?[0-9A-Fa-f]{6}$/.test(c)) {
      return c.startsWith('#') ? c : '#' + c;
    }
    const rgb = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (rgb) {
      return '#' + [rgb[1], rgb[2], rgb[3]].map(x => parseInt(x, 10).toString(16).padStart(2, '0')).join('');
    }
    return fallback;
  }

  function applyTheme() {
    if (!monaco) return;
    const styles = typeof window !== 'undefined' ? getComputedStyle(document.body) : null;
    const dark = theme === 'theme-dark';
    const themeName = dark ? 'oracle-dark' : 'oracle-light';

    const bg = to6Hex(styles?.getPropertyValue('--bg-surface'), dark ? '#111827' : '#ffffff');
    const fg = to6Hex(styles?.getPropertyValue('--text-main'), dark ? '#f9fafb' : '#0f172a');
    const subtle = to6Hex(styles?.getPropertyValue('--text-subtle'), dark ? '#6b7280' : '#94a3b8');
    const selection = dark ? '#264f78' : '#add6ff';

    monaco.editor.defineTheme(themeName, {
      base: dark ? 'vs-dark' : 'vs',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: dark ? '569CD6' : '0000FF', fontStyle: 'bold' },
        { token: 'keyword.sql', foreground: dark ? '569CD6' : '0000FF', fontStyle: 'bold' },
        { token: 'operator.sql', foreground: dark ? 'D4D4D4' : '000000' },
        { token: 'string.sql', foreground: dark ? 'CE9178' : 'A31515' },
        { token: 'number.sql', foreground: dark ? 'B5CEA8' : '098658' },
        { token: 'comment.sql', foreground: dark ? '6A9955' : '008000', fontStyle: 'italic' },
        { token: 'predefined.sql', foreground: dark ? '4EC9B0' : '267F99' }
      ],
      colors: {
        'editor.background': bg,
        'editor.foreground': fg,
        'editorLineNumber.foreground': subtle,
        'editorCursor.foreground': fg,
        'editor.selectionBackground': selection
      }
    });
    monaco.editor.setTheme(themeName);
  }

  function updateDiagnostics() {
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;

    const lines = model.getLinesContent();
    const markers = [];
    const statementStart = /^\s*(?:SELECT|INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|WITH|COMMIT|ROLLBACK|GRANT|REVOKE|SHOW|CONN|CONNECT|DISCONNECT|PASSWORD|DESC|DESCRIBE)\b/i;
    const sqlPlusCmd = /^\s*(?:CONN|CONNECT|DISCONNECT|SHOW|EXIT|QUIT|PASSWORD|DESC|DESCRIBE)\b/i;
    const continuationEnd = /(?:\b(?:SELECT|FROM|WHERE|JOIN|ON|AND|OR|BY|INTO|VALUES|SET|AS|UNION|ALL|WHEN|THEN|ELSE|CONNECT|START|,|=|\+|-|\*|\/|\.|\()\s*)$/i;
    let previousCodeLine = null;
    let previousLineNumber = 0;

    function addMissingSemicolon(lineNumber, message) {
      const column = lines[lineNumber - 1].trimEnd().length;
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message,
        startLineNumber: lineNumber,
        startColumn: Math.max(1, column),
        endLineNumber: lineNumber,
        endColumn: Math.max(2, column + 1)
      });
    }

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const code = line.replace(/--.*$/, '').trim();
      if (!code) continue;

      if (statementStart.test(code) && previousCodeLine && !previousCodeLine.endsWith(';') &&
          !continuationEnd.test(previousCodeLine) && !sqlPlusCmd.test(previousCodeLine)) {
        addMissingSemicolon(previousLineNumber, 'Missing semicolon before the next SQL statement.');
      }

      if (code.endsWith(';') || sqlPlusCmd.test(code)) {
        previousCodeLine = null;
        previousLineNumber = 0;
      } else {
        previousCodeLine = code;
        previousLineNumber = index + 1;
      }
    }

    if (previousCodeLine && !sqlPlusCmd.test(previousCodeLine)) {
      addMissingSemicolon(previousLineNumber, 'Missing semicolon at the end of this SQL statement.');
    }

    monaco.editor.setModelMarkers(model, 'sql-syntax', markers);
    validationLine = markers[0]?.startLineNumber ?? null;
    validationMessage = markers[0]?.message ?? '';
  }

  $: if (editor && code !== lastEditorValue) {
    editor.setValue(code);
    lastEditorValue = code;
    updateDiagnostics();
  }

  $: if (editor && theme) {
    applyTheme();
  }

  function handleRun() {
    let textToRun = code;
    let hasSelection = false;
    if (editor) {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        const selected = editor.getModel().getValueInRange(selection).trim();
        if (selected) {
          textToRun = selected;
          hasSelection = true;
        }
      } else {
        textToRun = editor.getValue();
      }
    }

    if (!hasSelection) {
      updateDiagnostics();
      if (validationMessage) return;
    }
    onRun(textToRun);
  }

  export function insertAtCursor(text) {
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;
    editor.executeEdits('schema-insert', [{ range: selection, text, forceMoveMarkers: true }]);
    editor.focus();
  }

  export function clearEditor() {
    if (!editor) {
      code = '';
      return;
    }
    const model = editor.getModel();
    if (!model) {
      editor.setValue('');
      editor.focus();
      return;
    }
    if (model.getValueLength() === 0) return;

    const fullRange = model.getFullModelRange();
    editor.pushUndoStop();
    editor.executeEdits('clear-editor', [{
      range: fullRange,
      text: '',
      forceMoveMarkers: true
    }]);
    editor.pushUndoStop();
    editor.focus();
  }

  export function undo() {
    if (!editor) return;
    editor.trigger('toolbar', 'undo', null);
    editor.focus();
  }

  export function redo() {
    if (!editor) return;
    editor.trigger('toolbar', 'redo', null);
    editor.focus();
  }

  export function setCode(newCode) {
    code = newCode;
    if (editor) {
      const model = editor.getModel();
      if (model) {
        const fullRange = model.getFullModelRange();
        editor.pushUndoStop();
        editor.executeEdits('set-code', [{
          range: fullRange,
          text: newCode,
          forceMoveMarkers: true
        }]);
        editor.pushUndoStop();
      } else {
        editor.setValue(newCode);
      }
      editor.focus();
    }
  }

  export function getCode() {
    return editor ? editor.getValue() : code;
  }

  onMount(() => {
    let disposed = false;
    async function initializeEditor() {
      const [monacoModule, workerModule] = await Promise.all([
        import('monaco-editor/esm/vs/editor/editor.api.js'),
        import('monaco-editor/esm/vs/editor/editor.worker?worker'),
        import('monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js'),
        import('monaco-editor/esm/vs/editor/browser/coreCommands.js'),
        import('monaco-editor/esm/vs/editor/contrib/linesOperations/browser/linesOperations.js'),
        import('monaco-editor/esm/vs/editor/contrib/inlineCompletions/browser/inlineCompletions.contribution.js'),
        import('monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController.js'),
        import('monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestInlineCompletions.js')
      ]);
      if (disposed) return;
      monaco = monacoModule;
      globalThis.MonacoEnvironment = {
        getWorker() {
          return new workerModule.default();
        }
      };

      applyTheme();
      lastEditorValue = code;
      editor = monaco.editor.create(host, {
        value: code,
        language: 'sql',
        theme: theme === 'theme-dark' ? 'oracle-dark' : 'oracle-light',
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        fontFamily: "'Fira Code', Consolas, monospace",
        fontSize: 13,
        lineHeight: 21,
        padding: { top: 10, bottom: 10 },
        quickSuggestions: { other: false, comments: false, strings: false },
        suggestOnTriggerCharacters: false,
        inlineSuggest: { enabled: true, mode: 'prefix', showToolbar: 'never' },
        acceptSuggestionOnEnter: 'on',
        tabCompletion: 'on',
        accessibilitySupport: 'auto'
      });

      // Explicitly register Ctrl+Z (Undo) and Ctrl+Y / Ctrl+Shift+Z (Redo)
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => {
        editor.trigger('keyboard', 'undo', null);
      });
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY, () => {
        editor.trigger('keyboard', 'redo', null);
      });
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ, () => {
        editor.trigger('keyboard', 'redo', null);
      });

      modelListener = editor.onDidChangeModelContent(() => {
        code = editor.getValue();
        lastEditorValue = code;
        updateDiagnostics();
      });
      updateDiagnostics();
      configureCompletions();
      inlineTabAction = editor.addAction({
        id: 'sql.acceptInlineSuggestion',
        label: 'Accept inline suggestion',
        keybindings: [monaco.KeyCode.Tab],
        precondition: 'inlineSuggestionVisible',
        keybindingContext: 'editorTextFocus',
        run: () => editor.getAction('editor.action.inlineSuggest.commit')?.run()
      });
    }

    initializeEditor().catch(error => {
      console.error('Failed to initialize SQL editor', error);
      if (host) host.textContent = 'The SQL editor failed to load. Reload the page to try again.';
    });
    return () => {
      disposed = true;
      modelListener?.dispose();
      completionProvider?.dispose();
      inlineCompletionProvider?.dispose();
      inlineTabAction?.dispose();
      editor?.dispose();
    };
  });
</script>

<svelte:window on:click={handleWindowClick} on:keydown={handleWindowKeydown} />

<div class="editor-section">
  <div class="section-toolbar">
    <div class="toolbar-left">
      {#if isLeftCollapsed}
        <button class="pane-collapse-btn" on:click={onUncollapseLeft} title="Show Schema Sidebar">
          &rsaquo;
        </button>
      {/if}

      <!-- Connection Worksheet Tabs -->
      <div class="worksheet-tabs" role="tablist" aria-label="Connection Worksheets">
        {#each Object.entries(databases || {}) as [dbKey, dbObj]}
          {@const isActive = (activeConnection || '').toUpperCase() === dbKey.toUpperCase()}
          <button
            class="worksheet-tab"
            class:active={isActive}
            role="tab"
            aria-selected={isActive}
            on:click={() => onSelectConnection(dbKey)}
            title="Switch to {dbObj.name || dbKey} worksheet"
          >
            <span class="tab-conn-indicator" class:connected={isActive}>●</span>
            <span class="tab-conn-name">{dbObj.name || dbKey}</span>
            <span class="tab-label-sub">sql</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="toolbar-right">
      <button class="btn btn-run-sql" on:click={handleRun}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        <span>Run</span>
      </button>

      <div class="toolbar-separator"></div>

      <!-- Script History Button with Dropdown -->
      <div class="history-dropdown-anchor">
        <button
          class="btn-tool-icon btn-history-btn"
          class:active={showHistory}
          on:click|stopPropagation={() => showHistory = !showHistory}
          title="Script History ({activeConnection})"
          aria-label="Script History for {activeConnection}"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          {#if history && history.length > 0}
            <span class="history-badge">{history.length}</span>
          {/if}
        </button>

        {#if showHistory}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="history-popup-card" on:click|stopPropagation>
            <div class="history-popup-header">
              <div class="history-popup-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>History: <strong>{activeConnection}</strong></span>
              </div>
              <div class="history-popup-actions">
                {#if history && history.length > 0}
                  <button class="btn-clear-history" on:click={onClearHistory} title="Clear history for this connection">
                    Clear
                  </button>
                {/if}
                <button class="history-close-btn" on:click={() => showHistory = false} title="Close">✕</button>
              </div>
            </div>

            <div class="history-list">
              {#if !history || history.length === 0}
                <div class="history-empty">
                  <p>No queries executed on <strong>{activeConnection}</strong> yet.</p>
                  <small>When you run SQL statements here, their history will be recorded for this connection.</small>
                </div>
              {:else}
                {#each history as item (item.id)}
                  <div class="history-item">
                    <div class="history-item-top">
                      <span class="history-time">{item.timestamp}</span>
                      <span class="history-status" class:err={item.hasError} class:ok={!item.hasError}>
                        {item.status}
                      </span>
                    </div>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                    <pre class="history-sql-preview" on:click={() => { onLoadHistoryItem(item.sql); showHistory = false; }} title="Click to load into editor">{item.sql}</pre>
                    <div class="history-item-actions">
                      <button 
                        class="btn-history-load" 
                        on:click={() => { onLoadHistoryItem(item.sql); showHistory = false; }}
                        title="Load into Editor"
                      >
                        Load into Editor
                      </button>
                      <button 
                        class="btn-history-copy" 
                        on:click={() => navigator.clipboard?.writeText(item.sql)}
                        title="Copy SQL"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <button
        class="btn-tool-icon"
        class:active={outputCollapsed}
        on:click={onToggleOutput}
        title={outputCollapsed ? 'Show Output' : 'Hide Output'}
        aria-label={outputCollapsed ? 'Show Output' : 'Hide Output'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="16" rx="2"></rect>
          <line x1="3" y1="13" x2="21" y2="13"></line>
          <line x1="8" y1="8.5" x2="16" y2="8.5"></line>
          <line x1="8" y1="17" x2="16" y2="17"></line>
        </svg>
      </button>

      <button class="btn-tool-icon" on:click={onOpenImport} title="Import SQL File (*.sql)..." aria-label="Import SQL File">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      </button>

      <button class="btn-tool-icon" on:click={onOpenExport} title="Export SQL Script (*.sql)..." aria-label="Export SQL Script">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
      </button>

      <button class="btn-tool-icon" on:click={undo} title="Undo (Ctrl+Z)" aria-label="Undo">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 7v6h6"></path>
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
        </svg>
      </button>

      <button class="btn-tool-icon" on:click={redo} title="Redo (Ctrl+Y)" aria-label="Redo">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 7v6h-6"></path>
          <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"></path>
        </svg>
      </button>

      <button class="btn-tool-icon" on:click={clearEditor} title="Clear Editor (Undoable with Ctrl+Z)" aria-label="Clear Editor">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  </div>

  {#if validationMessage}
    <div class="sql-inline-diagnostic" role="alert">
      Line {validationLine}: {validationMessage}
    </div>
  {/if}

  <div class="editor-mount">
    <div class="monaco-editor-host" bind:this={host}></div>
  </div>
</div>
