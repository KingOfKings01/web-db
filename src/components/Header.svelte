<script>
  export let theme = 'theme-light';
  export let onOpenCanvas = () => {};
  export let onResetDb = () => {};
  export let onToggleTheme = () => {};
</script>

<header class="app-header">
  <div class="brand">
    <div class="brand-badge">ORACLE</div>
    <div class="brand-text">
      <h1>SQL Web Studio</h1>
    </div>
  </div>

  <div class="header-actions">
    <button class="btn btn-primary-outline btn-canvas-trigger" on:click={onOpenCanvas} title="Open Full Window Draggable Table Canvas">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="3" y1="9" x2="21" y2="9"></line>
        <line x1="9" y1="21" x2="9" y2="9"></line>
      </svg>
      <span>Tables</span>
    </button>

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
