<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { t } from '$lib/i18n';
  import { ui, type ViewMode } from '$lib/state/ui.svelte';
  import Menu from './Menu.svelte';
  import Tabs from './Tabs.svelte';
  import type { TabItem } from './types';

  interface Props {
    items: TabItem[];
    activeId: string | null;
    onselect: (id: string) => void;
    onclose: (id: string) => void;
    onaction: (action: string) => void;
    onrequestclose: () => void;
  }

  const { items, activeId, onselect, onclose, onaction, onrequestclose }: Props = $props();

  let maximised = $state(false);

  const appWindow = getCurrentWindow();

  const MODES: { mode: ViewMode; key: string; icon: string }[] = [
    { mode: 'editor', key: 'view.editor', icon: 'M2 2h5v12H2z' },
    { mode: 'split', key: 'view.split', icon: 'M2 2h12v12H2zm6 0v12' },
    { mode: 'preview', key: 'view.preview', icon: 'M9 2h5v12H9z' },
  ];

  async function toggleMaximise(): Promise<void> {
    await appWindow.toggleMaximize();
    maximised = await appWindow.isMaximized();
  }

  $effect(() => {
    void appWindow.isMaximized().then((v) => {
      maximised = v;
    });
  });
</script>

<header class="titlebar" data-tauri-drag-region>
  <Menu {onaction} />
  <Tabs {items} {activeId} {onselect} {onclose} />
  <div class="spacer" data-tauri-drag-region></div>
  <div class="modes">
    {#each MODES as item (item.mode)}
      <button
        class="icon"
        class:active={ui.viewMode === item.mode}
        title={t(item.key)}
        aria-label={t(item.key)}
        aria-pressed={ui.viewMode === item.mode}
        onclick={() => (ui.viewMode = item.mode)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d={item.icon} stroke="currentColor" stroke-width="1.3" fill="none" />
        </svg>
      </button>
    {/each}
  </div>
  <div class="controls">
    <button class="control" title={t('window.minimize')} onclick={() => appWindow.minimize()}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M0 5h10" stroke="currentColor" stroke-width="1" />
      </svg>
    </button>
    <button
      class="control"
      title={maximised ? t('window.restore') : t('window.maximize')}
      onclick={toggleMaximise}
    >
      {#if maximised}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2.5 0.5h7v7h-2M0.5 2.5h7v7h-7z" stroke="currentColor" stroke-width="1" fill="none" />
        </svg>
      {:else}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" stroke-width="1" fill="none" />
        </svg>
      {/if}
    </button>
    <button class="control danger" title={t('window.close')} onclick={onrequestclose}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M0 0l10 10M10 0L0 10" stroke="currentColor" stroke-width="1" />
      </svg>
    </button>
  </div>
</header>

<style>
  .titlebar {
    display: flex;
    align-items: stretch;
    height: var(--titlebar-height);
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .spacer {
    flex: 0 1 40px;
    min-width: 20px;
  }

  .modes {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 6px;
  }

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 26px;
    border-radius: 5px;
    color: var(--text-muted);
  }

  .icon:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .icon.active {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .controls {
    display: flex;
    align-items: stretch;
  }

  .control {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    color: var(--text-muted);
  }

  .control:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .control.danger:hover {
    background: #c42b1c;
    color: #ffffff;
  }
</style>
