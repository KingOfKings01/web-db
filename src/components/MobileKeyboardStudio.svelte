<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { tablesStore } from '../lib/db-store.js';

  export let code = '';
  export let theme = 'theme-light';
  export let onRun = (sql) => {};
  export let queryResults = [];
  export let queryStatus = 'Ready';
  export let onToggleTheme = () => {};
  export let onExitMobile = () => {};

  let textareaEl;
  let hlEl;
  let gutEl;
  let devEl;
  let showOutput = false;
  let hideKeyboard = false;
  let capsLock = false;

  const LAYOUT_STORAGE_KEY = 'ORACLE_STUDIO_VIEW_MODE_V1';

  // Orientation / Layout mode: 'landscape' | 'vertical'
  export let layoutMode = 'landscape';
  export let onSwitchLayout = () => {};
  let showModePrompt = false;
  let isFullscreen = false;

  let currentSuggestions = [];
  let selectedCategory = 'auto';
  let activeTableTab = 'courses';
  let showTablePreviewModal = false;
  let previewTableName = 'courses';
  let showViewMenu = false;

  $: if (schemaInfo && schemaInfo.tableNames && schemaInfo.tableNames.length > 0) {
    if (!activeTableTab || !schemaInfo.tableNames.includes(activeTableTab)) {
      activeTableTab = schemaInfo.tableNames[0];
    }
  }

  function getTableColumns(tableName) {
    if (!$tablesStore || !$tablesStore[tableName]) return [];
    return $tablesStore[tableName].columns || [];
  }

  function openTablePreview(tableName) {
    previewTableName = tableName || activeTableTab || (schemaInfo && schemaInfo.tableNames && schemaInfo.tableNames[0]) || 'courses';
    showTablePreviewModal = true;
  }

  function closeTablePreview() {
    showTablePreviewModal = false;
  }

  // Key repeat timer
  let repeatTimer = null;

  const SQL_CATEGORIES = [
    { id: 'auto', name: '⚡ Suggestions' },
    { id: 'dql', name: 'DQL' },
    { id: 'dml', name: 'DML' },
    { id: 'ddl', name: 'DDL' },
    { id: 'dcl', name: 'DCL' },
    { id: 'tcl', name: 'TCL' },
    { id: 'math', name: 'Math Func' },
    { id: 'regex', name: 'REGEX Func' },
    { id: 'agg', name: 'Aggregate' },
    { id: 'string', name: 'String Func' },
    { id: 'date', name: 'Date Func' },
    { id: 'gen', name: 'General Func' },
    { id: 'tables', name: 'Tables' },
    { id: 'cols', name: 'Columns' }
  ];

  const DQL_ITEMS = [
    'SELECT', '*', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'ASC', 'DESC',
    'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'ON', 'DISTINCT', 'AS',
    'UNION', 'UNION ALL', 'INTERSECT', 'MINUS', 'FETCH FIRST', 'ROWS ONLY',
    'BETWEEN', 'IN', 'LIKE', 'AND', 'OR', 'NOT', 'IS NULL', 'IS NOT NULL'
  ].map(t => ({ t, k: 'kw' }));

  const DML_ITEMS = [
    'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'MERGE INTO',
    'WHEN MATCHED THEN', 'WHEN NOT MATCHED THEN'
  ].map(t => ({ t, k: 'kw' }));

  const DDL_ITEMS = [
    'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'TRUNCATE TABLE',
    'CREATE VIEW', 'DROP VIEW', 'ADD', 'MODIFY', 'RENAME TO',
    'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'UNIQUE', 'CHECK', 'NOT NULL',
    'DEFAULT', 'VARCHAR2(30)', 'NUMBER', 'DATE'
  ].map(t => ({ t, k: 'kw' }));

  const DCL_ITEMS = [
    'GRANT', 'REVOKE', 'ALL PRIVILEGES', 'SELECT ON', 'INSERT ON',
    'UPDATE ON', 'DELETE ON', 'TO', 'FROM', 'PUBLIC'
  ].map(t => ({ t, k: 'kw' }));

  const TCL_ITEMS = [
    'COMMIT', 'ROLLBACK', 'ROLLBACK TO', 'SAVEPOINT'
  ].map(t => ({ t, k: 'kw' }));

  const MATH_ITEMS = [
    'ROUND(', 'TRUNC(', 'MOD(', 'ABS(', 'FLOOR(', 'CEIL(', 'POWER(', 'SQRT(', 'SIGN('
  ].map(t => ({ t, k: 'fn' }));

  const REGEX_ITEMS = [
    'REGEXP_LIKE(', 'REGEXP_SUBSTR(', 'REGEXP_INSTR(', 'REGEXP_REPLACE(', 'REGEXP_COUNT('
  ].map(t => ({ t, k: 'fn' }));

  const AGG_ITEMS = [
    'COUNT(*)', 'COUNT(', 'SUM(', 'AVG(', 'MAX(', 'MIN('
  ].map(t => ({ t, k: 'fn' }));

  const STRING_ITEMS = [
    'UPPER(', 'LOWER(', 'INITCAP(', 'SUBSTR(', 'LENGTH(', 'CONCAT(', 'TRIM(', 'REPLACE(', 'INSTR(', 'LPAD(', 'RPAD('
  ].map(t => ({ t, k: 'fn' }));

  const DATE_ITEMS = [
    'SYSDATE', 'CURRENT_DATE', 'ADD_MONTHS(', 'MONTHS_BETWEEN(', 'NEXT_DAY(', 'LAST_DAY(', 'EXTRACT('
  ].map(t => ({ t, k: t.endsWith('(') ? 'fn' : 'kw' }));

  const GEN_ITEMS = [
    'NVL(', 'NVL2(', 'COALESCE(', 'DECODE(', 'NULLIF(', 'TO_CHAR(', 'TO_NUMBER(', 'TO_DATE(',
    'CASE WHEN', 'THEN', 'ELSE', 'END'
  ].map(t => ({ t, k: t.endsWith('(') ? 'fn' : 'kw' }));

  const ALL_SUGGESTION_ITEMS = [
    ...DQL_ITEMS,
    ...DML_ITEMS,
    ...DDL_ITEMS,
    ...DCL_ITEMS,
    ...TCL_ITEMS,
    ...MATH_ITEMS,
    ...REGEX_ITEMS,
    ...AGG_ITEMS,
    ...STRING_ITEMS,
    ...DATE_ITEMS,
    ...GEN_ITEMS
  ];

  $: displayedChips = (() => {
    switch (selectedCategory) {
      case 'dql': return DQL_ITEMS;
      case 'dml': return DML_ITEMS;
      case 'ddl': return DDL_ITEMS;
      case 'dcl': return DCL_ITEMS;
      case 'tcl': return TCL_ITEMS;
      case 'math': return MATH_ITEMS;
      case 'regex': return REGEX_ITEMS;
      case 'agg': return AGG_ITEMS;
      case 'string': return STRING_ITEMS;
      case 'date': return DATE_ITEMS;
      case 'gen': return GEN_ITEMS;
      case 'tables': {
        const curTb = activeTableTab || (schemaInfo && schemaInfo.tableNames && schemaInfo.tableNames[0]) || 'courses';
        const cols = getTableColumns(curTb).map(c => ({
          t: c.name.toLowerCase(),
          k: 'cl',
          badge: c.type.toLowerCase(),
          isPk: c.isPk
        }));
        return [
          { t: curTb, k: 'tb' },
          { t: curTb + '.*', k: 'cl' },
          ...cols,
          { t: 'SELECT * FROM ' + curTb + ';', k: 'kw' },
          { t: 'DESC ' + curTb + ';', k: 'kw' }
        ];
      }
      case 'cols': {
        const curTb = activeTableTab || (schemaInfo && schemaInfo.tableNames && schemaInfo.tableNames[0]) || 'courses';
        return getTableColumns(curTb).map(c => ({
          t: c.name.toLowerCase(),
          k: 'cl',
          badge: c.type.toLowerCase()
        }));
      }
      case 'auto':
      default:
        return currentSuggestions.length > 0 ? currentSuggestions : DQL_ITEMS.slice(0, 16);
    }
  })();

  const SQL_KEYWORDS = [
    'SELECT', 'INSERT INTO', 'UPDATE', 'DELETE FROM', 'FROM', 'WHERE',
    'JOIN', 'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'AND', 'OR', 'NOT',
    'AS', 'VALUES', 'SET', 'DISTINCT', 'LIKE', 'IN', 'NULL', 'COUNT(',
    'SUM(', 'AVG(', 'MAX(', 'MIN(', '*'
  ];

  const KW_REGEX = new RegExp(
    '\\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|JOIN|INNER|LEFT|RIGHT|FULL|OUTER|ON|GROUP|ORDER|BY|HAVING|AND|OR|NOT|NULL|AS|DISTINCT|LIKE|IN|BETWEEN|COUNT|SUM|AVG|MIN|MAX|CREATE|TABLE|DROP|ASC|DESC)\\b',
    'i'
  );

  $: schemaInfo = getSchemaInfo($tablesStore);
  $: lineCount = (code || '').split('\n').length;
  $: gutContent = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n') + '\n';
  $: highlightedCode = paintSql(code);

  function getSchemaInfo(tables) {
    const tableNames = Object.keys(tables).filter(t => t !== 'DUAL');
    const cols = [];
    tableNames.forEach(t => {
      (tables[t].columns || []).forEach(c => {
        if (!cols.includes(c.name.toLowerCase())) cols.push(c.name.toLowerCase());
      });
    });
    return { tableNames, cols };
  }

  function escapeHtml(s) {
    return (s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function paintSql(text) {
    return escapeHtml(text).replace(
      /(--.*$)|('[^'\n]*'?)|\b(\d+(?:\.\d+)?)\b|([A-Za-z_]+)/gm,
      (m, comment, str, num, word) => {
        if (comment) return `<i class="cm">${comment}</i>`;
        if (str) return `<i class="st">${str}</i>`;
        if (num) return `<i class="nu">${num}</i>`;
        if (KW_REGEX.test(word)) return `<b>${word}</b>`;
        return m;
      }
    ) + '\n';
  }

  function syncScroll() {
    if (!textareaEl || !hlEl || !gutEl) return;
    hlEl.scrollTop = textareaEl.scrollTop;
    hlEl.scrollLeft = textareaEl.scrollLeft;
    gutEl.scrollTop = textareaEl.scrollTop;
  }

  let showAutocomplete = false;
  let autocompletePos = { top: 30, left: 10 };
  let selectedSuggestionIndex = 0;

  function updateAutocompletePosition() {
    if (!textareaEl) return;
    const s = textareaEl.selectionStart || 0;
    const v = code.slice(0, s);
    const lines = v.split('\n');
    const ln = lines.length - 1;
    const col = lines[ln].length;

    const lineY = 6 + (ln * 20) - textareaEl.scrollTop;
    const charX = 8 + (col * 8.4) - textareaEl.scrollLeft;

    const editorH = textareaEl.clientHeight || 150;
    const editorW = textareaEl.clientWidth || 300;

    let top = lineY + 22;
    if (top + 160 > editorH && lineY > 160) {
      top = Math.max(4, lineY - 165);
    } else {
      top = Math.max(4, Math.min(top, editorH - 40));
    }

    let left = Math.max(6, Math.min(charX, editorW - 215));

    autocompletePos = { top, left };
  }

  function updateSuggestions() {
    if (!textareaEl) return;
    const pos = textareaEl.selectionStart || 0;
    const v = code.slice(0, pos);
    const m = v.match(/[A-Za-z_]\w*$/);
    const currentWord = m ? m[0] : '';
    const pre = v.slice(0, v.length - currentWord.length);
    const pm = pre.match(/([A-Za-z]+)\s*$/);
    const prevWord = pm ? pm[1].toUpperCase() : '';

    const tbItems = schemaInfo.tableNames.map(t => ({ t, k: 'tb' }));
    const clItems = schemaInfo.cols.map(t => ({ t, k: 'cl' }));

    let list = [];
    if (currentWord) {
      const q = currentWord.toLowerCase();
      const allPool = [
        ...tbItems,
        ...clItems,
        ...ALL_SUGGESTION_ITEMS
      ];
      const seen = new Set();
      const prefixMatches = [];
      const containsMatches = [];

      for (const item of allPool) {
        const itemClean = item.t.toLowerCase().replace(/[(;]/g, '');
        if (seen.has(itemClean)) continue;
        seen.add(itemClean);

        if (itemClean.startsWith(q)) {
          prefixMatches.push(item);
        } else if (itemClean.includes(q)) {
          containsMatches.push(item);
        }
      }

      list = [...prefixMatches, ...containsMatches].slice(0, 16);
      showAutocomplete = list.length > 0;
      selectedSuggestionIndex = 0;
    } else if (/^(FROM|JOIN|INTO|UPDATE|TABLE|DESC|DESCRIBE)$/.test(prevWord)) {
      list = tbItems;
      showAutocomplete = tbItems.length > 0;
      selectedSuggestionIndex = 0;
    } else if (/^(SELECT|WHERE|AND|OR|BY|SET|ON|HAVING|DISTINCT)$/.test(prevWord) || /,\s*$/.test(pre)) {
      list = [{ t: '*', k: 'kw' }, ...clItems, ...AGG_ITEMS.slice(0, 6)];
      showAutocomplete = list.length > 0;
      selectedSuggestionIndex = 0;
    } else {
      list = DQL_ITEMS.slice(0, 16);
      showAutocomplete = false;
    }

    currentSuggestions = list;
  }

  function handleEditorKeyDown(e) {
    if (showAutocomplete && currentSuggestions.length > 0) {
      if (e.key === 'Tab') {
        e.preventDefault();
        handleInsertChip(currentSuggestions[selectedSuggestionIndex || 0]);
        showAutocomplete = false;
      } else if (e.key === 'Escape') {
        showAutocomplete = false;
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedSuggestionIndex = (selectedSuggestionIndex + 1) % currentSuggestions.length;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedSuggestionIndex = (selectedSuggestionIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
      }
    }
  }

  function insertText(t) {
    if (!textareaEl) return;
    const s = textareaEl.selectionStart;
    const e = textareaEl.selectionEnd;
    code = code.slice(0, s) + t + code.slice(e);
    tick().then(() => {
      textareaEl.selectionStart = textareaEl.selectionEnd = s + t.length;
      textareaEl.focus();
      updateSuggestions();
      updateAutocompletePosition();
      ensureCursorVisible();
      syncScroll();
    });
  }

  function backspace() {
    if (!textareaEl) return;
    const s = textareaEl.selectionStart;
    const e = textareaEl.selectionEnd;
    if (s !== e) {
      code = code.slice(0, s) + code.slice(e);
      tick().then(() => {
        textareaEl.selectionStart = textareaEl.selectionEnd = s;
        textareaEl.focus();
        updateSuggestions();
        updateAutocompletePosition();
        ensureCursorVisible();
        syncScroll();
      });
    } else if (s > 0) {
      code = code.slice(0, s - 1) + code.slice(s);
      tick().then(() => {
        textareaEl.selectionStart = textareaEl.selectionEnd = s - 1;
        textareaEl.focus();
        updateSuggestions();
        updateAutocompletePosition();
        ensureCursorVisible();
        syncScroll();
      });
    }
  }

  function ensureCursorVisible() {
    if (!textareaEl) return;
    const s = textareaEl.selectionStart;
    const v = code;
    const ln = v.slice(0, s).split('\n').length - 1;
    const col = s - (v.lastIndexOf('\n', s - 1) + 1);
    const top = 6 + ln * 20;
    const h = textareaEl.clientHeight;
    const x = 8 + col * 8.4;
    const w = textareaEl.clientWidth;

    if (top < textareaEl.scrollTop + 6) textareaEl.scrollTop = Math.max(0, top - 6);
    else if (top + 26 > textareaEl.scrollTop + h) textareaEl.scrollTop = top + 26 - h;

    if (x < textareaEl.scrollLeft + 8) textareaEl.scrollLeft = Math.max(0, x - 8);
    else if (x + 16 > textareaEl.scrollLeft + w) textareaEl.scrollLeft = x + 16 - w;
  }

  // Chip Bar double-tap state (prevents accidental insertions when scrolling horizontally)
  let lastChip = null;
  let lastChipTime = 0;
  let chipStartX = 0;
  let chipStartY = 0;
  let chipMoved = false;
  let pendingChip = null;
  let lastInsertedChipTime = 0;

  function handleInsertChip(chip) {
    if (!textareaEl) return;
    const now = Date.now();
    if (now - lastInsertedChipTime < 150) return; // prevent duplicate fire from dblclick + pointerup
    lastInsertedChipTime = now;

    const text = chip.t || chip;
    const isFunc = text.endsWith('(');
    const toInsert = isFunc ? text + ')' : (text.endsWith(')') ? text + ' ' : text + ' ');
    const s = textareaEl.selectionStart;
    const e = textareaEl.selectionEnd;

    // Check if replacing current partial word (e.g. user typed "SEL" and clicked "SELECT")
    const m = code.slice(0, s).match(/[A-Za-z_]\w*$/);
    const wLen = m ? m[0].length : 0;

    code = code.slice(0, s - wLen) + toInsert + code.slice(e);
    showAutocomplete = false;
    tick().then(() => {
      // Place caret inside parentheses for functions: FUNC(|)
      const newPos = isFunc ? s - wLen + text.length : s - wLen + toInsert.length;
      textareaEl.selectionStart = textareaEl.selectionEnd = newPos;
      textareaEl.focus();
      updateSuggestions();
      updateAutocompletePosition();
      ensureCursorVisible();
      syncScroll();
    });
  }

  function handleChipPointerDown(chip, e) {
    chipStartX = e.clientX;
    chipStartY = e.clientY;
    chipMoved = false;
  }

  function handleChipPointerMove(e) {
    if (!chipMoved && (Math.abs(e.clientX - chipStartX) > 8 || Math.abs(e.clientY - chipStartY) > 8)) {
      chipMoved = true;
      pendingChip = null;
    }
  }

  function handleChipPointerUp(chip, e) {
    if (e) e.preventDefault();
    if (chipMoved) {
      // Finger moved across bar (user was scrolling) -> ignore insertion
      lastChip = null;
      pendingChip = null;
      return;
    }

    const now = Date.now();
    if (lastChip === chip.t && (now - lastChipTime) < 420) {
      // Double tap confirmed! Insert keyword into editor
      handleInsertChip(chip);
      lastChip = null;
      lastChipTime = 0;
      pendingChip = null;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(25); } catch (_) {}
      }
    } else {
      // 1st tap: mark pending briefly with visual indicator
      lastChip = chip.t;
      lastChipTime = now;
      pendingChip = chip.t;
      setTimeout(() => {
        if (pendingChip === chip.t) pendingChip = null;
      }, 420);
    }
  }

  // Key repeater for Backspace
  function startRepeating(action) {
    action();
    clearTimeout(repeatTimer);
    repeatTimer = setTimeout(function loop() {
      action();
      repeatTimer = setTimeout(loop, 55);
    }, 380);
  }

  function stopRepeating() {
    clearTimeout(repeatTimer);
  }

  // Standard keyboard Shift symbol mapping
  const SHIFT_MAP = {
    '1': '!',
    '2': '@',
    '3': '#',
    '4': '$',
    '5': '%',
    '6': '^',
    '7': '&',
    '8': '*',
    '9': '(',
    '0': ')',
    "'": '"',
    ';': ':',
    ',': '<',
    '.': '>',
    '-': '_',
    '=': '+',
    '/': '?',
    '[': '{',
    ']': '}'
  };

  function getShiftChar(k) {
    if (!capsLock) return k;
    if (/^[a-z]$/.test(k)) return k.toUpperCase();
    if (SHIFT_MAP[k]) return SHIFT_MAP[k];
    return k;
  }

  // Hold (Long-press) keywords & functions map for on-screen keypad
  const HOLD_KEYWORDS = {
    // Letters -> SQL Keywords & Functions
    's': 'SELECT ',
    'f': 'FROM ',
    'w': 'WHERE ',
    'j': 'JOIN ',
    'i': 'INSERT INTO ',
    'u': 'UPDATE ',
    'd': 'DELETE FROM ',
    'g': 'GROUP BY ',
    'o': 'ORDER BY ',
    'h': 'HAVING ',
    'a': 'AND ',
    'b': 'BY ',
    'c': 'CREATE TABLE ',
    't': 'TABLE ',
    'v': 'VALUES ',
    'l': 'LIKE ',
    'n': 'NULL ',
    'p': 'PRIMARY KEY ',
    'r': 'ROUND(',
    'm': 'MAX(',
    'x': 'MIN(',
    'z': 'COUNT(',
    'e': 'EXISTS(',
    'k': 'CHECK(',
    'y': 'SYSDATE',
    'q': 'UNIQUE ',

    // Numbers -> Symbols & SQL Hold shortcuts
    '1': '!= ',
    '2': '@',
    '3': '#',
    '4': '$',
    '5': "LIKE '%'",
    '6': '^',
    '7': '&',
    '8': 'COUNT(*)',
    '9': '()',
    '0': ')',

    // Symbols -> Pairs & Multi-character Operators
    "'": "''",
    '"': '""',
    '(': '()',
    '{': '{}',
    '[': '[]',
    '=': '!= ',
    '<': '<= ',
    '>': '>= ',
    ',': '<= ',
    '.': '>= ',
    '-': '-- ',
    '*': 'COUNT(*)',
    '/': '/*  */',
    ';': ':',
    '%': "LIKE '%'",
    '_': "LIKE '_'"
  };

  let keyHoldTimer = null;
  let keyHeld = false;
  let activePointerKey = null;
  let keyStartX = 0;
  let keyStartY = 0;
  let keyMoved = false;

  function triggerHoldAction(k) {
    keyHeld = true;
    const lowerKey = k.toLowerCase();
    const keyword = HOLD_KEYWORDS[lowerKey] || HOLD_KEYWORDS[k];

    if (keyword) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(25); } catch (_) {}
      }

      const s = textareaEl ? textareaEl.selectionStart : 0;
      const e = textareaEl ? textareaEl.selectionEnd : s;
      let insertion = keyword;
      if (keyword.endsWith('(')) {
        insertion = keyword + ')';
      }

      code = code.slice(0, s) + insertion + code.slice(e);

      tick().then(() => {
        let newCaret = s + insertion.length;
        if (keyword.endsWith('(')) {
          newCaret = s + keyword.length; // inside func(|)
        } else if (keyword === "''" || keyword === '""' || keyword === '()' || keyword === '{}' || keyword === '[]') {
          newCaret = s + 1; // inside quotes/brackets '|'
        } else if (keyword === '/*  */') {
          newCaret = s + 3; // inside /* | */
        }
        if (textareaEl) {
          textareaEl.selectionStart = textareaEl.selectionEnd = newCaret;
          textareaEl.focus();
        }
        updateSuggestions();
        updateAutocompletePosition();
        ensureCursorVisible();
        syncScroll();
      });
    }
  }

  function handleKeyPointerDown(k, e) {
    if (e) {
      e.preventDefault();
      try { e.currentTarget?.setPointerCapture?.(e.pointerId); } catch (_) {}
    }
    clearTimeout(keyHoldTimer);
    clearTimeout(repeatTimer);

    activePointerKey = k;
    keyHeld = false;
    keyMoved = false;
    if (e) {
      keyStartX = e.clientX;
      keyStartY = e.clientY;
    }

    if (k === 'Caps') {
      capsLock = !capsLock;
    } else if (k === 'Tab') {
      insertText('  ');
    } else if (k === 'Enter') {
      const s = textareaEl ? textareaEl.selectionStart : 0;
      const v = code;
      const a = v.lastIndexOf('\n', s - 1) + 1;
      const indent = (v.slice(a).match(/^ */) || [''])[0];
      insertText('\n' + indent);
    } else if (k === 'Back') {
      startRepeating(backspace);
    } else {
      // For character/symbol keys: start hold timer for long-press
      const lowerKey = k.toLowerCase();
      const hasHold = !!(HOLD_KEYWORDS[lowerKey] || HOLD_KEYWORDS[k]);
      if (hasHold) {
        keyHoldTimer = setTimeout(() => {
          triggerHoldAction(k);
        }, 360);
      }
    }
  }

  function handleKeypadPress(k, e) {
    handleKeyPointerDown(k, e);
  }

  function handleKeyPointerMove(e) {
    if (!keyMoved && e && (Math.abs(e.clientX - keyStartX) > 14 || Math.abs(e.clientY - keyStartY) > 14)) {
      keyMoved = true;
      clearTimeout(keyHoldTimer);
    }
  }

  function handleKeyPointerUp(k, e) {
    if (e) e.preventDefault();
    clearTimeout(keyHoldTimer);
    clearTimeout(repeatTimer);

    if (activePointerKey !== k && activePointerKey !== null) {
      k = activePointerKey;
    }
    activePointerKey = null;

    // Special keys (Caps, Tab, Enter, Back) were already handled on down
    if (k === 'Caps' || k === 'Tab' || k === 'Enter' || k === 'Back') {
      return;
    }

    // If key was held, the hold keyword was already inserted!
    if (keyHeld || keyMoved) {
      keyHeld = false;
      return;
    }

    // Normal tap release: insert single character (honoring Shift on letters & number symbols)
    const char = getShiftChar(k);
    insertText(char);
  }

  function handleWindowPointerUp(e) {
    stopRepeating();
    clearTimeout(keyHoldTimer);

    if (!activePointerKey) return;
    const k = activePointerKey;
    activePointerKey = null;

    if (k === 'Caps' || k === 'Tab' || k === 'Enter' || k === 'Back') {
      return;
    }

    if (keyHeld || keyMoved) {
      keyHeld = false;
      return;
    }

    const char = getShiftChar(k);
    insertText(char);
  }

  function handleWindowPointerMove(e) {
    if (!keyMoved && activePointerKey && e && (Math.abs(e.clientX - keyStartX) > 14 || Math.abs(e.clientY - keyStartY) > 14)) {
      keyMoved = true;
      clearTimeout(keyHoldTimer);
    }
  }

  function handleKeyPointerCancel() {
    clearTimeout(keyHoldTimer);
    clearTimeout(repeatTimer);
    keyHeld = false;
    keyMoved = false;
    activePointerKey = null;
  }

  function handleRunQuery() {
    onRun(code);
    showOutput = true;
  }

  // Fullscreen & Screen Orientation Request
  function requestFullscreenAndOrientation(mode) {
    const docEl = document.documentElement;
    if (!document.fullscreenElement) {
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(() => {});
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      }
    }
    isFullscreen = true;

    // Try locking screen orientation if supported by mobile browser
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock(mode === 'landscape' ? 'landscape' : 'portrait').catch(() => {});
      }
    } catch (_) {}
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      requestFullscreenAndOrientation(layoutMode);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
      isFullscreen = false;
      showModePrompt = true;
    }
  }

  function selectMode(mode) {
    layoutMode = mode;
    showModePrompt = false;
    try { localStorage.setItem(LAYOUT_STORAGE_KEY, mode); } catch (_) {}
    onSwitchLayout(mode);
    requestFullscreenAndOrientation(mode);
    tick().then(fitScale);
  }

  function toggleLayoutMode() {
    const nextMode = layoutMode === 'landscape' ? 'vertical' : 'landscape';
    layoutMode = nextMode;
    try { localStorage.setItem(LAYOUT_STORAGE_KEY, nextMode); } catch (_) {}
    onSwitchLayout(nextMode);
    requestFullscreenAndOrientation(layoutMode);
    tick().then(fitScale);
  }

  function fitScale() {
    if (!devEl) return;
    if (layoutMode === 'landscape') {
      const clientW = document.documentElement.clientWidth;
      if (clientW < 860) {
        const s = Math.min(1, Math.max(0.40, (clientW - 12) / 844));
        devEl.style.transform = `scale(${s})`;
        devEl.style.marginBottom = `${-(390 * (1 - s))}px`;
      } else {
        devEl.style.transform = '';
        devEl.style.marginBottom = '';
      }
    } else {
      devEl.style.transform = '';
      devEl.style.marginBottom = '';
    }
  }

  function onFullscreenChange() {
    const wasFullscreen = isFullscreen;
    isFullscreen = !!document.fullscreenElement;
    if (wasFullscreen && !isFullscreen) {
      // Exiting full screen asks Horizontal or Vertical to prevent layout lock issues
      showModePrompt = true;
    }
  }

  function handleOutsideMenuClick(event) {
    if (showViewMenu) {
      const target = event.target;
      if (target && !target.closest('.menu-dropdown-wrap')) {
        showViewMenu = false;
      }
    }
    if (showAutocomplete) {
      const target = event.target;
      if (target && !target.closest('.autocomplete-popup') && !target.closest('.ta')) {
        showAutocomplete = false;
      }
    }
  }

  let initialFullscreenHandler = null;

  onMount(() => {
    isFullscreen = !!document.fullscreenElement;
    try {
      const savedMode = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (savedMode === 'vertical' || savedMode === 'landscape') {
        layoutMode = savedMode;
        showModePrompt = false;
      }
    } catch (_) {}

    // Make fullscreen default
    requestFullscreenAndOrientation(layoutMode);

    // If browser security policy requires user gesture on initial page load, trigger on first tap
    initialFullscreenHandler = () => {
      if (!document.fullscreenElement) {
        requestFullscreenAndOrientation(layoutMode);
      }
    };
    window.addEventListener('pointerdown', initialFullscreenHandler, { once: true });

    updateSuggestions();
    window.addEventListener('resize', fitScale);
    window.addEventListener('pointerdown', handleOutsideMenuClick);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointercancel', handleKeyPointerCancel);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    fitScale();
  });

  onDestroy(() => {
    if (initialFullscreenHandler) {
      window.removeEventListener('pointerdown', initialFullscreenHandler);
    }
    window.removeEventListener('resize', fitScale);
    window.removeEventListener('pointerdown', handleOutsideMenuClick);
    window.removeEventListener('pointerup', handleWindowPointerUp);
    window.removeEventListener('pointermove', handleWindowPointerMove);
    window.removeEventListener('pointercancel', handleKeyPointerCancel);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    handleKeyPointerCancel();
  });
