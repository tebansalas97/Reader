<script lang="ts">
  import type { Entry } from '$lib/fs/api-types';
  import { basename } from '$lib/fs/paths';
  import { t } from '$lib/i18n';
  import type { OutlineItem } from '$lib/preview/outline';
  import { ui } from '$lib/state/ui.svelte';
  import FileTree from './FileTree.svelte';
  import Outline from './Outline.svelte';

  interface Props {
    entries: Entry[];
    outline: OutlineItem[];
    activeIndex: number;
    activePath: string | null;
    onopen: (path: string) => void;
    onheading: (line: number) => void;
    onopenfolder: () => void;
  }

  const { entries, outline, activeIndex, activePath, onopen, onheading, onopenfolder }: Props =
    $props();

  let dragging = $state(false);

  function startResize(event: PointerEvent): void {
    dragging = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function resize(event: PointerEvent): void {
    if (!dragging) return;
    ui.sidebarWidth = Math.min(440, Math.max(180, event.clientX));
  }

  function endResize(event: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }
</script>

<aside class="sidebar" style="width: {ui.sidebarWidth}px">
  <div class="panels">
    <button class:active={ui.sidebar === 'files'} onclick={() => (ui.sidebar = 'files')}>
      {t('sidebar.files')}
    </button>
    <button class:active={ui.sidebar === 'outline'} onclick={() => (ui.sidebar = 'outline')}>
      {t('sidebar.outline')}
    </button>
  </div>
  <div class="content">
    {#if ui.sidebar === 'files'}
      {#if ui.folder === null}
        <div class="empty">
          <p>{t('sidebar.empty')}</p>
          <button class="link" onclick={onopenfolder}>{t('sidebar.openFolder')}</button>
        </div>
      {:else}
        <p class="folder" title={ui.folder}>{basename(ui.folder)}</p>
        <FileTree {entries} {activePath} {onopen} />
      {/if}
    {:else}
      <Outline items={outline} {activeIndex} onselect={onheading} />
    {/if}
  </div>
  <div
    class="handle"
    class:dragging
    role="separator"
    tabindex="-1"
    aria-orientation="vertical"
    onpointerdown={startResize}
    onpointermove={resize}
    onpointerup={endResize}
    onpointercancel={endResize}
  ></div>
</aside>

<style>
  .sidebar {
    position: relative;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    background: var(--bg-elevated);
    border-right: 1px solid var(--border);
    min-height: 0;
  }

  .panels {
    display: flex;
    flex-shrink: 0;
    border-bottom: 1px solid var(--border);
  }

  .panels button {
    flex: 1;
    padding: 8px 4px;
    color: var(--text-muted);
    border-bottom: 2px solid transparent;
  }

  .panels button:hover {
    color: var(--text);
  }

  .panels button.active {
    color: var(--text);
    border-bottom-color: var(--accent);
  }

  .content {
    flex: 1;
    overflow: auto;
    min-height: 0;
  }

  .folder {
    margin: 0;
    padding: 8px 10px 4px;
    font-size: 0.92em;
    font-weight: 600;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty {
    padding: 16px 12px;
    color: var(--text-faint);
  }

  .empty p {
    margin: 0 0 8px;
  }

  .link {
    color: var(--accent);
    text-decoration: underline;
  }

  .handle {
    position: absolute;
    top: 0;
    right: -3px;
    width: 6px;
    height: 100%;
    cursor: col-resize;
    touch-action: none;
    z-index: 5;
  }

  .handle:hover,
  .handle.dragging {
    background: var(--accent);
  }
</style>
