<script lang="ts">
  import { t } from '$lib/i18n';

  interface Props {
    onaction: (action: string) => void;
    unavailable?: string[];
  }

  const { onaction, unavailable = [] }: Props = $props();

  let open = $state(false);
  let anchor = $state<HTMLElement | null>(null);

  const GROUPS: { action: string; key: string; hint: string }[][] = [
    [
      { action: 'new', key: 'menu.new', hint: 'Ctrl+N' },
      { action: 'open', key: 'menu.open', hint: 'Ctrl+O' },
      { action: 'openFolder', key: 'menu.openFolder', hint: 'Ctrl+Shift+O' },
    ],
    [
      { action: 'save', key: 'menu.save', hint: 'Ctrl+S' },
      { action: 'saveAs', key: 'menu.saveAs', hint: 'Ctrl+Shift+S' },
      { action: 'close', key: 'menu.close', hint: 'Ctrl+W' },
    ],
    [
      { action: 'exportHtml', key: 'menu.exportHtml', hint: 'Ctrl+Shift+H' },
      { action: 'print', key: 'menu.exportPdf', hint: 'Ctrl+P' },
    ],
    [
      { action: 'toggleFiles', key: 'sidebar.files', hint: 'Ctrl+Shift+E' },
      { action: 'toggleOutline', key: 'sidebar.outline', hint: 'Ctrl+Shift+U' },
      { action: 'toggleZen', key: 'view.zen', hint: 'F11' },
    ],
    [{ action: 'settings', key: 'menu.settings', hint: 'Ctrl+,' }],
  ];

  function choose(action: string): void {
    open = false;
    onaction(action);
  }

  function onWindowPointerDown(event: PointerEvent): void {
    if (!open) return;
    const target = event.target;
    if (target instanceof Node && anchor?.contains(target)) return;
    open = false;
  }
</script>

<svelte:window onpointerdown={onWindowPointerDown} />

<div class="menu" bind:this={anchor} data-tauri-drag-region>
  <button
    class="trigger"
    aria-label={t('menu.title')}
    aria-expanded={open}
    title={t('menu.title')}
    onclick={() => (open = !open)}
  >
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.4" />
    </svg>
  </button>
  {#if open}
    <div class="popover" role="menu" tabindex="-1">
      {#each GROUPS as group, index (index)}
        {#if index > 0}<div class="sep"></div>{/if}
        {#each group as item (item.action)}
          <button
            class="item"
            role="menuitem"
            disabled={unavailable.includes(item.action)}
            onclick={() => choose(item.action)}
          >
            <span>{t(item.key)}</span>
            <kbd>{item.hint}</kbd>
          </button>
        {/each}
      {/each}
    </div>
  {/if}
</div>

<style>
  .menu {
    position: relative;
    display: flex;
    align-items: center;
    padding: 0 4px 0 6px;
  }

  .item:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 26px;
    border-radius: 5px;
    color: var(--text-muted);
  }

  .trigger:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .popover {
    position: absolute;
    top: calc(100% + 4px);
    left: 4px;
    z-index: 40;
    min-width: 240px;
    padding: 4px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: var(--shadow);
  }

  .item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    width: 100%;
    padding: 6px 10px;
    border-radius: 5px;
    text-align: left;
  }

  .item:hover {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .item kbd {
    font-family: inherit;
    font-size: 0.9em;
    color: var(--text-faint);
  }

  .item:hover kbd {
    color: var(--accent-contrast);
    opacity: 0.75;
  }

  .sep {
    height: 1px;
    margin: 4px 6px;
    background: var(--border);
  }
</style>
