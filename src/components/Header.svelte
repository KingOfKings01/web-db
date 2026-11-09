<script>
  import { onMount, onDestroy } from 'svelte';

  export let theme = 'theme-light';
  export let isMobileView = false;
  export let onOpenCanvas = () => {};
  export let onResetDb = () => {};
  export let onToggleTheme = () => {};
  export let onSwitchView = () => {};

  let showDropdown = false;

  function handleOutsideHeaderClick(event) {
    if (showDropdown) {
      const target = event.target;
      if (target && !target.closest('.header-view-wrap')) {
        showDropdown = false;
      }
    }
  }

  onMount(() => {
    window.addEventListener('pointerdown', handleOutsideHeaderClick);
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', handleOutsideHeaderClick);
    }
  });
</script>

<header class="app-header">
  <div class="brand">
    <div class="brand-badge">ORACLE</div>
    <div class="brand-text">
      <h1>SQL Web Studio</h1>
    </div>
  </div>

  <div class="header-actions">
    <!-- Unified View Dropdown: Tables, Vertical, Desktop -->
    <div class="header-view-wrap">
      <button 
        class="btn btn-secondary header-view-btn" 
        class:btn-primary-outline={showDropdown}
        on:click|stopPropagation={() => showDropdown = !showDropdown} 
        title="Switch Views & Tables"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
        <span>View ▾</span>
      </button>

      {#if showDropdown}
        <div class="header-menu-card">
          <div class="header-menu-title">
            <span>View &amp; Workspace</span>
            <button class="header-menu-close" on:click={() => showDropdown = false}>✕</button>
          </div>

          <!-- Tables -->
          <button 
            class="header-menu-item" 
            on:click={() => { showDropdown = false; onOpenCanvas(); }}
          >
            <span class="hmi-icon">📋</span>
            <div class="hmi-text">
              <strong>Tables</strong>
              <small>Database Visual Board &amp; table cards</small>
            </div>
          </button>

          <div class="header-menu-sep"></div>

          <!-- Vertical (Mobile) -->
          <button 
            class="header-menu-item" 
            on:click={() => { 
              showDropdown = false; 
              onSwitchView('vertical'); 
            }}
          >
            <span class="hmi-icon">📱</span>
            <div class="hmi-text">
              <strong>Vertical</strong>
              <small>Mobile Portrait SQL Keyboard</small>
            </div>
          </button>

          <!-- Landscape (Mobile) -->
          <button 
            class="header-menu-item" 
            on:click={() => { 
              showDropdown = false; 
              onSwitchView('landscape'); 
            }}
          >
            <span class="hmi-icon">📐</span>
            <div class="hmi-text">
              <strong>Landscape</strong>
              <small>Mobile Split Thumb Keyboard</small>
            </div>
          </button>

          <div class="header-menu-sep"></div>

          <!-- Desktop -->
          <button 
            class="header-menu-item" 
            class:is-active={!isMobileView}
            on:click={() => { 
              showDropdown = false; 
              onSwitchView('desktop');
            }}
          >
            <span class="hmi-icon">💻</span>
            <div class="hmi-text">
              <strong>Desktop</strong>
              <small>Full 3-pane IDE workspace {!isMobileView ? '(Active)' : ''}</small>
            </div>
            {#if !isMobileView}
              <span class="hmi-active-badge">Active</span>
            {/if}
          </button>
        </div>
      {/if}
    </div>

    <button class="btn btn-secondary" on:click={onResetDb} title="Reset all tables back to sample data">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
        <path d="M3 3v5h5"></path>
      </svg>
      <span>Reset DB</span>
    </button>

    <button class="btn btn-icon" on:click={onToggleTheme} title="Toggle Light / Dark mode">
      {#if theme === 'theme-light'}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      {:else}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      {/if}
    </button>

  </div>
</header>

<style>
  .header-view-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .header-view-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
  }

  .header-menu-card {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    width: 250px;
    background: var(--bg-surface);
    border: 1px solid var(--border-medium);
    border-radius: 10px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 99999 !important;
    display: flex;
    flex-direction: column;
    padding: 6px;
    gap: 3px;
    box-sizing: border-box;
    animation: menuDropFade 0.15s ease-out;
  }

  @keyframes menuDropFade {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .header-menu-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px 6px 8px;
    border-bottom: 1px solid var(--border-light);
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .header-menu-close {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 13px;
    cursor: pointer;
    padding: 0 4px;
  }

  .header-menu-item {
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
    color: var(--text-main);
    transition: background 0.12s;
  }

  .header-menu-item:hover {
    background: var(--bg-hover);
  }

  .header-menu-item.is-active {
    background: var(--bg-subtle);
    border-color: var(--border-medium);
  }

  .hmi-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .hmi-text {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .hmi-text strong {
    font-size: 13px;
    color: var(--text-main);
    line-height: 1.2;
  }

  .hmi-text small {
    font-size: 10px;
    color: var(--text-muted);
    line-height: 1.2;
    margin-top: 1px;
  }

  .hmi-active-badge {
    font-size: 10px;
    font-weight: 700;
    background: #3b82f6;
    color: #fff;
    padding: 2px 6px;
    border-radius: 10px;
    flex-shrink: 0;
  }

  .header-menu-sep {
    height: 1px;
    background: var(--border-light);
    margin: 3px 0;
  }
</style>
