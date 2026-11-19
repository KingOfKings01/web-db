<script>
  import { oracleDb } from '../lib/db-store.js';

  export let visible = false;
  export let onClose = () => {};
  export let onConnect = (connInfo) => {};

  let connName = '';
  let username = 'STUDENT';
  let password = '';
  let role = 'DEFAULT';
  let showPassword = false;

  let testStatus = null; // null | 'testing' | 'success' | 'error'
  let testMessage = '';

  function resetForm() {
    connName = '';
    username = 'STUDENT';
    password = '';
    role = 'DEFAULT';
    testStatus = null;
    testMessage = '';
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape' && visible) {
      handleClose();
    }
  }

  function handleTest() {
    const trimmedName = connName.trim();
    if (!trimmedName) {
      testStatus = 'error';
      testMessage = 'Please enter a Connection Name / Database Name.';
      return;
    }
    const trimmedUser = username.trim();
    if (!trimmedUser) {
      testStatus = 'error';
      testMessage = 'Please enter a Username.';
      return;
    }

    testStatus = 'testing';
    testMessage = 'Testing connection...';

    setTimeout(() => {
      try {
        const dbs = oracleDb.getDatabases();
        const key = trimmedName.toUpperCase();
        if (dbs[key]) {
          // Existing database, verify credentials if target has password
          const db = dbs[key];
          if (db.password && password && password !== db.password && !['oracle', 'manager', 'change_on_install'].includes(password)) {
            testStatus = 'error';
            testMessage = 'ORA-01017: invalid username/password; logon denied';
            return;
          }
          testStatus = 'success';
          testMessage = `Status: Success (Existing database '${db.name}')`;
        } else {
          testStatus = 'success';
          testMessage = `Status: Success (New database '${trimmedName}' ready to initialize)`;
        }
      } catch (err) {
        testStatus = 'error';
        testMessage = err.message || 'Connection failed.';
      }
    }, 200);
  }

  function handleSubmit() {
    const trimmedName = connName.trim();
    if (!trimmedName) {
      testStatus = 'error';
      testMessage = 'Connection Name / Database Name is required.';
      return;
    }
    const trimmedUser = username.trim();
    if (!trimmedUser) {
      testStatus = 'error';
      testMessage = 'Username is required.';
      return;
    }

    onConnect({
      name: trimmedName,
      username: trimmedUser,
      password: password || 'password',
      role
    });

    handleClose();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" on:click={handleClose}>
    <div class="modal-dialog connection-dialog" on:click|stopPropagation>
      <div class="modal-header">
        <div class="modal-title-row">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2">
            <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
          </svg>
          <h3>New / Select Database Connection</h3>
        </div>
        <button class="btn-modal-close" on:click={handleClose} title="Close">&times;</button>
      </div>

      <div class="modal-body connection-dialog-body">
        <p class="connection-intro">
          Create a new database workspace or connect to an existing Oracle connection.
        </p>

        <div class="form-group">
          <label for="conn-name">Connection Name <span class="required">*</span></label>
          <input 
            id="conn-name"
            type="text" 
            bind:value={connName} 
            placeholder="e.g. sql_class, Oracle26, college_db"
            class="form-control"
            autocomplete="off"
            autofocus
          />
          <small class="form-hint">Unique identifier for this database connection.</small>
        </div>

        <div class="form-row-2">
          <div class="form-group">
            <label for="conn-user">Username <span class="required">*</span></label>
            <input 
              id="conn-user"
              type="text" 
              bind:value={username} 
              placeholder="e.g. STUDENT, SYSTEM, HR"
              class="form-control"
              autocomplete="off"
            />
          </div>

          <div class="form-group">
            <label for="conn-role">Role</label>
            <select id="conn-role" bind:value={role} class="form-control">
              <option value="DEFAULT">default</option>
              <option value="SYSDBA">SYSDBA</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="conn-pass">Password</label>
          <div class="password-input-wrap">
            <input 
              id="conn-pass"
              type={showPassword ? 'text' : 'password'} 
              bind:value={password} 
              placeholder="Enter password (e.g. password, oracle)"
              class="form-control"
              autocomplete="off"
            />
            <button 
              type="button" 
              class="btn-toggle-pass" 
              on:click={() => showPassword = !showPassword}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '👁️' : '🔒'}
            </button>
          </div>
          <small class="form-hint">Credentials are saved locally for this browser session.</small>
        </div>

        {#if testStatus}
          <div class="test-feedback {testStatus}">
            {#if testStatus === 'testing'}
              <span class="spinner-small"></span>
            {:else if testStatus === 'success'}
              <span class="icon-success">✓</span>
            {:else}
              <span class="icon-error">✗</span>
            {/if}
            <span>{testMessage}</span>
          </div>
        {/if}
      </div>

      <div class="modal-footer connection-dialog-footer">
        <button class="btn btn-secondary" on:click={handleTest} type="button">
          Test Connection
        </button>
        <div style="flex: 1;"></div>
        <button class="btn btn-outline" on:click={handleClose} type="button">
          Cancel
        </button>
        <button class="btn btn-primary" on:click={handleSubmit} type="button">
          Connect
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 16px;
    box-sizing: border-box;
  }

  .connection-dialog {
    max-width: 500px;
    width: 100%;
    margin: auto;
    background-color: var(--bg-surface);
    border-radius: 8px;
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.35);
    border: 1px solid var(--border-medium);
    overflow: hidden;
    animation: modalScaleIn 0.18s ease-out;
  }

  @keyframes modalScaleIn {
    from {
      transform: scale(0.96);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid var(--border-light);
    background-color: var(--bg-surface);
  }

  .btn-modal-close {
    background: transparent;
    border: none;
    font-size: 22px;
    line-height: 1;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: color 0.15s, background-color 0.15s;
  }

  .btn-modal-close:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .modal-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .modal-title-row h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--text-main);
  }

  .connection-dialog-body {
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .connection-intro {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .form-group label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-main);
  }

  .form-group label .required {
    color: #ef4444;
  }

  .form-hint {
    font-size: 11px;
    color: var(--text-subtle);
  }

  .form-row-2 {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 12px;
  }

  .form-control {
    width: 100%;
    padding: 8px 10px;
    font-size: 13px;
    border: 1px solid var(--border-medium);
    border-radius: 5px;
    background-color: var(--bg-primary);
    color: var(--text-main);
    box-sizing: border-box;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .form-control:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  .password-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .password-input-wrap input {
    padding-right: 38px;
  }

  .btn-toggle-pass {
    position: absolute;
    right: 8px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 4px;
    opacity: 0.7;
  }

  .btn-toggle-pass:hover {
    opacity: 1;
  }

  .test-feedback {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 500;
    margin-top: 4px;
  }

  .test-feedback.testing {
    background-color: rgba(59, 130, 246, 0.1);
    color: #2563eb;
    border: 1px solid rgba(59, 130, 246, 0.2);
  }

  .test-feedback.success {
    background-color: rgba(34, 197, 94, 0.1);
    color: #16a34a;
    border: 1px solid rgba(34, 197, 94, 0.2);
  }

  .test-feedback.error {
    background-color: rgba(239, 68, 68, 0.1);
    color: #dc2626;
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .connection-dialog-footer {
    padding: 12px 20px;
    background-color: var(--bg-subtle);
    border-top: 1px solid var(--border-light);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn {
    padding: 7px 14px;
    font-size: 12px;
    font-weight: 600;
    border-radius: 5px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background-color 0.15s;
  }

  .btn-primary {
    background-color: #2563eb;
    color: #ffffff;
  }

  .btn-primary:hover {
    background-color: #1d4ed8;
  }

  .btn-secondary {
    background-color: var(--bg-surface);
    border-color: var(--border-medium);
    color: var(--text-main);
  }

  .btn-secondary:hover {
    background-color: var(--bg-hover);
  }

  .btn-outline {
    background-color: transparent;
    border-color: var(--border-medium);
    color: var(--text-main);
  }

  .btn-outline:hover {
    background-color: var(--bg-hover);
  }
</style>