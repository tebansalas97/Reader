<script lang="ts">
  import type { Entry } from '$lib/fs/api-types';
  import { basename } from '$lib/fs/paths';
  import { t } from '$lib/i18n';
  import type { OutlineItem } from '$lib/preview/outline';
  import { ui } from '$lib/state/ui.svelte';
  import type { Annotation } from '$lib/pdf/annotations/model';
  import type { PageEdit } from '$lib/pdf/pages';
  import type { OutlineEntry, PdfHandle } from '$lib/pdf/document';
  import FileTree from './FileTree.svelte';
  import HistoryPanel from './HistoryPanel.svelte';
  import Outline from './Outline.svelte';
  import SearchPanel from './SearchPanel.svelte';
  import AnnotationsPanel from './pdf/AnnotationsPanel.svelte';
  import PdfOutline from './pdf/PdfOutline.svelte';
  import PdfSearch from './pdf/PdfSearch.svelte';
  import PdfThumbnails from './pdf/PdfThumbnails.svelte';

  interface Props {
    entries: Entry[];
    outline: OutlineItem[];
    activeIndex: number;
    activePath: string | null;
    onopen: (path: string) => void;
    onheading: (line: number) => void;
    onopenfolder: () => void;
    activeDocument: string | null;
    onsearchhit: (path: string, line: number) => void;
    onrestore: (text: string) => void;
    onpreview: (text: string, label: string) => void;
    pdf: {
      handle: PdfHandle | null;
      outline: OutlineEntry[];
      page: number;
      onpage: (page: number) => void;
      annotations: Annotation[];
      selectedAnnotation: string | null;
      plan: PageEdit[];
      selectedPages: number[];
      onpageselection: (indices: number[]) => void;
      onpagemove: (indices: number[], to: number) => void;
      onpageturn: (indices: number[], quarters: 1 | -1) => void;
      onpageremove: (indices: number[]) => void;
      onpageextract: (indices: number[]) => void;
      onselectannotation: (id: string, page: number) => void;
      onsearchhit: (page: number, items: number[]) => void;
      ondeleteannotation: (id: string) => void;
    } | null;
  }

  const {
    entries,
    outline,
    activeIndex,
    activePath,
    activeDocument,
    onopen,
    onheading,
    onopenfolder,
    onsearchhit,
    onrestore,
    onpreview,
    pdf,
  }: Props = $props();

  let dragging = $state(false);

  const ALL_TABS = [
    { panel: 'files' as const, label: 'sidebar.files', icon: 'M2 4.5h4L7.4 6H14v7.5H2z' },
    { panel: 'pages' as const, label: 'sidebar.pages', icon: 'M5.5 2h5l2.5 2.5V11h-7.5zM2.5 5v9h8', pdfOnly: true },
    { panel: 'marks' as const, label: 'sidebar.marks', icon: 'M3 3h10v7H7l-3 3v-3H3z', pdfOnly: true },
    { panel: 'outline' as const, label: 'sidebar.outline', icon: 'M3 4h10M5 8h8M7 12h6' },
    { panel: 'search' as const, label: 'sidebar.search', icon: 'M7.5 12a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM11 11l3 3' },
    { panel: 'history' as const, label: 'sidebar.history', icon: 'M2.5 4v3h3M2.6 7a5.5 5.5 0 111.2 4.5M8 5v3.2l2.4 1.4' },
  ];

  const tabs = $derived(ALL_TABS.filter((tab) => pdf !== null || !tab.pdfOnly));
  const panel = $derived(
    pdf === null && (ui.sidebar === 'pages' || ui.sidebar === 'marks') ? 'files' : ui.sidebar,
  );

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
  <div class="panels" role="tablist">
    {#each tabs as tab (tab.panel)}
      <button
        role="tab"
        class:active={panel === tab.panel}
        aria-selected={panel === tab.panel}
        title={t(tab.label)}
        aria-label={t(tab.label)}
        onclick={() => ui.useSidebar(tab.panel)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d={tab.icon} /></svg>
      </button>
    {/each}
  </div>
  <div class="content">
    {#if panel === 'files'}
      {#if ui.folder === null}
        <div class="empty">
          <p>{t('sidebar.empty')}</p>
          <button class="link" onclick={onopenfolder}>{t('sidebar.openFolder')}</button>
        </div>
      {:else}
        <div class="folder">
          <p title={ui.folder}>{basename(ui.folder)}</p>
          <button
            class="change"
            title={t('sidebar.changeFolder')}
            aria-label={t('sidebar.changeFolder')}
            onclick={onopenfolder}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2 4.5h4L7.4 6H14v7.5H2z" />
              <path d="M8 8v4M6 10h4" />
            </svg>
          </button>
        </div>
        <FileTree {entries} {activePath} {onopen} />
      {/if}
    {:else if panel === 'pages' && pdf}
      <PdfThumbnails
        handle={pdf.handle}
        plan={pdf.plan}
        currentPage={pdf.page}
        selected={pdf.selectedPages}
        onselect={pdf.onpage}
        onselection={pdf.onpageselection}
        onmove={pdf.onpagemove}
        onturn={pdf.onpageturn}
        onremove={pdf.onpageremove}
        onextract={pdf.onpageextract}
      />
    {:else if panel === 'marks' && pdf}
      <AnnotationsPanel
        annotations={pdf.annotations}
        plan={pdf.plan}
        handle={pdf.handle}
        selectedId={pdf.selectedAnnotation}
        onselect={pdf.onselectannotation}
        ondelete={pdf.ondeleteannotation}
      />
    {:else if panel === 'outline'}
      {#if pdf}
        <PdfOutline entries={pdf.outline} currentPage={pdf.page} onselect={pdf.onpage} />
      {:else}
        <Outline items={outline} {activeIndex} onselect={onheading} />
      {/if}
    {:else if panel === 'search'}
      {#if pdf}
        <PdfSearch handle={pdf.handle} currentPage={pdf.page} onselect={pdf.onsearchhit} />
      {:else}
        <SearchPanel onopen={onsearchhit} {onopenfolder} />
      {/if}
    {:else}
      <HistoryPanel
        path={activeDocument}
        stamp={ui.historyStamp}
        {onrestore}
        {onpreview}
      />
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
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 34px;
    color: var(--text-muted);
    border-bottom: 2px solid transparent;
  }

  .panels button svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.35;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .panels button:hover {
    color: var(--text);
    background: var(--bg-hover);
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
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 6px 4px 10px;
  }

  .folder p {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 0.92em;
    font-weight: 600;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .change {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 5px;
    color: var(--text-faint);
    flex-shrink: 0;
  }

  .change:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .change svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.35;
    stroke-linecap: round;
    stroke-linejoin: round;
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
