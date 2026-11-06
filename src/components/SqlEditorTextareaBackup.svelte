<!-- Retained as a fallback for the original textarea-based editor. -->
<script>
  import { onMount, tick } from 'svelte';
  import { get } from 'svelte/store';
  import { comparisonTablesStore, tablesStore } from '../lib/db-store.js';

  export let code = '';
  export let onRun = (sql) => {};
  export let isLeftCollapsed = false;
  export let onUncollapseLeft = () => {};
  export let outputCollapsed = false;
  export let onToggleOutput = () => {};

  let textarea;
  let highlightPre;
  let gutter;
  let suggestions = [];
  let activeSuggestion = 0;
  let suggestionRange = null;
  let history = [];
  let historyIndex = -1;
  const MAX_HISTORY = 200;

  $: lineCount = (code || '').split('\n').length;
  $: highlightedHtml = highlightSQL(code);

  onMount(() => {
    history = [{ value: textarea.value, start: textarea.selectionStart, end: textarea.selectionEnd }];
    historyIndex = 0;
  });

  function syncScroll() {
    if (!textarea || !highlightPre || !gutter) return;
    highlightPre.scrollTop = textarea.scrollTop;
    highlightPre.scrollLeft = textarea.scrollLeft;
    gutter.scrollTop = textarea.scrollTop;
  }

  function rememberEdit() {
    if (!textarea) return;
    const snapshot = {
      value: textarea.value,
      start: textarea.selectionStart,
      end: textarea.selectionEnd
    };
    if (history[historyIndex]?.value === snapshot.value) {
      history[historyIndex] = snapshot;
      return;
    }
    history = history.slice(0, historyIndex + 1);
    history.push(snapshot);
    if (history.length > MAX_HISTORY) history.shift();
    historyIndex = history.length - 1;
  }

  function handleInput() {
    code = textarea.value;
    rememberEdit();
    updateSuggestions();
  }

  function applyHistory(index) {
    if (index < 0 || index >= history.length) return;
    historyIndex = index;
    const snapshot = history[historyIndex];
    code = snapshot.value;
    suggestions = [];
    tick().then(() => {
      textarea.setSelectionRange(snapshot.start, snapshot.end);
      textarea.focus();
    });
  }

  function applyEdit(value, start, end = start) {
    code = value;
    suggestions = [];
    tick().then(() => {
      textarea.setSelectionRange(start, end);
      textarea.focus();
      rememberEdit();
    });
  }

  function moveCurrentLine(direction, duplicate = false) {
    const lines = textarea.value.split('\n');
    const caret = textarea.selectionStart;
    const lineIndex = textarea.value.slice(0, caret).split('\n').length - 1;
    const column = caret - (textarea.value.lastIndexOf('\n', caret - 1) + 1);
    const targetIndex = lineIndex + direction;
    if (!duplicate && (targetIndex < 0 || targetIndex >= lines.length)) return;

    const currentLine = lines[lineIndex];
    if (duplicate) {
      lines.splice(direction < 0 ? lineIndex : lineIndex + 1, 0, currentLine);
    } else {
      lines.splice(lineIndex, 1);
      lines.splice(targetIndex, 0, currentLine);
    }

    const nextLineIndex = duplicate && direction > 0 ? lineIndex + 1 : targetIndex;
    const nextValue = lines.join('\n');
    const nextCaret = lines.slice(0, nextLineIndex).reduce((length, line) => length + line.length + 1, 0)
      + Math.min(column, currentLine.length);
    applyEdit(nextValue, nextCaret);
  }

  function getSuggestions(prefix, tableContext) {
    const tables = [
      ...Object.values(get(tablesStore)).filter(table => table.name !== 'DUAL'),
      ...get(comparisonTablesStore)
    ];
    const tableNames = tables.map(table => table.name);
    const columnNames = tables.flatMap(table => table.columns.map(column => column.name));
    const candidates = tableContext ? tableNames : [...tableNames, ...columnNames];
    const uniqueCandidates = [...new Set(candidates)];
    return uniqueCandidates
      .filter(name => name.toLowerCase().startsWith(prefix.toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 12);
  }

  function updateSuggestions() {
    const caret = textarea.selectionStart;
    const beforeCaret = textarea.value.slice(0, caret);
    const wordMatch = beforeCaret.match(/[a-zA-Z0-9_$#]*$/);
    const prefix = wordMatch ? wordMatch[0] : '';
    const tableContext = /\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+[a-zA-Z0-9_$#]*$/i.test(beforeCaret);
    if (!prefix && !tableContext) {
      suggestions = [];
      suggestionRange = null;
      return;
    }
    const nextSuggestions = getSuggestions(prefix, tableContext);
    suggestions = nextSuggestions;
    suggestionRange = nextSuggestions.length
      ? { start: caret - prefix.length, end: caret }
      : null;
    activeSuggestion = 0;
  }

  function acceptSuggestion(name = suggestions[activeSuggestion]) {
    if (!name || !suggestionRange) return;
    const value = textarea.value;
    const nextValue = value.slice(0, suggestionRange.start) + name + value.slice(suggestionRange.end);
    const caret = suggestionRange.start + name.length;
    applyEdit(nextValue, caret);
  }

  function getSuggestionType(name) {
    const tables = [
      ...Object.values(get(tablesStore)),
      ...get(comparisonTablesStore)
    ];
    return tables.some(table => table.name === name) ? 'table' : 'column';
  }

  function handleKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      applyHistory(historyIndex - (e.shiftKey ? -1 : 1));
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      applyHistory(historyIndex + 1);
      return;
    }
    if (suggestions.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      activeSuggestion = (activeSuggestion + step + suggestions.length) % suggestions.length;
      return;
    }
    if (suggestions.length && (e.key === 'Enter' || e.key === 'Tab')) {
      e.preventDefault();
      acceptSuggestion();
      return;
    }
    if (e.key === 'Escape' && suggestions.length) {
      e.preventDefault();
      suggestions = [];
      return;
    }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      moveCurrentLine(e.key === 'ArrowUp' ? -1 : 1, e.shiftKey);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      const value = textarea.value;
      const lines = value.split('\n');
      const caret = textarea.selectionStart;
      const lineIndex = value.slice(0, caret).split('\n').length - 1;
      const currentLine = lines[lineIndex];
      const indentation = currentLine.match(/^\s*/)[0];
      lines.splice(lineIndex + 1, 0, indentation);
      const nextCaret = lines.slice(0, lineIndex + 1).reduce((length, line) => length + line.length + 1, 0)
        + indentation.length;
      applyEdit(lines.join('\n'), nextCaret);
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      if (e.shiftKey) {
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        if (val.slice(lineStart, lineStart + 2) === '  ') {
          applyEdit(val.slice(0, lineStart) + val.slice(lineStart + 2), Math.max(lineStart, start - 2));
        }
      } else {
        applyEdit(val.slice(0, start) + '  ' + val.slice(end), start + 2);
      }
      return;
    }
  }

  function handleKeyup(e) {
    if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) updateSuggestions();
  }

  function handleRun() {
    onRun(code);
  }

  export function insertAtCursor(text) {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    applyEdit(textarea.value.slice(0, start) + text + textarea.value.slice(end), start + text.length);
  }

  export function clearEditor() {
    applyEdit('', 0);
  }

  function highlightSQL(str) {
    if (!str) return '';

    let escaped = str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const tokens = [];
    const saveToken = (cls, content) => {
      const id = `___TOKEN_${tokens.length}___`;
      tokens.push({ id, html: `<span class="${cls}">${content}</span>` });
      return id;
    };

    // Strings
    escaped = escaped.replace(/'(?:[^'\\]|\\.)*'/g, (m) => saveToken('hl-string', m));

    // Comments
    escaped = escaped.replace(/--.*$/gm, (m) => saveToken('hl-comment', m));
    escaped = escaped.replace(/\/\*[\s\S]*?\*\//g, (m) => saveToken('hl-comment', m));

    // Keywords
    const keywords = [
      'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
      'DELETE', 'CREATE', 'TABLE', 'VIEW', 'DROP', 'ALTER', 'TRUNCATE',
      'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS', 'NATURAL', 'USING', 'ON',
      'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'FETCH', 'FIRST',
      'ROWS', 'ONLY', 'DISTINCT', 'AS', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN',
      'LIKE', 'IS', 'NULL', 'PRIMARY', 'KEY', 'CONSTRAINT', 'FOREIGN',
      'REFERENCES', 'CHECK', 'UNIQUE', 'DEFAULT',
      'UNION', 'ALL', 'INTERSECT', 'MINUS', 'COMMIT', 'ROLLBACK', 'SAVEPOINT',
      'DESC', 'DESCRIBE', 'ADD', 'MODIFY', 'RENAME', 'COLUMN', 'PURGE', 'CASCADE', 'CONSTRAINTS',
      'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'EXISTS', 'ANY', 'SOME', 'ALL',
      'START', 'WITH', 'CONNECT', 'PRIOR', 'OVER', 'PARTITION',
      'INDEX', 'SEQUENCE', 'TRIGGER', 'PROCEDURE', 'FUNCTION', 'PACKAGE',
      'BEGIN', 'DECLARE', 'EXCEPTION', 'LOOP', 'WHILE', 'FOR', 'EXIT', 'EXEC', 'EXECUTE',
      'MERGE', 'MATCHED', 'GRANT', 'REVOKE', 'REPLACE', 'ESCAPE',
      'DUAL', 'ROWNUM', 'ROWID', 'SYSDATE'
    ];
    const kwRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
    escaped = escaped.replace(kwRegex, (m) => saveToken('hl-keyword', m));

    // Types
    const types = [
      'NUMBER', 'VARCHAR2', 'VARCHAR', 'CHAR', 'DATE', 'TIMESTAMP',
      'CLOB', 'BLOB', 'FLOAT', 'INTEGER', 'BOOLEAN', 'RAW', 'LONG',
      'ROWID', 'UROWID', 'NVARCHAR2', 'NCHAR'
    ];
    const typeRegex = new RegExp(`\\b(${types.join('|')})\\b`, 'gi');
    escaped = escaped.replace(typeRegex, (m) => saveToken('hl-type', m));

    // Functions
    const funcs = [
      'NVL', 'NVL2', 'DECODE', 'COALESCE', 'NULLIF',
      'UPPER', 'LOWER', 'INITCAP', 'LENGTH', 'SUBSTR', 'INSTR', 'TRIM', 'LTRIM', 'RTRIM', 'LPAD', 'RPAD', 'REPLACE',
      'ROUND', 'TRUNC', 'MOD', 'ABS', 'CEIL', 'FLOOR', 'POWER', 'SQRT',
      'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CONCAT',
      'TO_CHAR', 'TO_DATE', 'TO_NUMBER'
    ];
    const funcRegex = new RegExp(`\\b(${funcs.join('|')})(?=\\s*\\()`, 'gi');
    escaped = escaped.replace(funcRegex, (m) => saveToken('hl-func', m));

    // Numbers
    escaped = escaped.replace(/\b\d+(\.\d+)?\b/g, (m) => saveToken('hl-number', m));

    // Operators
    escaped = escaped.replace(/(\|\||&lt;=|&gt;=|!=|&lt;&gt;|&lt;|&gt;|=|\+|-|\*|\/)/g, (m) => saveToken('hl-operator', m));

    for (let i = tokens.length - 1; i >= 0; i--) {
      escaped = escaped.replace(tokens[i].id, tokens[i].html);
    }

    return escaped;
  }
