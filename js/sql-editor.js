/**
 * SQL Editor Component with Syntax Highlighting, Line Numbers, 
 * Selection Detection, and Oracle SQL Autocomplete/Shortcuts
 */

class SqlEditor {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = Object.assign({
      initialValue: '',
      onSelectionChange: null,
      onRunQuery: null,
      onRunSelected: null
    }, options);

    this.initDOM();
    this.bindEvents();
    if (this.options.initialValue) {
      this.setValue(this.options.initialValue);
    }
  }

  initDOM() {
    this.container.classList.add('sql-editor-wrapper');
    this.container.innerHTML = `
      <div class="sql-editor-gutter">
        <div class="line-numbers">1</div>
      </div>
      <div class="sql-editor-content">
        <pre class="sql-editor-highlight" aria-hidden="true"><code></code></pre>
        <textarea class="sql-editor-textarea" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="-- Enter Oracle SQL statements here...&#10;SELECT * FROM students;"></textarea>
      </div>
    `;

    this.gutter = this.container.querySelector('.line-numbers');
    this.textarea = this.container.querySelector('.sql-editor-textarea');
    this.highlightCode = this.container.querySelector('.sql-editor-highlight code');
    this.highlightPre = this.container.querySelector('.sql-editor-highlight');
  }

  bindEvents() {
    // Synchronize scrolling between textarea and highlight pre
    this.textarea.addEventListener('scroll', () => {
      this.highlightPre.scrollTop = this.textarea.scrollTop;
      this.highlightPre.scrollLeft = this.textarea.scrollLeft;
      this.gutter.scrollTop = this.textarea.scrollTop;
    });

    // Input event for re-highlighting and line numbering
    this.textarea.addEventListener('input', () => {
      this.updateHighlight();
      this.updateLineNumbers();
    });

    // Keyboard handling (Tabs, Shortcuts)
    this.textarea.addEventListener('keydown', (e) => {
      // Tab key indentation
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const val = this.textarea.value;

        if (e.shiftKey) {
          // Unindent
          const lineStart = val.lastIndexOf('\n', start - 1) + 1;
          if (val.substr(lineStart, 2) === '  ') {
            this.textarea.value = val.substring(0, lineStart) + val.substring(lineStart + 2);
            this.textarea.selectionStart = this.textarea.selectionEnd = Math.max(lineStart, start - 2);
          }
        } else {
          // Indent 2 spaces
          this.textarea.value = val.substring(0, start) + '  ' + val.substring(end);
          this.textarea.selectionStart = this.textarea.selectionEnd = start + 2;
        }

        this.updateHighlight();
        this.updateLineNumbers();
        this.notifySelection();
        return;
      }

      // Ctrl + Enter or F9 (Standard Oracle SQL Developer execute)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          // Ctrl + Shift + Enter -> Run All
          if (this.options.onRunQuery) this.options.onRunQuery(this.getValue());
        } else {
          // Ctrl + Enter -> Run Selected or Current statement
          const sel = this.getSelectedText();
          if (sel && sel.trim()) {
            if (this.options.onRunSelected) this.options.onRunSelected(sel);
          } else {
            const current = this.getCurrentStatement();
            if (this.options.onRunSelected) this.options.onRunSelected(current || this.getValue());
          }
        }
        return;
      }

      if (e.key === 'F9') {
        e.preventDefault();
        const sel = this.getSelectedText();
        if (sel && sel.trim()) {
          if (this.options.onRunSelected) this.options.onRunSelected(sel);
        } else {
          if (this.options.onRunQuery) this.options.onRunQuery(this.getValue());
        }
      }
    });

    // Selection changes
    const checkSelection = () => {
      this.notifySelection();
    };

    this.textarea.addEventListener('keyup', checkSelection);
    this.textarea.addEventListener('mouseup', checkSelection);
    this.textarea.addEventListener('select', checkSelection);
    document.addEventListener('selectionchange', () => {
      if (document.activeElement === this.textarea) {
        checkSelection();
      }
    });
  }

  notifySelection() {
    const text = this.getSelectedText();
    const hasSelection = text && text.trim().length > 0;
    if (this.options.onSelectionChange) {
      this.options.onSelectionChange({
        hasSelection: hasSelection,
        selectedText: text,
        selectionStart: this.textarea.selectionStart,
        selectionEnd: this.textarea.selectionEnd
      });
    }
  }

  getValue() {
    return this.textarea.value;
  }

  setValue(val) {
    this.textarea.value = val;
    this.updateHighlight();
    this.updateLineNumbers();
    this.notifySelection();
  }

  getSelectedText() {
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    if (start === end) return '';
    return this.textarea.value.substring(start, end);
  }

  getCurrentStatement() {
    const val = this.textarea.value;
    const pos = this.textarea.selectionStart;
    
    // Find previous semicolon before cursor or start of text
    let prevSemi = val.lastIndexOf(';', pos - 1);
    if (prevSemi === -1) prevSemi = 0;
    else prevSemi += 1;

    // Find next semicolon after cursor or end of text
    let nextSemi = val.indexOf(';', pos);
    if (nextSemi === -1) nextSemi = val.length;

    const stmt = val.substring(prevSemi, nextSemi).trim();
    return stmt;
  }

  insertAtCursor(text) {
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const val = this.textarea.value;

    this.textarea.value = val.substring(0, start) + text + val.substring(end);
    this.textarea.selectionStart = this.textarea.selectionEnd = start + text.length;
    this.textarea.focus();

    this.updateHighlight();
    this.updateLineNumbers();
    this.notifySelection();
  }

  updateLineNumbers() {
    const lines = this.textarea.value.split('\n').length;
    let numbersHtml = '';
    for (let i = 1; i <= lines; i++) {
      numbersHtml += `<div>${i}</div>`;
    }
    this.gutter.innerHTML = numbersHtml;
  }

  updateHighlight() {
    const code = this.textarea.value;
    this.highlightCode.innerHTML = this.highlightSQL(code) + '\n';
  }

  highlightSQL(code) {
    if (!code) return '';

    // HTML escape
    let escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Token placeholder mapping to avoid regex collisions
    const tokens = [];
    const saveToken = (cls, content) => {
      const id = `___TOKEN_${tokens.length}___`;
      tokens.push({ id, html: `<span class="${cls}">${content}</span>` });
      return id;
    };

    // 1. Strings: '...'
    escaped = escaped.replace(/'(?:[^'\\]|\\.)*'/g, (m) => saveToken('hl-string', m));

    // 2. Comments: -- single line and /* block */
    escaped = escaped.replace(/--.*$/gm, (m) => saveToken('hl-comment', m));
    escaped = escaped.replace(/\/\*[\s\S]*?\*\//g, (m) => saveToken('hl-comment', m));

    // 3. Oracle Keywords
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

    // 4. Oracle Data Types
    const types = [
      'NUMBER', 'VARCHAR2', 'VARCHAR', 'CHAR', 'DATE', 'TIMESTAMP',
      'CLOB', 'BLOB', 'FLOAT', 'INTEGER', 'BOOLEAN', 'RAW', 'LONG',
      'ROWID', 'UROWID', 'NVARCHAR2', 'NCHAR'
    ];
    const typeRegex = new RegExp(`\\b(${types.join('|')})\\b`, 'gi');
    escaped = escaped.replace(typeRegex, (m) => saveToken('hl-type', m));

    // 5. Oracle Built-in Functions
    const funcs = [
      'NVL', 'NVL2', 'DECODE', 'COALESCE', 'NULLIF',
      'UPPER', 'LOWER', 'INITCAP', 'LENGTH', 'SUBSTR', 'INSTR', 'TRIM', 'LTRIM', 'RTRIM', 'LPAD', 'RPAD', 'REPLACE',
      'ROUND', 'TRUNC', 'MOD', 'ABS', 'CEIL', 'FLOOR', 'POWER', 'SQRT',
      'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CONCAT',
      'TO_CHAR', 'TO_DATE', 'TO_NUMBER'
    ];
    const funcRegex = new RegExp(`\\b(${funcs.join('|')})(?=\\s*\\()`, 'gi');
    escaped = escaped.replace(funcRegex, (m) => saveToken('hl-func', m));

    // 6. Numbers
    escaped = escaped.replace(/\b\d+(\.\d+)?\b/g, (m) => saveToken('hl-number', m));

    // 7. Operators & Punctuation
    escaped = escaped.replace(/(\|\||&lt;=|&gt;=|!=|&lt;&gt;|&lt;|&gt;|=|\+|-|\*|\/)/g, (m) => saveToken('hl-operator', m));

    // Restore tokens
    for (let i = tokens.length - 1; i >= 0; i--) {
      escaped = escaped.replace(tokens[i].id, tokens[i].html);
    }

    return escaped;
  }
}

if (typeof window !== 'undefined') {
  window.SqlEditor = SqlEditor;
}

