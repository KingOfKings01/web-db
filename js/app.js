/**
 * Main Application Controller for Oracle SQL Web Studio
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Oracle Mock Database
  const db = new OracleDatabase();

  // 2. Initialize Visual Canvas / Compare Board
  const canvasModal = document.getElementById('table-canvas-modal');
  const canvasBoard = new TableCanvasBoard(canvasModal, db);

  // 3. Sample queries dictionary
  const SAMPLE_QUERIES = {
    default: `-- Demo Queries (Insert & Select)
SELECT name, course_id FROM students;
SELECT * FROM courses;`,

    join: `-- Inner Join & Comma Join between Students and Courses
SELECT s.name, s.city, s.marks, c.course_name, c.fee
FROM students s
INNER JOIN courses c ON s.course_id = c.course_id
WHERE s.marks >= 75
ORDER BY s.marks DESC;`,

    aggregate: `-- Aggregates and GROUP BY
SELECT c.course_name, 
       COUNT(s.id) AS total_enrolled, 
       ROUND(AVG(s.marks), 1) AS avg_marks,
       MAX(s.marks) AS top_score
FROM courses c
LEFT JOIN students s ON c.course_id = s.course_id
GROUP BY c.course_name
ORDER BY total_enrolled DESC;`,

    functions: `-- Built-in Oracle Functions: NVL, DECODE, UPPER, SYSDATE
SELECT name,
       UPPER(city) AS city_upper,
       marks,
       DECODE(course_id, 101, 'Science Dept', 102, 'Maths Dept', 'General') AS department,
       SYSDATE AS evaluated_on
FROM students;`,

    view: `-- Create a View in Oracle and Query it
CREATE OR REPLACE VIEW high_scorers AS
SELECT name, city, marks, course_id 
FROM students 
WHERE marks >= 80;

-- Query the newly created view
SELECT * FROM high_scorers;`,

    ddl: `-- Create a new Table and Alter it
CREATE TABLE teachers (
  teacher_id NUMBER PRIMARY KEY,
  name VARCHAR2(30) NOT NULL,
  subject VARCHAR2(30),
  salary NUMBER
);

INSERT INTO teachers VALUES (1, 'Dr. Sharma', 'Science', 75000);
INSERT INTO teachers VALUES (2, 'Prof. Verma', 'Maths', 82000);

SELECT * FROM teachers;`,

    errors: `-- Test Oracle ORA- simulated error messages
-- 1. Table does not exist (ORA-00942)
SELECT * FROM enrollments;

-- 2. Invalid identifier (ORA-00904)
-- SELECT unknown_column FROM students;

-- 3. Duplicate Primary Key (ORA-00001)
-- INSERT INTO courses VALUES (101, 'Duplicate Science', 999);`
  };

  // 4. Initialize SQL Editor
  const editorMount = document.getElementById('editor-mount');
  const selectionIndicator = document.getElementById('selection-indicator');
  const btnRunSelected = document.getElementById('btn-run-selected');
  const runSelectedLabel = document.getElementById('run-selected-label');

  const editor = new SqlEditor(editorMount, {
    initialValue: SAMPLE_QUERIES.default,
    onSelectionChange: (sel) => {
      if (sel.hasSelection) {
        const lines = sel.selectedText.split('\n').length;
        selectionIndicator.textContent = `Selection: ${sel.selectedText.length} chars (${lines} line${lines > 1 ? 's' : ''})`;
        selectionIndicator.classList.add('active');
        btnRunSelected.classList.add('glow');
        runSelectedLabel.textContent = `Run Selected (${lines}L)`;
      } else {
        selectionIndicator.classList.remove('active');
        btnRunSelected.classList.remove('glow');
        runSelectedLabel.textContent = 'Run Selected';
      }
    },
    onRunQuery: (sql) => {
      runQueryScript(sql);
    },
    onRunSelected: (sql) => {
      runQueryScript(sql);
    }
  });

  // 5. Left Schema Sidebar Renderer
  const schemaContainer = document.getElementById('schema-tree-container');

  function renderSchemaTree() {
    const tables = db.getTables();
    const views = db.getViews();
    let html = '';

    // Tables
    for (const [tableName, table] of Object.entries(tables)) {
      if (tableName === 'DUAL') continue;
      html += `
        <div class="schema-table-item" data-table="${tableName}">
          <div class="schema-table-header" onclick="window.toggleSchemaTable('${tableName}')">
            <div class="schema-table-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
              <span>${capitalize(tableName)}</span>
            </div>
            <span class="schema-toggle-icon" id="toggle-icon-${tableName}">[-]</span>
          </div>
          <div class="schema-columns-list" id="col-list-${tableName}">
            ${table.columns.map(c => `
              <div class="schema-column-row" onclick="window.insertColumnToEditor('${c.name.toLowerCase()}')" title="Click to insert column into SQL editor">
                <span class="schema-col-name">${c.isPk ? '<span class="schema-col-pk-badge">🔑</span>' : ''}${c.name.toLowerCase()}</span>
                <span class="schema-col-type">[${c.type.toLowerCase()}]</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Views if any
    const viewNames = Object.keys(views);
    if (viewNames.length > 0) {
      html += `<div style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin: 12px 0 6px 4px; text-transform: uppercase;">Views</div>`;
      for (const viewName of viewNames) {
        html += `
          <div class="schema-table-item" data-view="${viewName}">
            <div class="schema-table-header" onclick="window.insertQueryToEditor('SELECT * FROM ${viewName};')">
              <div class="schema-table-title" style="color: #0d9488;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <span>${capitalize(viewName)}</span>
              </div>
              <span class="schema-toggle-icon">[view]</span>
            </div>
          </div>
        `;
      }
    }

    schemaContainer.innerHTML = html;
  }

  window.toggleSchemaTable = function(tableName) {
    const list = document.getElementById(`col-list-${tableName}`);
    const icon = document.getElementById(`toggle-icon-${tableName}`);
    if (!list) return;
    if (list.style.display === 'none') {
      list.style.display = 'block';
      if (icon) icon.textContent = '[-]';
    } else {
      list.style.display = 'none';
      if (icon) icon.textContent = '[+]';
    }
  };

  window.insertColumnToEditor = function(colName) {
    editor.insertAtCursor(colName);
  };

  window.insertQueryToEditor = function(query) {
    editor.setValue(editor.getValue() + '\n\n' + query);
  };

  // 6. Right Sidebar Available Tables Live Preview
  const rightTablesContainer = document.getElementById('available-tables-container');

  function renderRightTablesPreview() {
    const tables = db.getTables();
    let html = '';

    for (const [tableName, table] of Object.entries(tables)) {
      if (tableName === 'DUAL') continue;
      html += `
        <div class="available-table-card">
          <div class="card-head">
            <span class="table-name">${capitalize(tableName)}</span>
            <span class="table-count">${table.rows.length} rows</span>
          </div>
          <div style="overflow-x: auto;">
            <table>
              <thead>
                <tr>
                  ${table.columns.map(c => `<th>${c.name.toLowerCase()}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${table.rows.length === 0 ? `<tr><td colspan="${table.columns.length}" style="text-align: center; color: var(--text-subtle);">(Empty)</td></tr>` : 
                  table.rows.slice(0, 10).map(row => `
                    <tr>
                      ${table.columns.map(c => {
                        const v = row[c.name];
                        return `<td>${v === null || v === undefined ? '<span class="null-pill">null</span>' : v}</td>`;
                      }).join('')}
                    </tr>
                  `).join('')
                }
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    rightTablesContainer.innerHTML = html;
  }

  // Helper for capitalization
  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  // 7. Execute Query Script and Render Output
  const outputDisplay = document.getElementById('output-display');
  const outputStatusPill = document.getElementById('output-status-pill');


  function runQueryScript(scriptText) {
    if (!scriptText || !scriptText.trim()) return;

    outputStatusPill.className = 'output-status-pill';
    outputStatusPill.textContent = 'Executing...';

    setTimeout(() => {
      try {
        const results = db.executeScript(scriptText);
        renderQueryResults(results);
      } catch (err) {
        renderFatalError(err);
      }
    }, 10);
  }

  function renderQueryResults(results) {
    if (!results || results.length === 0) {
      outputDisplay.innerHTML = `
        <div class="empty-output-state">
          <p>Statement processed. No output returned.</p>
        </div>
      `;
      outputStatusPill.textContent = 'Ready';
      return;
    }

    let hasError = false;
    let totalRows = 0;
    let html = '';

    results.forEach((res, idx) => {
      if (res.type === 'ERROR') {
        hasError = true;
        html += `
          <div class="oracle-error-box">
            <div class="oracle-error-header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>${escapeHtml(res.message)}</span>
            </div>
            <div class="oracle-error-sql">
              Command: <code>${escapeHtml(res.command)}</code>
            </div>
          </div>
        `;
        return;
      }

      if (res.type === 'DML' || res.type === 'DDL') {
        html += `
          <div class="query-result-block">
            <div class="query-result-header">
              <span class="query-command-text">${escapeHtml(res.command)}</span>
              <span class="query-meta-badge">SUCCESS</span>
            </div>
            <div class="dml-feedback-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 6L9 17l-5-5"></path>
              </svg>
              <span>${escapeHtml(res.message)}</span>
            </div>
          </div>
        `;
        return;
      }

      if (res.type === 'SELECT' || res.type === 'DESCRIBE') {
        totalRows += res.rows.length;
        html += `
          <div class="query-result-block">
            <div class="query-result-header">
              <span class="query-meta-badge">${res.rows.length} row${res.rows.length === 1 ? '' : 's'} (${res.executionTimeMs || 0} ms)</span>
            </div>
            <div class="table-responsive">
              <table class="output-data-table">
                <thead>
                  <tr>
                    ${res.columns.map(c => `<th>${escapeHtml(c.toLowerCase())}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${res.rows.length === 0 ? `
                    <tr>
                      <td colspan="${res.columns.length}" style="text-align: center; padding: 18px; color: var(--text-muted); font-style: italic;">
                        0 rows selected.
                      </td>
                    </tr>
                  ` : res.rows.map(row => `
                    <tr>
                      ${res.columns.map(c => {
                        const val = row[c];
                        const isNull = (val === null || val === undefined);
                        return `<td>${isNull ? '<span class="null-pill">(null)</span>' : escapeHtml(String(val))}</td>`;
                      }).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }
    });

    outputDisplay.innerHTML = html;

    if (hasError) {
      outputStatusPill.className = 'output-status-pill error';
      outputStatusPill.textContent = 'Oracle Error';
    } else {
      outputStatusPill.className = 'output-status-pill success';
      outputStatusPill.textContent = `Completed (${totalRows} rows)`;
    }
  }

  function renderFatalError(err) {
    outputStatusPill.className = 'output-status-pill error';
    outputStatusPill.textContent = 'Error';
    outputDisplay.innerHTML = `
      <div class="oracle-error-box">
        <div class="oracle-error-header">
          <span>ORA-00600: internal error code [${escapeHtml(err.message || 'unknown')}]</span>
        </div>
      </div>
    `;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // 8. Run SQL Buttons
  document.getElementById('btn-run-sql').addEventListener('click', () => {
    // If text is selected, run selected; otherwise run all
    const selected = editor.getSelectedText();
    if (selected && selected.trim()) {
      runQueryScript(selected);
    } else {
      runQueryScript(editor.getValue());
    }
  });

  document.getElementById('btn-run-selected').addEventListener('click', () => {
    const selected = editor.getSelectedText();
    if (selected && selected.trim()) {
      runQueryScript(selected);
    } else {
      const current = editor.getCurrentStatement();
      if (current) {
        runQueryScript(current);
      } else {
        runQueryScript(editor.getValue());
      }
    }
  });

  // 9. Full Window Draggable Canvas trigger
  document.getElementById('btn-open-canvas').addEventListener('click', () => {
    canvasBoard.show();
  });

  // 10. Sample Queries Dropdown
  const sampleSelect = document.getElementById('sample-query-select');
  sampleSelect.addEventListener('change', (e) => {
    const key = e.target.value;
    if (SAMPLE_QUERIES[key]) {
      editor.setValue(SAMPLE_QUERIES[key]);
    }
  });

  // 11. Reset DB Button
  document.getElementById('btn-reset-db').addEventListener('click', () => {
    if (confirm('Reset Oracle database to default sample schema (Courses and Students tables)? All custom tables will be restored.')) {
      db.resetDatabase();
      editor.setValue(SAMPLE_QUERIES.default);
      runQueryScript(SAMPLE_QUERIES.default);
    }
  });

  // 12. Editor Fullscreen / Expand toggle
  const editorSection = document.getElementById('editor-section');
  document.getElementById('btn-editor-fullscreen').addEventListener('click', () => {
    editorSection.classList.toggle('fullscreen');
  });

  // 13. Clear Editor Button
  document.getElementById('btn-editor-clear').addEventListener('click', () => {
    editor.setValue('');
  });

  // 14. Clear Output
  document.getElementById('btn-clear-output').addEventListener('click', () => {
    outputDisplay.innerHTML = `
      <div class="empty-output-state">
        <p>Output cleared.</p>
      </div>
    `;
    outputStatusPill.className = 'output-status-pill';
    outputStatusPill.textContent = 'Ready';
  });

  // 15. Sidebar Collapsing
  const sidebarLeft = document.getElementById('sidebar-left');
  const btnToggleLeft = document.getElementById('btn-toggle-left-sidebar');
  const btnUncollapseLeft = document.getElementById('btn-uncollapse-left');

  btnToggleLeft.addEventListener('click', () => {
    sidebarLeft.classList.add('collapsed');
    btnUncollapseLeft.style.display = 'inline-block';
  });

  btnUncollapseLeft.addEventListener('click', () => {
    sidebarLeft.classList.remove('collapsed');
    btnUncollapseLeft.style.display = 'none';
  });

  const sidebarRight = document.getElementById('sidebar-right');
  const btnToggleRight = document.getElementById('btn-toggle-right-sidebar');

  btnToggleRight.addEventListener('click', () => {
    sidebarRight.classList.toggle('collapsed');
    btnToggleRight.textContent = sidebarRight.classList.contains('collapsed') ? '‹' : '›';
  });

  document.getElementById('btn-refresh-preview').addEventListener('click', () => {
    renderRightTablesPreview();
  });

  // 16. Vertical Splitter Resizing between Input and Output
  const splitter = document.getElementById('workspace-splitter');
  let isResizing = false;

  const stopSplitterResize = () => {
    if (isResizing) {
      isResizing = false;
      document.body.classList.remove('is-resizing');
      document.body.style.cursor = '';
    }
  };

  splitter.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    isResizing = true;
    try { splitter.setPointerCapture(e.pointerId); } catch (_) {}
    document.body.classList.add('is-resizing');
    document.body.style.cursor = 'row-resize';
  });

  splitter.addEventListener('pointermove', (e) => {
    if (!isResizing) return;
    if (e.buttons === 0) {
      stopSplitterResize();
      return;
    }
    const workspaceRect = document.getElementById('main-workspace').getBoundingClientRect();
    const newHeight = e.clientY - workspaceRect.top;
    if (newHeight > 80 && newHeight < workspaceRect.height - 80) {
      editorSection.style.height = `${newHeight}px`;
    }
  });

  const onSplitterEnd = (e) => {
    if (isResizing) {
      if (e && e.pointerId) {
        try { splitter.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      stopSplitterResize();
    }
  };

  splitter.addEventListener('pointerup', onSplitterEnd);
  splitter.addEventListener('pointercancel', onSplitterEnd);

  // Global safety release
  window.addEventListener('mouseup', stopSplitterResize);
  window.addEventListener('pointerup', stopSplitterResize);
  window.addEventListener('blur', stopSplitterResize);

  // 17. Dark / Light Theme Toggle
  const themeToggleBtn = document.getElementById('btn-theme-toggle');
  const savedTheme = localStorage.getItem('ORACLE_STUDIO_THEME') || 'theme-light';
  document.body.className = savedTheme;

  themeToggleBtn.addEventListener('click', () => {
    if (document.body.classList.contains('theme-light')) {
      document.body.classList.replace('theme-light', 'theme-dark');
      localStorage.setItem('ORACLE_STUDIO_THEME', 'theme-dark');
    } else {
      document.body.classList.replace('theme-dark', 'theme-light');
      localStorage.setItem('ORACLE_STUDIO_THEME', 'theme-light');
    }
  });

  // 18. Help Modal
  const helpModal = document.getElementById('help-modal');
  document.getElementById('btn-help-modal').addEventListener('click', () => {
    helpModal.classList.add('visible');
  });

  document.getElementById('btn-close-help').addEventListener('click', () => {
    helpModal.classList.remove('visible');
  });

  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
      helpModal.classList.remove('visible');
    }
  });

  // 19. Schema Tree quick button "+ Create Table"
  document.getElementById('btn-schema-new-table').addEventListener('click', () => {
    const template = `\nCREATE TABLE departments (
  dept_id NUMBER PRIMARY KEY,
  dept_name VARCHAR2(30) NOT NULL
);`;
    editor.insertAtCursor(template);
  });

  document.getElementById('btn-schema-refresh').addEventListener('click', () => {
    renderSchemaTree();
    renderRightTablesPreview();
  });

  // 20. Database change listener updates schema and right preview automatically
  db.onChange(() => {
    renderSchemaTree();
    renderRightTablesPreview();
  });

  // Initial renders
  renderSchemaTree();
  renderRightTablesPreview();

  // Run initial queries automatically on load so students see tables immediately!
  runQueryScript(editor.getValue());
});