</script>

<div class="editor-section">
  <div class="section-toolbar">
    <div class="toolbar-left">
      {#if isLeftCollapsed}
        <button class="pane-collapse-btn" on:click={onUncollapseLeft} title="Show Schema Sidebar">
          &rsaquo;
        </button>
      {/if}
      <span class="section-heading">Input</span>
    </div>

    <div class="toolbar-right">
      <button class="btn btn-run-sql" on:click={handleRun}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        <span>Run</span>
      </button>

      <div class="toolbar-separator"></div>

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

      <button class="btn-tool-icon" on:click={clearEditor} title="Clear Editor">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  </div>

  <div class="editor-mount">
    <div class="sql-editor-wrapper">
      <div class="sql-editor-gutter">
        <div class="line-numbers" bind:this={gutter}>
          {#each Array(lineCount) as _, i}
            <div>{i + 1}</div>
          {/each}
        </div>
      </div>
      <div class="sql-editor-content">
        <pre class="sql-editor-highlight" bind:this={highlightPre} aria-hidden="true"><code>{@html highlightedHtml}
</code></pre>
        {#if suggestions.length > 0}
          <div class="sql-suggestions" role="listbox" aria-label="SQL suggestions">
            {#each suggestions as suggestion, index}
              <button
                type="button"
                class:active={index === activeSuggestion}
                role="option"
                aria-selected={index === activeSuggestion}
                on:mousedown|preventDefault={() => {}}
                on:click={() => acceptSuggestion(suggestion)}
              >
                <span>{suggestion}</span>
                <small>{getSuggestionType(suggestion)}</small>
              </button>
            {/each}
          </div>
        {/if}
        <textarea 
          class="sql-editor-textarea" 
          bind:this={textarea}
          bind:value={code}
          on:scroll={syncScroll}
          on:keydown={handleKeydown}
          on:input={handleInput}
          on:keyup={handleKeyup}
          spellcheck="false" 
          autocomplete="off" 
          autocapitalize="off" 
          placeholder="-- Write Oracle SQL here...&#10;"
        ></textarea>
      </div>
    </div>
  </div>
</div>
