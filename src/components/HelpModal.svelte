<script>
  export let visible = false;
  export let onClose = () => {};
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" class:visible={visible} on:click={(e) => { if (e.target === e.currentTarget) onClose(); }}>
  <div class="modal-card">
    <div class="modal-header">
      <h3>Oracle SQL Reference &amp; ORA Error Codes</h3>
      <button class="modal-close-btn" on:click={onClose}>&times;</button>
    </div>
    <div class="modal-body">
      <h4>Supported Oracle Commands:</h4>
      <ul>
        <li><code>SELECT ... FROM ... [WHERE] [GROUP BY] [HAVING] [ORDER BY] [FETCH FIRST n ROWS ONLY]</code></li>
        <li><code>INSERT INTO table_name VALUES (...)</code></li>
        <li><code>UPDATE table_name SET col = val WHERE ...</code></li>
        <li><code>DELETE FROM table_name WHERE ...</code></li>
        <li><code>CREATE TABLE table_name (col1 NUMBER, col2 VARCHAR2(50), ...)</code></li>
        <li><code>DROP TABLE table_name [PURGE]</code></li>
        <li><code>TRUNCATE TABLE table_name</code></li>
        <li><code>CREATE VIEW view_name AS SELECT ...</code></li>
        <li><code>ALTER TABLE table_name ADD / DROP COLUMN</code></li>
        <li><code>DESC table_name</code> or <code>DESCRIBE table_name</code></li>
      </ul>

      <h4>Supported Oracle Functions:</h4>
      <p><code>NVL(col, def)</code>, <code>DECODE(col, v1, r1, ...)</code>, <code>SYSDATE</code>, <code>UPPER()</code>, <code>LOWER()</code>, <code>INITCAP()</code>, <code>SUBSTR()</code>, <code>ROUND()</code>, <code>COUNT()</code>, <code>SUM()</code>, <code>AVG()</code>, <code>MIN()</code>, <code>MAX()</code>, String Concatenation <code>||</code>, <code>DUAL</code> table.</p>

      <h4>Simulated Oracle ORA- Errors:</h4>
      <ul>
        <li><code>ORA-00942</code>: table or view does not exist</li>
        <li><code>ORA-00904</code>: invalid identifier</li>
        <li><code>ORA-00001</code>: unique constraint violated</li>
        <li><code>ORA-01400</code>: cannot insert NULL into column</li>
        <li><code>ORA-01722</code>: invalid number</li>
        <li><code>ORA-00955</code>: name is already used by an existing object</li>
        <li><code>ORA-00979</code>: not a GROUP BY expression</li>
      </ul>

      <h4>Interactive Features:</h4>
      <p>&bull; Click <strong>Run</strong> to execute the SQL in the editor.</p>
      <p>&bull; Click <strong>Tables</strong> in the top bar to open the draggable table workspace.</p>
    </div>
  </div>
</div>