</script>

<div class="mobile-keyboard-root {theme} mode-{layoutMode}" class:shift-on={capsLock}>
  <!-- ORIENTATION / MODE SELECTOR MODAL -->
  {#if showModePrompt}
    <div class="mode-prompt-overlay">
      <div class="mode-prompt-card">
        <button class="prompt-close-btn" on:click={() => showModePrompt = false} title="Close">✕</button>
        <div class="prompt-header">
          <span class="badge">ORACLE</span>
          <h3>Select Layout Mode</h3>
        </div>
        <p class="prompt-desc">
          Choose Horizontal or Vertical layout for your screen orientation:
        </p>

        <div class="mode-cards-grid">
          <!-- Horizontal / Landscape Option -->
          <button 
            class="mode-card landscape" 
            class:is-active={layoutMode === 'landscape'}
            on:click={() => selectMode('landscape')}
          >
            {#if layoutMode === 'landscape'}
              <span class="mode-current-badge">Active</span>
            {/if}
            <div class="mode-card-icon">
              <svg width="40" height="28" viewBox="0 0 24 16" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="1" y="1" width="22" height="14" rx="2"></rect>
                <line x1="6" y1="1" x2="6" y2="15"></line>
                <line x1="18" y1="1" x2="18" y2="15"></line>
              </svg>
            </div>
            <div class="mode-card-title">Horizontal (Landscape)</div>
            <div class="mode-card-subtitle">
              Split thumb keyboards for sideways / wide screen orientation.
            </div>
          </button>

          <!-- Vertical / Portrait Option -->
          <button 
            class="mode-card vertical" 
            class:is-active={layoutMode === 'vertical'}
            on:click={() => selectMode('vertical')}
          >
            {#if layoutMode === 'vertical'}
              <span class="mode-current-badge">Active</span>
            {/if}
            <div class="mode-card-icon">
              <svg width="28" height="40" viewBox="0 0 16 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="1" y="1" width="14" height="22" rx="2"></rect>
                <line x1="1" y1="14" x2="15" y2="14"></line>
              </svg>
            </div>
            <div class="mode-card-title">Vertical (Portrait)</div>
            <div class="mode-card-subtitle">
              Stacked full keyboard below editor for upright phones.
            </div>
          </button>
        </div>
      </div>
    </div>
  {/if}

  <div class="dev {layoutMode}" id="dev" bind:this={devEl}>
    <header>
      <span class="badge">ORACLE</span>
      <b>SQL Mobile Studio</b>

      <button class="hb run" on:click={handleRunQuery} title="Run SQL (Execute queries)">
        ▶ Run
      </button>

      <button 
        class="hb" 
        class:on={showOutput} 
        on:click={() => showOutput = !showOutput}
        title="Toggle Output"
      >
        {showOutput ? 'Input' : 'Output'}
      </button>

      <!-- UNIFIED VIEW DROPDOWN (Tables, Vertical, Desktop) -->
      <div class="menu-dropdown-wrap">
        <button 
          class="hb menu-trigger-btn" 
          class:on={showViewMenu} 
          on:click|stopPropagation={() => showViewMenu = !showViewMenu}
          title="Switch Views & Tables"
        >
          <span>View ▾</span>
        </button>

        {#if showViewMenu}
          <div class="view-menu-popover">
            <div class="view-menu-title">
              <span>View &amp; Workspace</span>
              <button class="view-menu-close-btn" on:click={() => showViewMenu = false}>✕</button>
            </div>

            <!-- 1. Tables -->
            <button 
              class="view-menu-option" 
              class:is-active={showTablePreviewModal}
              on:click={() => { 
                showViewMenu = false; 
                openTablePreview(activeTableTab); 
              }}
            >
              <span class="vmo-icon">📋</span>
              <div class="vmo-content">
                <span class="vmo-label">Tables</span>
                <span class="vmo-sub">View schema &amp; table data</span>
              </div>
            </button>

            <div class="view-menu-sep"></div>

            <!-- 2. Vertical -->
            <button 
              class="view-menu-option" 
              class:is-active={layoutMode === 'vertical'}
              on:click={() => { 
                layoutMode = 'vertical'; 
                try { localStorage.setItem(LAYOUT_STORAGE_KEY, 'vertical'); } catch (_) {}
                onSwitchLayout('vertical');
                showViewMenu = false; 
                tick().then(fitScale);
              }}
            >
              <span class="vmo-icon">📱</span>
              <div class="vmo-content">
                <span class="vmo-label">Vertical</span>
                <span class="vmo-sub">Full bottom keyboard</span>
              </div>
              {#if layoutMode === 'vertical'}
                <span class="vmo-badge">Active</span>
              {/if}
            </button>

            <!-- Landscape (also available in the view dropdown) -->
            <button 
              class="view-menu-option" 
              class:is-active={layoutMode === 'landscape'}
              on:click={() => { 
                layoutMode = 'landscape'; 
                try { localStorage.setItem(LAYOUT_STORAGE_KEY, 'landscape'); } catch (_) {}
                onSwitchLayout('landscape');
                showViewMenu = false; 
                tick().then(fitScale);
              }}
            >
              <span class="vmo-icon">📐</span>
              <div class="vmo-content">
                <span class="vmo-label">Landscape</span>
                <span class="vmo-sub">Split thumb keyboard</span>
              </div>
              {#if layoutMode === 'landscape'}
                <span class="vmo-badge">Active</span>
              {/if}
            </button>

            <div class="view-menu-sep"></div>

            <!-- 3. Desktop -->
            <button 
              class="view-menu-option vmo-desktop" 
              on:click={() => { 
                try { localStorage.setItem(LAYOUT_STORAGE_KEY, 'desktop'); } catch (_) {}
                showViewMenu = false; 
                onExitMobile(); 
              }}
            >
              <span class="vmo-icon">💻</span>
              <div class="vmo-content">
                <span class="vmo-label">Desktop</span>
                <span class="vmo-sub">Switch to full 3-pane IDE</span>
              </div>
            </button>
          </div>
        {/if}
      </div>

      <button 
        class="hb" 
        class:on={!hideKeyboard} 
        on:click={() => hideKeyboard = !hideKeyboard}
        title="Toggle On-Screen Keyboard"
      >
        ⌨
      </button>

      <!-- Fullscreen Toggle -->
      <button 
        class="hb" 
        class:on={isFullscreen} 
        on:click={toggleFullscreen} 
        title="Toggle Full Screen Mode"
      >
        {isFullscreen ? '⛶ Exit' : '⛶ Full'}
      </button>

      <button class="hb" on:click={onToggleTheme} title="Toggle Light / Dark mode">
        {theme === 'theme-dark' ? '☀' : '☾'}
      </button>
    </header>

    <!-- LANDSCAPE LAYOUT (Split Keyboards) -->
    {#if layoutMode === 'landscape'}
      <div class="main landscape-main" class:hide={hideKeyboard}>
        <!-- LEFT KEYBOARD -->
        <div class="side left-side">
          <div class="kb l">
            <!-- Row 1: Numbers 1-5 with Symbols -->
            <button class="k dual-key" on:pointerdown={(e) => handleKeypadPress('1', e)}><span class="ks-sub">!</span><span class="ks-main">1</span></button>
            <button class="k dual-key" on:pointerdown={(e) => handleKeypadPress('2', e)}><span class="ks-sub">@</span><span class="ks-main">2</span></button>
            <button class="k dual-key" on:pointerdown={(e) => handleKeypadPress('3', e)}><span class="ks-sub">#</span><span class="ks-main">3</span></button>
            <button class="k dual-key" on:pointerdown={(e) => handleKeypadPress('4', e)}><span class="ks-sub">$</span><span class="ks-main">4</span></button>
            <button class="k dual-key" on:pointerdown={(e) => handleKeypadPress('5', e)}><span class="ks-sub">%</span><span class="ks-main">5</span></button>

            <!-- Row 2: QWERT -->
            <button class="k" on:pointerdown={(e) => handleKeypadPress('q', e)}>{capsLock ? 'Q' : 'q'}<span class="kh">UNQ</span></button>
            <button class="k" on:pointerdown={(e) => handleKeypadPress('w', e)}>{capsLock ? 'W' : 'w'}<span class="kh">WHERE</span></button>
            <button class="k" on:pointerdown={(e) => handleKeypadPress('e', e)}>{capsLock ? 'E' : 'e'}<span class="kh">EXISTS</span></button>
            <button class="k" on:pointerdown={(e) => handleKeypadPress('r', e)}>{capsLock ? 'R' : 'r'}<span class="kh">ROUND</span></button>
            <button class="k" on:pointerdown={(e) => handleKeypadPress('t', e)}>{capsLock ? 'T' : 't'}<span class="kh">TABLE</span></button>

            <!-- Row 3: ASDFG -->
            <button class="k" on:pointerdown={(e) => handleKeypadPress('a', e)}>{capsLock ? 'A' : 'a'}<span class="kh">AND</span></button>
            <button class="k" on:pointerdown={(e) => handleKeypadPress('s', e)}>{capsLock ? 'S' : 's'}<span class="kh">SELECT</span></button>
            <button class="k" on:pointerdown={(e) => handleKeypadPress('d', e)}>{capsLock ? 'D' : 'd'}<span class="kh">DEL</span></button>
            <button class="k" on:pointerdown={(e) => handleKeypadPress('f', e)}>{capsLock ? 'F' : 'f'}<span class="kh">FROM</span></button>
            <button class="k" on:pointerdown={(e) => handleKeypadPress('g', e)}>{capsLock ? 'G' : 'g'}<span class="kh">GROUP</span></button>

            <!-- Row 4: ZXCVB -->
            <button class="k" on:pointerdown={(e) => handleKeypadPress('z', e)}>{capsLock ? 'Z' : 'z'}<span class="kh">COUNT</span></button>
            <button class="k" on:pointerdown={(e) => handleKeypadPress('x', e)}>{capsLock ? 'X' : 'x'}<span class="kh">MIN</span></button>
            <button class="k" on:pointerdown={(e) => handleKeypadPress('c', e)}>{capsLock ? 'C' : 'c'}<span class="kh">CREATE</span></button>
            <button class="k" on:pointerdown={(e) => handleKeypadPress('v', e)}>{capsLock ? 'V' : 'v'}<span class="kh">VALUES</span></button>
            <button class="k" on:pointerdown={(e) => handleKeypadPress('b', e)}>{capsLock ? 'B' : 'b'}<span class="kh">BY</span></button>

            <!-- Row 5: Shift, Tab, Quotes, Semicolon, Minus -->
            <button 
              class="k s caps-btn" 
              class:on={capsLock} 
              on:pointerdown={(e) => handleKeypadPress('Caps', e)}
              title="Shift / Caps Lock"
              aria-label="Shift / Caps Lock"
            >
              <svg class="shift-icon" width="18" height="18" viewBox="0 0 24 24" fill={capsLock ? "currentColor" : "none"} stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3l7 7h-4v9h-6v-9H5l7-7z"/>
              </svg>
            </button>
            <button class="k s" on:pointerdown={(e) => handleKeypadPress('Tab', e)}>Tab</button>
            <button class="k dual-key sy" on:pointerdown={(e) => handleKeypadPress("'", e)}><span class="ks-sub">"</span><span class="ks-main">'</span></button>
            <button class="k dual-key sy" on:pointerdown={(e) => handleKeypadPress(';', e)}><span class="ks-sub">:</span><span class="ks-main">;</span></button>
            <button class="k dual-key sy" on:pointerdown={(e) => handleKeypadPress('-', e)}><span class="ks-sub">_</span><span class="ks-main">-</span></button>
          </div>
        </div>

        <!-- CENTER DISPLAY -->
        <div class="center" class:showout={showOutput}>
          <div class="inp">
            <div class="sql-shortcuts-bar">
              <!-- Scrollable Category Tabs: DQL, DML, DDL, DCL, TCL, Math, Regex, etc. -->
              <div class="cat-tabs-row">
                {#each SQL_CATEGORIES as cat}
                  <button 
                    class="cat-tab-btn" 
                    class:auto-tab={cat.id === 'auto'}
                    class:active={selectedCategory === cat.id}
                    on:click={() => selectedCategory = cat.id}
                  >
                    {cat.name}
                  </button>
                {/each}
              </div>

              <!-- Scrollable Item Chips -->
              <div class="chips-items-row">
                {#if selectedCategory === 'tables'}
                  {#each schemaInfo.tableNames as tb}
                    <button 
                      class="chip table-switch-btn" 
                      class:active={activeTableTab === tb}
                      on:click={() => activeTableTab = tb}
                    >
                      📁 {tb.toUpperCase()}
                    </button>
                  {/each}
                  <button 
                    class="chip preview-action-chip" 
                    on:click={() => openTablePreview(activeTableTab)}
                  >
                    👁 View Data
                  </button>
                  <span class="chip-divider"></span>
                {/if}

                {#each displayedChips as chip}
                  <button 
                    class="chip {chip.k}"
                    class:tap-pending={pendingChip === chip.t}
                    on:pointerdown={(e) => handleChipPointerDown(chip, e)}
                    on:pointermove={handleChipPointerMove}
                    on:pointerup={(e) => handleChipPointerUp(chip, e)}
                    on:dblclick={() => handleInsertChip(chip)}
                  >
                    {chip.t}
                    {#if chip.badge}
                      <small class="chip-badge">{chip.badge}</small>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>

            <div class="code">
              <div class="gut" bind:this={gutEl}>{gutContent}</div>
              <div class="ew">
                <pre class="hl" bind:this={hlEl}>{@html highlightedCode}</pre>
                <textarea
                  class="ta"
                  bind:this={textareaEl}
                  bind:value={code}
                  inputmode="none"
                  spellcheck="false"
                  autocapitalize="off"
                  autocorrect="off"
                  on:scroll={() => { syncScroll(); updateAutocompletePosition(); }}
                  on:input={() => { updateSuggestions(); updateAutocompletePosition(); syncScroll(); }}
                  on:click={() => { updateSuggestions(); updateAutocompletePosition(); ensureCursorVisible(); }}
                  on:keyup={() => { updateSuggestions(); updateAutocompletePosition(); ensureCursorVisible(); }}
                  on:keydown={handleEditorKeyDown}
                  on:pointerup={() => { updateSuggestions(); updateAutocompletePosition(); ensureCursorVisible(); }}
                ></textarea>

                <!-- Floating Autocomplete Popup Widget -->
                {#if showAutocomplete && currentSuggestions.length > 0}
                  <div 
                    class="autocomplete-popup" 
                    style="top: {autocompletePos.top}px; left: {autocompletePos.left}px;"
                  >
                    <div class="ac-header">
                      <span>⚡ Suggestions ({currentSuggestions.length})</span>
                      <button class="ac-close" on:click|stopPropagation={() => showAutocomplete = false}>✕</button>
                    </div>
                    <div class="ac-list">
                      {#each currentSuggestions as item, idx}
                        <button 
                          class="ac-item"
                          class:active={idx === selectedSuggestionIndex}
                          on:click|stopPropagation={() => { handleInsertChip(item); showAutocomplete = false; }}
                        >
                          <span class="ac-badge {item.k}">{item.k === 'tb' ? 'TABLE' : item.k === 'cl' ? 'COL' : item.k === 'fn' ? 'FUNC' : 'SQL'}</span>
                          <span class="ac-text">{item.t}</span>
                          {#if item.badge}
                            <span class="ac-type">{item.badge}</span>
                          {/if}
                        </button>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            </div>

            <button 
              class="spbar" 
              on:pointerdown={(e) => handleKeypadPress(' ', e)}
            >
              Space
            </button>
          </div>

          <div class="out">
            <div class="oh">
              <span>Output</span>
              <span class="pillok" class:er={queryStatus.includes('Error')}>
                {queryStatus}
              </span>
              <button on:click={() => { queryResults = []; queryStatus = 'Ready'; }}>
                Clear
              </button>
            </div>

            <div class="tw">
              {#if !queryResults || queryResults.length === 0}
                <div class="out-empty">
                  Write queries and tap <strong>▶ Run</strong> to see live table results.
                </div>
              {:else}
                {#each queryResults as res}
                  {#if res.type === 'ERROR'}
                    <div class="res-err-box">
                      <strong>{res.message}</strong>
                      <div class="res-cmd"><code>{res.command}</code></div>
                    </div>
                  {:else if res.type === 'DML' || res.type === 'DDL'}
                    <div class="res-msg-box">✓ {res.message}</div>
                  {:else if res.type === 'SELECT' || res.type === 'DESCRIBE'}
                    <div class="res-tbl-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>#</th>
                            {#each res.columns as col}
                              <th>{col.toLowerCase()}</th>
                            {/each}
                          </tr>
                        </thead>
                        <tbody>
                          {#if res.rows.length === 0}
                            <tr>
                              <td colspan={res.columns.length + 1} class="muted">(0 rows)</td>
                            </tr>
                          {:else}
                            {#each res.rows as row, idx}
                              <tr>
                                <td class="muted">{idx + 1}</td>
                                {#each res.columns as col}
                                  <td>
                                    {#if row[col] === null || row[col] === undefined}
                                      <span class="null-subtle">(null)</span>
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
                  {/if}
                {/each}
              {/if}
            </div>
          </div>
        </div>

        <!-- RIGHT KEYBOARD -->
        <div class="side right-side">
          <div class="kb r">
            <!-- Row 1: Numbers 6-0 with Symbols + Backspace -->
            <button class="k dual-key" on:pointerdown={(e) => handleKeypadPress('6', e)}><span class="ks-sub">^</span><span class="ks-main">6</span></button>
            <button class="k dual-key" on:pointerdown={(e) => handleKeypadPress('7', e)}><span class="ks-sub">&amp;</span><span class="ks-main">7</span></button>
            <button class="k dual-key" on:pointerdown={(e) => handleKeypadPress('8', e)}><span class="ks-sub">*</span><span class="ks-main">8</span></button>
            <button class="k dual-key" on:pointerdown={(e) => handleKeypadPress('9', e)}><span class="ks-sub">(</span><span class="ks-main">9</span></button>
            <button class="k dual-key" on:pointerdown={(e) => handleKeypadPress('0', e)}><span class="ks-sub">)</span><span class="ks-main">0</span></button>
            <button 
              class="k bk" 
              style="grid-column: 6 / span 1; grid-row: 1 / span 2;"
              on:pointerdown={(e) => handleKeypadPress('Back', e)}
              title="Backspace"
            >
              ⌫
            </button>

            <!-- Row 2: YUIOP -->
            <button class="k" on:pointerdown={(e) => handleKeypadPress('y', e)}>{capsLock ? 'Y' : 'y'}<span class="kh">SYS</span></button>
            <button class="k" on:pointerdown={(e) => handleKeypadPress('u', e)}>{capsLock ? 'U' : 'u'}<span class="kh">UPDATE</span></button>
            <button class="k" on:pointerdown={(e) => handleKeypadPress('i', e)}>{capsLock ? 'I' : 'i'}<span class="kh">INSERT</span></button>
            <button class="k" on:pointerdown={(e) => handleKeypadPress('o', e)}>{capsLock ? 'O' : 'o'}<span class="kh">ORDER</span></button>
            <button class="k" on:pointerdown={(e) => handleKeypadPress('p', e)}>{capsLock ? 'P' : 'p'}<span class="kh">PK</span></button>

            <!-- Row 3: HJKL= + Enter -->
            <button class="k" on:pointerdown={(e) => handleKeypadPress('h', e)}>{capsLock ? 'H' : 'h'}<span class="kh">HAVING</span></button>
            <button class="k" on:pointerdown={(e) => handleKeypadPress('j', e)}>{capsLock ? 'J' : 'j'}<span class="kh">JOIN</span></button>
            <button class="k" on:pointerdown={(e) => handleKeypadPress('k', e)}>{capsLock ? 'K' : 'k'}<span class="kh">CHECK</span></button>
            <button class="k" on:pointerdown={(e) => handleKeypadPress('l', e)}>{capsLock ? 'L' : 'l'}<span class="kh">LIKE</span></button>
            <button class="k dual-key sy" on:pointerdown={(e) => handleKeypadPress('=', e)}><span class="ks-sub">+</span><span class="ks-main">=</span></button>
            <button 
              class="k ent" 
              style="grid-column: 6 / span 1; grid-row: 3 / span 3;"
              on:pointerdown={(e) => handleKeypadPress('Enter', e)}
              title="Enter"
            >
              ⏎
            </button>

            <!-- Row 4: NM,./ -->
            <button class="k" on:pointerdown={(e) => handleKeypadPress('n', e)}>{capsLock ? 'N' : 'n'}<span class="kh">NULL</span></button>
            <button class="k" on:pointerdown={(e) => handleKeypadPress('m', e)}>{capsLock ? 'M' : 'm'}<span class="kh">MAX</span></button>
            <button class="k dual-key sy" on:pointerdown={(e) => handleKeypadPress(',', e)}><span class="ks-sub">&lt;</span><span class="ks-main">,</span></button>
            <button class="k dual-key sy" on:pointerdown={(e) => handleKeypadPress('.', e)}><span class="ks-sub">&gt;</span><span class="ks-main">.</span></button>
            <button class="k dual-key sy" on:pointerdown={(e) => handleKeypadPress('/', e)}><span class="ks-sub">?</span><span class="ks-main">/</span></button>

            <!-- Row 5: Brackets, Wildcards & Math -->
            <button class="k sy" on:pointerdown={(e) => handleKeypadPress('(', e)}>(</button>
            <button class="k sy" on:pointerdown={(e) => handleKeypadPress(')', e)}>)</button>
            <button class="k sy" on:pointerdown={(e) => handleKeypadPress('*', e)}>*</button>
            <button class="k sy" on:pointerdown={(e) => handleKeypadPress('_', e)}>_</button>
            <button class="k sy" on:pointerdown={(e) => handleKeypadPress('%', e)}>%</button>
          </div>
        </div>
      </div>

    <!-- VERTICAL / PORTRAIT LAYOUT (Stacked Editor on Top, SQL Keyboard Below) -->
    {:else}
      <div class="vertical-layout-main">
        <!-- TOP AREA: Editor / Output -->
        <div class="vertical-editor-area center" class:showout={showOutput}>
          <div class="inp">
            <div class="sql-shortcuts-bar">
              <!-- Scrollable Category Tabs: DQL, DML, DDL, DCL, TCL, Math, Regex, etc. -->
              <div class="cat-tabs-row">
                {#each SQL_CATEGORIES as cat}
                  <button 
                    class="cat-tab-btn" 
                    class:auto-tab={cat.id === 'auto'}
                    class:active={selectedCategory === cat.id}
                    on:click={() => selectedCategory = cat.id}
                  >
                    {cat.name}
                  </button>
                {/each}
              </div>

              <!-- Scrollable Item Chips -->
              <div class="chips-items-row">
                {#if selectedCategory === 'tables'}
                  {#each schemaInfo.tableNames as tb}
                    <button 
                      class="chip table-switch-btn" 
                      class:active={activeTableTab === tb}
                      on:click={() => activeTableTab = tb}
                    >
                      📁 {tb.toUpperCase()}
                    </button>
                  {/each}
                  <button 
                    class="chip preview-action-chip" 
                    on:click={() => openTablePreview(activeTableTab)}
                  >
                    👁 View Data
                  </button>
                  <span class="chip-divider"></span>
                {/if}

                {#each displayedChips as chip}
                  <button 
                    class="chip {chip.k}"
                    class:tap-pending={pendingChip === chip.t}
                    on:pointerdown={(e) => handleChipPointerDown(chip, e)}
                    on:pointermove={handleChipPointerMove}
                    on:pointerup={(e) => handleChipPointerUp(chip, e)}
                    on:dblclick={() => handleInsertChip(chip)}
                  >
                    {chip.t}
                    {#if chip.badge}
                      <small class="chip-badge">{chip.badge}</small>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>

            <div class="code vertical-code">
              <div class="gut" bind:this={gutEl}>{gutContent}</div>
              <div class="ew">
                <pre class="hl" bind:this={hlEl}>{@html highlightedCode}</pre>
                <textarea
                  class="ta"
                  bind:this={textareaEl}
                  bind:value={code}
                  inputmode="none"
                  spellcheck="false"
                  autocapitalize="off"
                  autocorrect="off"
                  on:scroll={() => { syncScroll(); updateAutocompletePosition(); }}
                  on:input={() => { updateSuggestions(); updateAutocompletePosition(); syncScroll(); }}
                  on:click={() => { updateSuggestions(); updateAutocompletePosition(); ensureCursorVisible(); }}
                  on:keyup={() => { updateSuggestions(); updateAutocompletePosition(); ensureCursorVisible(); }}
                  on:keydown={handleEditorKeyDown}
                  on:pointerup={() => { updateSuggestions(); updateAutocompletePosition(); ensureCursorVisible(); }}
                ></textarea>

                <!-- Floating Autocomplete Popup Widget -->
                {#if showAutocomplete && currentSuggestions.length > 0}
                  <div 
                    class="autocomplete-popup" 
                    style="top: {autocompletePos.top}px; left: {autocompletePos.left}px;"
                  >
                    <div class="ac-header">
                      <span>⚡ Suggestions ({currentSuggestions.length})</span>
                      <button class="ac-close" on:click|stopPropagation={() => showAutocomplete = false}>✕</button>
                    </div>
                    <div class="ac-list">
                      {#each currentSuggestions as item, idx}
                        <button 
                          class="ac-item"
                          class:active={idx === selectedSuggestionIndex}
                          on:click|stopPropagation={() => { handleInsertChip(item); showAutocomplete = false; }}
                        >
                          <span class="ac-badge {item.k}">{item.k === 'tb' ? 'TABLE' : item.k === 'cl' ? 'COL' : item.k === 'fn' ? 'FUNC' : 'SQL'}</span>
                          <span class="ac-text">{item.t}</span>
                          {#if item.badge}
                            <span class="ac-type">{item.badge}</span>
                          {/if}
                        </button>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          </div>

          <div class="out">
            <div class="oh">
              <span>Output</span>
              <span class="pillok" class:er={queryStatus.includes('Error')}>
                {queryStatus}
              </span>
              <button on:click={() => { queryResults = []; queryStatus = 'Ready'; }}>
                Clear
              </button>
            </div>

            <div class="tw vertical-tw">
              {#if !queryResults || queryResults.length === 0}
                <div class="out-empty">
                  Write queries and tap <strong>▶ Run</strong> to see live table results.
                </div>
              {:else}
                {#each queryResults as res}
                  {#if res.type === 'ERROR'}
                    <div class="res-err-box">
                      <strong>{res.message}</strong>
                      <div class="res-cmd"><code>{res.command}</code></div>
                    </div>
                  {:else if res.type === 'DML' || res.type === 'DDL'}
                    <div class="res-msg-box">✓ {res.message}</div>
                  {:else if res.type === 'SELECT' || res.type === 'DESCRIBE'}
                    <div class="res-tbl-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>#</th>
                            {#each res.columns as col}
                              <th>{col.toLowerCase()}</th>
                            {/each}
                          </tr>
                        </thead>
                        <tbody>
                          {#if res.rows.length === 0}
                            <tr>
                              <td colspan={res.columns.length + 1} class="muted">(0 rows)</td>
                            </tr>
                          {:else}
                            {#each res.rows as row, idx}
                              <tr>
                                <td class="muted">{idx + 1}</td>
                                {#each res.columns as col}
                                  <td>
                                    {#if row[col] === null || row[col] === undefined}
                                      <span class="null-subtle">(null)</span>
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
                  {/if}
                {/each}
              {/if}
            </div>
          </div>
        </div>

        <!-- BOTTOM AREA: Full-Width Portrait SQL Keyboard -->
        {#if !hideKeyboard}
          <div class="vertical-keyboard-panel">
            <!-- Row 1: Numbers 1-0 with Symbols -->
            <div class="vk-row">
              <button class="k dual-key" on:pointerdown={(e) => handleKeypadPress('1', e)}><span class="ks-sub">!</span><span class="ks-main">1</span></button>
              <button class="k dual-key" on:pointerdown={(e) => handleKeypadPress('2', e)}><span class="ks-sub">@</span><span class="ks-main">2</span></button>
              <button class="k dual-key" on:pointerdown={(e) => handleKeypadPress('3', e)}><span class="ks-sub">#</span><span class="ks-main">3</span></button>
              <button class="k dual-key" on:pointerdown={(e) => handleKeypadPress('4', e)}><span class="ks-sub">$</span><span class="ks-main">4</span></button>
              <button class="k dual-key" on:pointerdown={(e) => handleKeypadPress('5', e)}><span class="ks-sub">%</span><span class="ks-main">5</span></button>
              <button class="k dual-key" on:pointerdown={(e) => handleKeypadPress('6', e)}><span class="ks-sub">^</span><span class="ks-main">6</span></button>
              <button class="k dual-key" on:pointerdown={(e) => handleKeypadPress('7', e)}><span class="ks-sub">&amp;</span><span class="ks-main">7</span></button>
              <button class="k dual-key" on:pointerdown={(e) => handleKeypadPress('8', e)}><span class="ks-sub">*</span><span class="ks-main">8</span></button>
              <button class="k dual-key" on:pointerdown={(e) => handleKeypadPress('9', e)}><span class="ks-sub">(</span><span class="ks-main">9</span></button>
              <button class="k dual-key" on:pointerdown={(e) => handleKeypadPress('0', e)}><span class="ks-sub">)</span><span class="ks-main">0</span></button>
            </div>

            <!-- Row 2: QWERTY -->
            <div class="vk-row">
              <button class="k" on:pointerdown={(e) => handleKeypadPress('q', e)}>{capsLock ? 'Q' : 'q'}<span class="kh">UNQ</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('w', e)}>{capsLock ? 'W' : 'w'}<span class="kh">WHERE</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('e', e)}>{capsLock ? 'E' : 'e'}<span class="kh">EXISTS</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('r', e)}>{capsLock ? 'R' : 'r'}<span class="kh">ROUND</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('t', e)}>{capsLock ? 'T' : 't'}<span class="kh">TABLE</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('y', e)}>{capsLock ? 'Y' : 'y'}<span class="kh">SYS</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('u', e)}>{capsLock ? 'U' : 'u'}<span class="kh">UPDATE</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('i', e)}>{capsLock ? 'I' : 'i'}<span class="kh">INSERT</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('o', e)}>{capsLock ? 'O' : 'o'}<span class="kh">ORDER</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('p', e)}>{capsLock ? 'P' : 'p'}<span class="kh">PK</span></button>
            </div>

            <!-- Row 3: ASDFGHJKL; -->
            <div class="vk-row">
              <button class="k" on:pointerdown={(e) => handleKeypadPress('a', e)}>{capsLock ? 'A' : 'a'}<span class="kh">AND</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('s', e)}>{capsLock ? 'S' : 's'}<span class="kh">SELECT</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('d', e)}>{capsLock ? 'D' : 'd'}<span class="kh">DEL</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('f', e)}>{capsLock ? 'F' : 'f'}<span class="kh">FROM</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('g', e)}>{capsLock ? 'G' : 'g'}<span class="kh">GROUP</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('h', e)}>{capsLock ? 'H' : 'h'}<span class="kh">HAVING</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('j', e)}>{capsLock ? 'J' : 'j'}<span class="kh">JOIN</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('k', e)}>{capsLock ? 'K' : 'k'}<span class="kh">CHECK</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('l', e)}>{capsLock ? 'L' : 'l'}<span class="kh">LIKE</span></button>
              <button class="k dual-key sy" on:pointerdown={(e) => handleKeypadPress(';', e)}><span class="ks-sub">:</span><span class="ks-main">;</span></button>
            </div>

            <!-- Row 4: Shift, ZXCVBNM, Comma, Backspace -->
            <div class="vk-row">
              <button 
                class="k s caps-btn-vk" 
                class:on={capsLock} 
                on:pointerdown={(e) => handleKeypadPress('Caps', e)}
                title="Shift / Caps Lock"
                aria-label="Shift / Caps Lock"
              >
                <svg class="shift-icon" width="18" height="18" viewBox="0 0 24 24" fill={capsLock ? "currentColor" : "none"} stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 3l7 7h-4v9h-6v-9H5l7-7z"/>
                </svg>
              </button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('z', e)}>{capsLock ? 'Z' : 'z'}<span class="kh">COUNT</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('x', e)}>{capsLock ? 'X' : 'x'}<span class="kh">MIN</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('c', e)}>{capsLock ? 'C' : 'c'}<span class="kh">CREATE</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('v', e)}>{capsLock ? 'V' : 'v'}<span class="kh">VALUES</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('b', e)}>{capsLock ? 'B' : 'b'}<span class="kh">BY</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('n', e)}>{capsLock ? 'N' : 'n'}<span class="kh">NULL</span></button>
              <button class="k" on:pointerdown={(e) => handleKeypadPress('m', e)}>{capsLock ? 'M' : 'm'}<span class="kh">MAX</span></button>
              <button class="k dual-key sy" on:pointerdown={(e) => handleKeypadPress(',', e)}><span class="ks-sub">&lt;</span><span class="ks-main">,</span></button>
              <button class="k bk bk-btn-vk" on:pointerdown={(e) => handleKeypadPress('Back', e)}>⌫</button>
            </div>

            <!-- Row 5: Tab, Dot, Quotes, Spacebar, Minus, Equals, Enter -->
            <div class="vk-row vk-bottom-row">
              <button class="k s vk-tab" on:pointerdown={(e) => handleKeypadPress('Tab', e)}>Tab</button>
              <button class="k dual-key sy vk-sym-sm" on:pointerdown={(e) => handleKeypadPress('.', e)}><span class="ks-sub">&gt;</span><span class="ks-main">.</span></button>
              <button class="k dual-key sy vk-sym-sm" on:pointerdown={(e) => handleKeypadPress("'", e)}><span class="ks-sub">"</span><span class="ks-main">'</span></button>
              
              <button 
                class="k spbar vk-spbar-btn" 
                on:pointerdown={(e) => handleKeypadPress(' ', e)}
              >
                Space
              </button>

              <button class="k dual-key sy vk-sym-sm" on:pointerdown={(e) => handleKeypadPress('-', e)}><span class="ks-sub">_</span><span class="ks-main">-</span></button>
              <button class="k dual-key sy vk-sym-sm" on:pointerdown={(e) => handleKeypadPress('=', e)}><span class="ks-sub">+</span><span class="ks-main">=</span></button>
              <button class="k ent vk-ent" on:pointerdown={(e) => handleKeypadPress('Enter', e)}>
                ⏎
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- TABLE PREVIEW MODAL / BOTTOM SHEET FOR MOBILE -->
  {#if showTablePreviewModal}
    {@const curTable = $tablesStore[previewTableName]}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="table-modal-overlay" on:click|self={closeTablePreview}>
      <div class="table-modal-card">
        <div class="table-modal-header">
          <div class="table-modal-title">
            <span class="badge">TABLE</span>
            <b>{previewTableName.toUpperCase()}</b>
            <span class="pill-count">{curTable ? curTable.rows.length : 0} rows</span>
          </div>
          <div class="table-modal-actions">
            {#if schemaInfo && schemaInfo.tableNames && schemaInfo.tableNames.length > 1}
              <select 
                class="table-modal-select" 
                value={previewTableName} 
                on:change={(e) => previewTableName = e.target.value}
              >
                {#each schemaInfo.tableNames as tb}
                  <option value={tb}>{tb.toUpperCase()}</option>
                {/each}
              </select>
            {/if}
            <button class="table-modal-close" on:click={closeTablePreview} title="Close Preview">✕ Close</button>
          </div>
        </div>

        <div class="table-modal-body">
          <!-- Schema Column Pills -->
          <div class="table-schema-pills">
            {#if curTable}
              {#each curTable.columns as col}
                <span class="schema-pill" class:is-pk={col.isPk}>
                  {col.isPk ? '🔑 ' : ''}<strong>{col.name.toLowerCase()}</strong>
                  <small>[{col.type.toLowerCase()}]</small>
                </span>
              {/each}
            {/if}
          </div>

          <!-- Quick Query Action Bar -->
          <div class="table-quick-actions">
            <button 
              class="table-quick-btn" 
              on:click={() => { insertText('SELECT * FROM ' + previewTableName + ';\n'); closeTablePreview(); }}
            >
              + SELECT * FROM {previewTableName}
            </button>
            <button 
              class="table-quick-btn" 
              on:click={() => { insertText('DESC ' + previewTableName + ';\n'); closeTablePreview(); }}
            >
              + DESC {previewTableName}
            </button>
          </div>

          <!-- Live Table Data Rows -->
          <div class="table-modal-table-wrap">
            {#if !curTable || curTable.rows.length === 0}
              <div class="table-empty-msg">(No rows in table)</div>
            {:else}
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    {#each curTable.columns as col}
                      <th>
                        {col.name.toLowerCase()}
                        {#if col.isPk}<span class="pk-icon" title="Primary Key">🔑</span>{/if}
                      </th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#each curTable.rows as row, idx}
                    <tr>
                      <td class="muted-idx">{idx + 1}</td>
                      {#each curTable.columns as col}
                        <td>
                          {#if row[col.name] === null || row[col.name] === undefined}
                            <span class="null-subtle">(null)</span>
                          {:else}
                            {row[col.name]}
                          {/if}
                        </td>
                      {/each}
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .mobile-keyboard-root {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--pg, #e9edf3);
    padding: 4px;
    padding-top: max(4px, env(safe-area-inset-top, 0px));
    padding-bottom: max(4px, env(safe-area-inset-bottom, 0px));
    padding-left: max(4px, env(safe-area-inset-left, 0px));
    padding-right: max(4px, env(safe-area-inset-right, 0px));
    box-sizing: border-box;
    overflow: hidden;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    position: relative;
  }

  .mobile-keyboard-root.theme-light {
    --pg: #e9edf3;
    --pgfg: #26303f;
    --bg: #ffffff;
    --pn: #f4f7fb;
    --bd: #dbe2ec;
    --fg: #1f2937;
    --mu: #8a94a6;
    --ac: #1d4ed8;
    --acbg: #e8f0fb;
    --acbd: #b9cdf0;
    --key: #fbfcfe;
    --key2: #e3e9f3;
    --ksh: #c8d0dd;
    --kw: #0000ff;
    --cm: #067a06;
    --st: #b45309;
    --nu: #7c3aed;
    --ok: #16a34a;
    --okbg: #dcfce7;
    --er: #dc2626;
    --th: #eef3fa;
  }

  .mobile-keyboard-root.theme-dark {
    --pg: #0b1220;
    --pgfg: #e5e7eb;
    --bg: #0f172a;
    --pn: #131d33;
    --bd: #26324a;
    --fg: #e5e7eb;
    --mu: #7c88a0;
    --ac: #7aa2ff;
    --acbg: #1a2a4d;
    --acbd: #2f4a86;
    --key: #1b2740;
    --key2: #26324f;
    --ksh: #0a0f1c;
    --kw: #7aa2ff;
    --cm: #6ee7a0;
    --st: #f0a35e;
    --nu: #c4a1ff;
    --ok: #22c55e;
    --okbg: #12361f;
    --er: #ef4444;
    --th: #17233d;
  }

  /* MODE SELECTION PROMPT MODAL */
  .mode-prompt-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(6px);
    z-index: 100000 !important;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    box-sizing: border-box;
    animation: promptFadeIn 0.15s ease-out;
  }

  @keyframes promptFadeIn {
    from { opacity: 0; transform: scale(0.97); }
    to { opacity: 1; transform: scale(1); }
  }

  .mode-prompt-card {
    position: relative;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--bd);
    border-radius: 14px;
    padding: 24px 20px 20px;
    max-width: 520px;
    width: 100%;
    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.4);
    text-align: center;
    box-sizing: border-box;
  }

  .prompt-close-btn {
    position: absolute;
    top: 10px;
    right: 12px;
    background: transparent;
    border: none;
    font-size: 18px;
    color: var(--mu);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    line-height: 1;
    transition: all 0.12s;
  }

  .prompt-close-btn:hover {
    background: var(--pn);
    color: var(--fg);
  }

  .prompt-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .prompt-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
  }

  .prompt-desc {
    margin: 0 0 18px;
    font-size: 13px;
    color: var(--mu);
    line-height: 1.4;
  }

  .mode-cards-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  @media (max-width: 440px) {
    .mode-cards-grid {
      grid-template-columns: 1fr;
    }
  }

  .mode-card {
    background: var(--pn);
    border: 2px solid var(--bd);
    border-radius: 12px;
    padding: 16px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transition: all 0.18s ease;
    text-align: center;
    position: relative;
    color: var(--fg);
  }

  .mode-card:hover, .mode-card:focus {
    border-color: var(--ac);
    background: var(--acbg);
    transform: translateY(-2px);
  }

  .mode-card.is-active {
    border-color: var(--ac);
    background: var(--acbg);
  }

  .mode-card-icon {
    color: var(--ac);
    margin-bottom: 10px;
  }

  .mode-card-title {
    font-weight: 700;
    font-size: 15px;
    margin-bottom: 6px;
  }

  .mode-card-subtitle {
    font-size: 11px;
    color: var(--mu);
    line-height: 1.35;
  }

  .mode-current-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    background: var(--ac);
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 999px;
  }

  /* DEVICE CONTAINER */
  .dev {
    display: flex;
    flex-direction: column;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--bd);
    border-radius: 14px;
    overflow: visible;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
  }

  /* Landscape dev styling */
  .dev.landscape {
    width: 844px;
    height: 390px;
    transform-origin: center center;
    flex-shrink: 0;
  }

  /* Vertical dev styling */
  .dev.vertical {
    width: 100%;
    max-width: min(640px, 100%);
    height: 100%;
    max-height: 100%;
    border-radius: 10px;
    box-sizing: border-box;
  }

  header {
    height: 38px;
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 8px 0 10px;
    border-bottom: 1px solid var(--bd);
    background: var(--bg);
    overflow: visible !important;
    position: relative;
    z-index: 5000;
  }

  .badge {
    background: #c8402b;
    color: #fff;
    font-weight: 700;
    font-size: 10px;
    letter-spacing: 0.04em;
    padding: 3px 7px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  header b {
    font-size: 12px;
    flex: 0 1 auto;
    color: var(--fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: 480px) {
    header b {
      display: none;
    }
  }

  .hb {
    height: 26px;
    border-radius: 6px;
    border: 1px solid var(--bd);
    background: var(--bg);
    color: var(--fg);
    font: 600 11px 'Inter', sans-serif;
    padding: 0 8px;
    cursor: pointer;
    touch-action: manipulation;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .hb.on {
    background: var(--acbg);
    border-color: var(--acbd);
    color: var(--ac);
  }

  .hb.run {
    background: #1e4fd8;
    border-color: #1e4fd8;
    color: #fff;
    font-weight: 700;
  }

  .hb.exit {
    background: var(--pn);
    border-color: var(--bd);
    color: var(--ac);
  }

  /* View Dropdown Styles */
  .menu-dropdown-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  .menu-trigger-btn {
    font-weight: 700;
    gap: 4px;
    background: var(--bg);
  }

  .view-menu-popover {
    position: absolute;
    top: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    width: 220px;
    background: var(--bg);
    border: 1px solid var(--bd);
    border-radius: 10px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45), 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 99999 !important;
    display: flex;
    flex-direction: column;
    padding: 6px;
    gap: 3px;
    box-sizing: border-box;
    animation: menuFadeIn 0.15s ease-out;
  }

  @keyframes menuFadeIn {
    from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .view-menu-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px 6px 8px;
    border-bottom: 1px solid var(--bd);
    font-size: 11px;
    font-weight: 700;
    color: var(--mu);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .view-menu-close-btn {
    background: transparent;
    border: none;
    color: var(--mu);
    font-size: 13px;
    cursor: pointer;
    padding: 0 4px;
  }

  .view-menu-option {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    color: var(--fg);
    transition: background 0.12s;
  }

  .view-menu-option:hover {
    background: var(--pn);
  }

  .view-menu-option.is-active {
    background: var(--acbg);
    border-color: var(--acbd);
  }

  .vmo-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .vmo-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .vmo-label {
    font-size: 13px;
    font-weight: 700;
    color: var(--fg);
    line-height: 1.2;
  }

  .view-menu-option.is-active .vmo-label {
    color: var(--ac);
  }

  .vmo-sub {
    font-size: 10px;
    color: var(--mu);
    line-height: 1.2;
    margin-top: 1px;
  }

  .vmo-badge {
    font-size: 10px;
    font-weight: 700;
    background: var(--ac);
    color: #fff;
    padding: 2px 6px;
    border-radius: 10px;
    flex-shrink: 0;
  }

  .view-menu-sep {
    height: 1px;
    background: var(--bd);
    margin: 3px 0;
  }

  .vmo-desktop:hover {
    background: rgba(30, 79, 216, 0.1);
  }

  /* LANDSCAPE MAIN GRID */
  .landscape-main {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 180px 1fr 210px;
    gap: 6px;
    padding: 6px;
    background: var(--pn);
    transition: grid-template-columns 0.22s ease;
  }

  .landscape-main.hide {
    grid-template-columns: 0 1fr 0;
    gap: 0;
  }

  .side {
    min-height: 0;
    overflow: hidden;
    transition: opacity 0.15s;
  }

  .landscape-main.hide .side {
    opacity: 0;
    pointer-events: none;
  }

  .kb {
    display: grid;
    gap: 4px;
    height: 100%;
    align-content: end;
    grid-template-rows: repeat(5, 58px);
  }

  .kb.l { grid-template-columns: repeat(5, 1fr); }
  .kb.r { grid-template-columns: repeat(6, 1fr); }

  /* VERTICAL MAIN LAYOUT */
  .vertical-layout-main {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--pn);
    gap: 4px;
    padding: 4px;
    overflow: hidden;
    box-sizing: border-box;
  }

  .vertical-editor-area {
    flex: 1;
    min-height: 0;
    border-radius: 8px;
    overflow: hidden;
  }

  .vertical-code {
    flex: 1;
    min-height: 48px;
  }

  .vertical-tw {
    flex: 1;
    max-height: 100%;
  }

  .vertical-keyboard-panel {
    flex: none;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 4px;
    background: var(--bg);
    border: 1px solid var(--bd);
    border-radius: 8px;
    touch-action: manipulation;
    box-sizing: border-box;
  }

  .vk-row {
    display: flex;
    gap: 4px;
    height: clamp(38px, 6.2vh, 48px);
    box-sizing: border-box;
  }

  .vk-row .k {
    flex: 1;
    height: 100%;
    font-size: 14px;
  }

  .caps-btn-vk {
    flex: 1.2 !important;
  }

  .bk-btn-vk {
    flex: 1.2 !important;
  }

  .vk-bottom-row {
    height: clamp(40px, 6.5vh, 50px);
  }

  .vk-tab {
    flex: 1.2 !important;
    font-weight: 600;
  }

  .vk-sym-sm {
    flex: 1 !important;
  }

  .vk-spbar-btn {
    flex: 3 !important;
    margin: 0 !important;
    height: 100% !important;
    font-size: 14px;
    font-weight: 600;
  }

  .vk-ent {
    flex: 1.5 !important;
  }

  .k.dual-key {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    line-height: 1.1;
    padding: 2px 0;
    position: relative;
  }

  .k.dual-key .ks-sub {
    font-size: 10px;
    font-weight: 700;
    color: var(--mu);
    line-height: 1;
    pointer-events: none;
    margin-bottom: 2px;
    transition: color 0.15s ease, transform 0.15s ease;
  }

  .k.dual-key .ks-main {
    font-size: 15px;
    font-weight: 600;
    line-height: 1;
    pointer-events: none;
    transition: opacity 0.15s ease;
  }

  /* When Shift / Caps Lock is on, illuminate the symbols! */
  .mobile-keyboard-root.shift-on .k.dual-key .ks-sub {
    color: var(--ac);
    font-weight: 800;
    transform: scale(1.18);
  }

  .mobile-keyboard-root.shift-on .k.dual-key .ks-main {
    opacity: 0.55;
  }

  /* CENTER DISPLAY (Editor + Output) */
  .center {
    background: var(--bg);
    border: 1px solid var(--bd);
    border-radius: 8px;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .center.showout .inp { display: none; }
  .center:not(.showout) .out { display: none; }

  .inp, .out {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* Categorized Shortcuts Bar (DDL, DML, DQL, DCL, TCL, Math, Regex, etc.) */
  .sql-shortcuts-bar {
    flex: none;
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid var(--bd);
    background: var(--bg);
    overflow: hidden;
  }

  .cat-tabs-row {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    padding: 3px 6px 2px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    border-bottom: 1px solid var(--bd);
    background: var(--pn);
    height: 27px;
    box-sizing: border-box;
    align-items: center;
  }

  .cat-tabs-row::-webkit-scrollbar,
  .chips-items-row::-webkit-scrollbar {
    display: none;
  }

  .cat-tab-btn {
    flex: none;
    height: 21px;
    padding: 0 7px;
    border-radius: 4px;
    border: 1px solid var(--bd);
    background: var(--bg);
    color: var(--mu);
    font: 700 10.5px 'Inter', sans-serif;
    cursor: pointer;
    touch-action: manipulation;
    white-space: nowrap;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cat-tab-btn.auto-tab {
    font-weight: 800;
  }

  .cat-tab-btn.active {
    background: var(--ac);
    color: #ffffff;
    border-color: var(--ac);
    box-shadow: 0 1px 3px rgba(29, 78, 216, 0.25);
  }

  .chips-items-row {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    padding: 3px 6px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    background: var(--bg);
    height: 31px;
    box-sizing: border-box;
    align-items: center;
  }

  .chip {
    flex: none;
    height: 24px;
    border: 1px solid var(--bd);
    background: var(--key);
    border-radius: 5px;
    font: 600 11.5px 'Courier New', monospace;
    padding: 0 7px;
    color: var(--fg);
    cursor: pointer;
    touch-action: manipulation;
    white-space: nowrap;
    user-select: none;
    -webkit-user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 1px rgba(0,0,0,0.03);
  }

  .chip:active {
    transform: translateY(1px);
    background: var(--key2);
  }

  .chip.tap-pending {
    border-color: var(--ac);
    background: var(--acbg);
    box-shadow: 0 0 0 2px var(--acbd);
    transform: scale(0.96);
    transition: all 0.1s ease;
  }

  .shift-icon {
    display: inline-block;
    vertical-align: middle;
    pointer-events: none;
  }

  .chip.kw { color: var(--kw); font-weight: 700; }
  .chip.fn { color: #0284c7; font-weight: 700; }
  .chip.tb { color: var(--ok); font-weight: 700; }
  .chip.cl { color: var(--ac); font-weight: 600; }

  .chip-badge {
    font-size: 8.5px;
    font-weight: 700;
    color: var(--mu);
    margin-left: 4px;
    opacity: 0.85;
    text-transform: uppercase;
  }

  .chip.table-switch-btn {
    background: var(--acbg);
    color: var(--ac);
    border-color: var(--acbd);
    font-weight: 700;
  }
  .chip.table-switch-btn.active {
    background: var(--ac);
    color: #ffffff;
    border-color: var(--ac);
  }

  .chip.preview-action-chip {
    background: #10b981;
    color: #ffffff;
    border-color: #059669;
    font-weight: 700;
  }

  .chip-divider {
    width: 1px;
    height: 16px;
    background: var(--bd);
    margin: 0 2px;
    flex: none;
  }

  /* Table Preview Modal for Mobile */
  .table-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.7);
    backdrop-filter: blur(4px);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    box-sizing: border-box;
    overflow-y: auto;
  }

  .table-modal-card {
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--bd);
    border-radius: 12px;
    width: 100%;
    max-width: 620px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35);
    overflow: hidden;
    min-width: 0;
    box-sizing: border-box;
  }

  .table-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    background: var(--pn);
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
    min-width: 0;
    box-sizing: border-box;
  }

  .table-modal-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    min-width: 0;
    overflow: hidden;
  }

  .table-modal-title b {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .table-modal-title .pill-count {
    font-size: 11px;
    color: var(--mu);
    font-weight: 600;
    white-space: nowrap;
  }

  .table-modal-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .table-modal-select {
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--bd);
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    padding: 3px 6px;
    outline: none;
    max-width: 120px;
  }

  .table-modal-close {
    background: #ef4444;
    color: #ffffff;
    border: 1px solid #dc2626;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    padding: 4px 10px;
    border-radius: 6px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
  }
  .table-modal-close:hover {
    background: #dc2626;
    color: #ffffff;
  }

  .table-modal-body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    box-sizing: border-box;
  }

  .table-schema-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--bd);
    min-width: 0;
  }

  .schema-pill {
    background: var(--pn);
    border: 1px solid var(--bd);
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 11px;
    color: var(--fg);
  }
  .schema-pill.is-pk {
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.1);
  }
  .schema-pill small {
    color: var(--mu);
    font-weight: 600;
  }

  .table-quick-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .table-quick-btn {
    background: var(--key);
    border: 1px solid var(--bd);
    color: var(--ac);
    border-radius: 4px;
    padding: 3px 8px;
    font: 600 11px 'Courier New', monospace;
    cursor: pointer;
    white-space: nowrap;
  }
  .table-quick-btn:hover {
    background: var(--acbg);
  }

  .table-modal-table-wrap {
    flex: 1;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
    max-height: 240px;
    border: 1px solid var(--bd);
    border-radius: 6px;
    background: var(--bg);
    min-width: 0;
  }

  .table-modal-table-wrap table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .table-modal-table-wrap th {
    background: var(--pn);
    color: var(--ac);
    text-align: left;
    padding: 5px 8px;
    border-bottom: 2px solid var(--bd);
    white-space: nowrap;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .table-modal-table-wrap td {
    padding: 5px 8px;
    border-bottom: 1px solid var(--bd);
    white-space: nowrap;
  }

  .table-empty-msg {
    padding: 20px;
    text-align: center;
    color: var(--mu);
    font-size: 13px;
  }

  .code {
    flex: 1;
    min-height: 0;
    display: flex;
    position: relative;
    font: 14px/20px 'Courier New', Consolas, monospace;
    background: var(--bg);
  }

  .gut {
    width: 32px;
    flex: none;
    overflow: hidden;
    text-align: right;
    padding: 6px 4px 0 0;
    color: var(--mu);
    white-space: pre;
    user-select: none;
    border-right: 1px solid var(--bd);
    font-size: 12px;
  }

  .ew {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .hl, .ta {
    position: absolute;
    inset: 0;
    margin: 0;
    padding: 6px 8px;
    font: inherit;
    white-space: pre;
    border: 0;
    overflow: auto;
    tab-size: 4;
  }

  .hl {
    pointer-events: none;
    overflow: hidden;
    color: var(--fg);
  }

  /* inputmode="none" stops the native mobile keyboard from popping up */
  .ta {
    background: transparent;
    color: transparent;
    caret-color: var(--fg);
    resize: none;
    outline: 0;
    touch-action: manipulation;
  }

  .ta::selection {
    background: rgba(29, 78, 216, 0.28);
  }

  /* FLOATING AUTOCOMPLETE POPUP (Monaco-like for Mobile) */
  .autocomplete-popup {
    position: absolute;
    min-width: 200px;
    max-width: 280px;
    max-height: 180px;
    background: var(--bg);
    border: 1px solid var(--bd);
    border-radius: 8px;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
    z-index: 2000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
    animation: acPopFade 0.12s ease-out;
  }

  @keyframes acPopFade {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .ac-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 3px 8px;
    background: var(--pn);
    border-bottom: 1px solid var(--bd);
    font-size: 10px;
    font-weight: 700;
    color: var(--mu);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  .ac-close {
    background: transparent;
    border: none;
    color: var(--mu);
    font-size: 11px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  }

  .ac-close:hover {
    color: var(--fg);
  }

  .ac-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding: 3px;
    gap: 2px;
    max-height: 145px;
  }

  .ac-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--fg);
    font: 600 12px 'Courier New', monospace;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ac-item:hover, .ac-item:active, .ac-item.active {
    background: var(--acbg);
    border-color: var(--acbd);
  }

  .ac-badge {
    font-size: 9px;
    font-weight: 800;
    font-family: 'Inter', sans-serif;
    padding: 1px 4px;
    border-radius: 3px;
    flex-shrink: 0;
    letter-spacing: 0.04em;
  }

  .ac-badge.tb {
    background: #059669;
    color: #fff;
  }

  .ac-badge.cl {
    background: #2563eb;
    color: #fff;
  }

  .ac-badge.kw {
    background: #7c3aed;
    color: #fff;
  }

  .ac-badge.fn {
    background: #d97706;
    color: #fff;
  }

  .ac-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ac-type {
    font-size: 9px;
    color: var(--mu);
    margin-left: auto;
    font-family: 'Inter', sans-serif;
  }

  .hl :global(b) { font-weight: 700; color: var(--kw); }
  .hl :global(.cm) { color: var(--cm); font-style: italic; }
  .hl :global(.st) { color: var(--st); }
  .hl :global(.nu) { color: var(--nu); }

  .spbar {
    flex: none;
    margin: 4px 6px 6px;
    height: 32px;
    border: 1px solid var(--bd);
    border-radius: 6px;
    background: var(--key);
    box-shadow: 0 2px 0 var(--ksh);
    color: var(--mu);
    font: 600 12px 'Inter', sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;
  }

  .spbar:active {
    transform: translateY(2px);
    box-shadow: none;
  }

  .landscape-main.hide .spbar {
    display: none;
  }

  .oh {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--bd);
    font-weight: 700;
  }

  .pillok {
    font-size: 11px;
    font-weight: 600;
    color: var(--ok);
    background: var(--okbg);
    border-radius: 10px;
    padding: 2px 8px;
  }

  .pillok.er {
    color: var(--er);
    background: transparent;
    padding: 0;
  }

  .oh button {
    margin-left: auto;
    border: 0;
    background: none;
    color: var(--mu);
    font: 600 12px 'Inter', sans-serif;
    cursor: pointer;
  }

  .tw {
    flex: 1;
    overflow: auto;
    padding: 8px;
  }

  .out-empty {
    padding: 20px;
    text-align: center;
    color: var(--mu);
    font-size: 12px;
  }

  .res-err-box {
    color: var(--er);
    background: rgba(220, 38, 38, 0.08);
    border-left: 3px solid var(--er);
    padding: 8px 10px;
    border-radius: 4px;
    margin-bottom: 8px;
    font-size: 12px;
  }

  .res-cmd {
    margin-top: 4px;
    font-size: 11px;
    opacity: 0.8;
  }

  .res-msg-box {
    color: var(--ok);
    font-weight: 600;
    font-size: 12px;
    margin-bottom: 6px;
  }

  .res-tbl-wrap {
    overflow-x: auto;
    margin-bottom: 12px;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 12px;
  }

  th {
    background: var(--th);
    color: var(--ac);
    text-align: left;
    padding: 5px 8px;
    border-bottom: 2px solid var(--bd);
    font-weight: 700;
  }

  td {
    padding: 5px 8px;
    border-bottom: 1px solid var(--bd);
  }

  td.muted {
    color: var(--mu);
    width: 28px;
    text-align: center;
    font-size: 11px;
  }

  .null-subtle {
    color: var(--mu);
    font-style: italic;
  }

  .k {
    position: relative;
    border: 1px solid var(--bd);
    border-radius: 6px;
    background: var(--key);
    color: var(--fg);
    font: 500 15px 'Inter', sans-serif;
    cursor: pointer;
    box-shadow: 0 2px 0 var(--ksh);
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
    padding: 0;
    min-width: 0;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .k .kh {
    position: absolute;
    bottom: 1.5px;
    right: 2.5px;
    font: 700 6.5px 'Inter', sans-serif;
    color: var(--ac);
    opacity: 0.75;
    pointer-events: none;
    line-height: 1;
    letter-spacing: -0.02em;
    user-select: none;
    -webkit-user-select: none;
  }

  .k:active {
    transform: translateY(2px);
    box-shadow: none;
  }

  .k.sy {
    background: var(--acbg);
    border-color: var(--acbd);
    color: var(--ac);
    font-weight: 700;
    font-size: 15px;
  }

  .k.s {
    background: var(--key2);
    font-size: 12px;
    font-weight: 600;
  }

  .k.on {
    background: var(--ac);
    border-color: var(--ac);
    color: #fff;
  }

  .k.ent {
    background: var(--ac);
    border-color: var(--ac);
    color: #fff;
    font-size: 18px;
  }

  .k.bk {
    background: var(--key2);
    color: var(--er);
    font-size: 17px;
  }
</style>
