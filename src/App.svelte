<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
  import { onMount } from 'svelte';
  import {
    allowAssetDir,
    listDir,
    readBytes,
    ReaderError,
    saveAsset,
    startupPaths,
    writeBytes,
    writeText,
  } from '$lib/fs/api';
  import type { Entry } from '$lib/fs/api-types';
  import { onFsChanged, onOpenPaths } from '$lib/fs/events';
  import { basename, dirname, extname, normalise } from '$lib/fs/paths';
  import { setLanguage, t } from '$lib/i18n';
  import { exportHtml } from '$lib/export/html';
  import { printPreview } from '$lib/export/print';
  import { activeOutlineIndex, extractOutline } from '$lib/preview/outline';
  import { createSyncGuard } from '$lib/preview/scroll-sync';
  import { documents, type Document } from '$lib/state/documents.svelte';
  import { prefs, resetZoom, resolvedTheme, zoomEditor } from '$lib/state/prefs.svelte';
  import { recent } from '$lib/state/recent.svelte';
  import { toasts } from '$lib/state/toasts.svelte';
  import { ui } from '$lib/state/ui.svelte';
  import { registerShortcuts } from '$lib/shortcuts';
  import CommandPalette from '$lib/ui/CommandPalette.svelte';
  import DiagramViewer from '$lib/ui/DiagramViewer.svelte';
  import Dialog from '$lib/ui/Dialog.svelte';
  import Editor from '$lib/ui/Editor.svelte';
  import Preview from '$lib/ui/Preview.svelte';
  import Settings from '$lib/ui/Settings.svelte';
  import Sidebar from '$lib/ui/Sidebar.svelte';
  import SplitPane from '$lib/ui/SplitPane.svelte';
  import StatusBar from '$lib/ui/StatusBar.svelte';
  import TitleBar from '$lib/ui/TitleBar.svelte';
  import Toolbar from '$lib/ui/Toolbar.svelte';
  import Toasts from '$lib/ui/Toasts.svelte';
  import Welcome from '$lib/ui/Welcome.svelte';
  import '$lib/ui/markdown.css';
  import '$lib/ui/print.css';

  const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'txt'];
  const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp'];
  const DIALOG_FILTERS = [{ name: 'Markdown', extensions: MARKDOWN_EXTENSIONS }];

  const appWindow = getCurrentWindow();
  const guard = createSyncGuard();

  let editor = $state<ReturnType<typeof Editor> | null>(null);
  let preview = $state<ReturnType<typeof Preview> | null>(null);
  let entries = $state<Entry[]>([]);
  let saving = $state(false);
  let pending = $state<{ doc: Document; then: 'close' | 'quit' } | null>(null);
  let quitQueue: Document[] = [];
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  let activeBlock = $state<{ start: number; end: number } | null>(null);
  let selectedWords = $state(0);

  const active = $derived(documents.active);
  const outline = $derived(extractOutline(active?.text ?? ''));
  const activeHeading = $derived(activeOutlineIndex(outline, (active?.cursor.line ?? 1) - 1));
  const tabs = $derived(
    documents.list.map((d) => ({ id: d.id, title: d.title, dirty: d.text !== d.savedText })),
  );

  function reportError(key: string, error: unknown): void {
    const message = error instanceof ReaderError ? error.message : String(error);
    toasts.error(t(key, { message }));
  }

  async function openDocument(path: string): Promise<void> {
    try {
      const normalised = normalise(path);
      await allowAssetDir(dirname(normalised)).catch(() => undefined);
      await documents.open(normalised);
      await recent.load();
    } catch (error) {
      reportError('error.openFailed', error);
    }
  }

  async function openFileFlow(): Promise<void> {
    const chosen = await openDialog({ multiple: true, filters: DIALOG_FILTERS }).catch(() => null);
    if (!chosen) return;
    for (const path of Array.isArray(chosen) ? chosen : [chosen]) {
      await openDocument(path);
    }
  }

  async function openFolderFlow(): Promise<void> {
    const chosen = await openDialog({ directory: true }).catch(() => null);
    if (typeof chosen !== 'string') return;
    await setFolder(normalise(chosen));
  }

  async function setFolder(folder: string): Promise<void> {
    ui.folder = folder;
    ui.sidebar = 'files';
    prefs.update({ lastFolder: folder });
    await allowAssetDir(folder).catch(() => undefined);
    entries = await listDir(folder, 2).catch(() => []);
  }

  async function saveFlow(): Promise<'saved' | 'cancelled'> {
    const doc = documents.active;
    if (!doc) return 'cancelled';
    return saveDocument(doc);
  }

  async function saveDocument(doc: Document): Promise<'saved' | 'cancelled'> {
    saving = true;
    try {
      const result = await documents.save(doc.id);
      if (result !== 'needs-path') return 'saved';
      return await saveAsFlow(doc);
    } catch (error) {
      reportError('error.saveFailed', error);
      return 'cancelled';
    } finally {
      saving = false;
    }
  }

  async function saveAsFlow(target?: Document): Promise<'saved' | 'cancelled'> {
    const doc = target ?? documents.active;
    if (!doc) return 'cancelled';
    const path = await saveDialog({
      defaultPath: doc.path ?? `${doc.title}.md`,
      filters: DIALOG_FILTERS,
    }).catch(() => null);
    if (!path) return 'cancelled';
    try {
      await documents.saveAs(doc.id, path);
      await recent.load();
      return 'saved';
    } catch (error) {
      reportError('error.saveFailed', error);
      return 'cancelled';
    }
  }

  function requestClose(id: string): void {
    const doc = documents.byId(id);
    if (!doc) return;
    if (doc.text === doc.savedText) {
      documents.close(id);
      return;
    }
    pending = { doc, then: 'close' };
  }

  async function resolvePending(choice: string): Promise<void> {
    const request = pending;
    pending = null;
    if (!request) return;
    if (choice === 'cancel') {
      quitQueue = [];
      return;
    }
    if (choice === 'save') {
      const result = await saveDocument(request.doc);
      if (result === 'cancelled') {
        quitQueue = [];
        return;
      }
    }
    documents.close(request.doc.id);
    if (request.then === 'quit') await continueQuit();
  }

  async function continueQuit(): Promise<void> {
    const next = quitQueue.shift();
    if (next && documents.byId(next.id)) {
      pending = { doc: next, then: 'quit' };
      return;
    }
    if (quitQueue.length === 0 && documents.dirtyDocuments.length === 0) {
      await appWindow.destroy();
    }
  }

  async function requestQuit(): Promise<void> {
    const dirty = documents.dirtyDocuments;
    if (dirty.length === 0) {
      await appWindow.destroy();
      return;
    }
    quitQueue = [...dirty];
    await continueQuit();
  }

  const EDITOR_ACTIONS = new Set([
    'undo',
    'redo',
    'bold',
    'italic',
    'strike',
    'code',
    'heading',
    'bullet',
    'ordered',
    'task',
    'quote',
    'link',
    'image',
    'table',
    'codeBlock',
    'rule',
    'find',
  ]);

  function cycleTab(direction: number): void {
    if (documents.list.length < 2) return;
    const index = documents.list.findIndex((d) => d.id === documents.activeId);
    const next = (index + direction + documents.list.length) % documents.list.length;
    documents.activeId = documents.list[next]!.id;
  }

  async function exportHtmlFlow(): Promise<void> {
    const doc = documents.active;
    if (!doc) return;
    const path = await saveDialog({
      defaultPath: `${doc.title.replace(/\.(md|markdown|txt)$/i, '')}.html`,
      filters: [{ name: 'HTML', extensions: ['html'] }],
    }).catch(() => null);
    if (!path) return;
    try {
      await exportHtml(doc, path, resolvedTheme(), preview?.html());
      toasts.push(basename(path));
    } catch (error) {
      reportError('error.exportFailed', error);
    }
  }

  function printFlow(): void {
    const previous = ui.viewMode;
    ui.viewMode = 'preview';
    requestAnimationFrame(() => {
      printPreview();
      ui.viewMode = previous;
    });
  }

  async function insertImageFile(name: string, bytes: number[]): Promise<void> {
    const doc = documents.active;
    if (!doc || doc.path === null) {
      toasts.error(t('error.needsPath'));
      return;
    }
    try {
      const relative = await saveAsset(doc.path, name, bytes);
      editor?.insertAtCursor(`![${basename(name)}](${relative})`);
    } catch (error) {
      reportError('error.saveFailed', error);
    }
  }

  async function insertDroppedImage(path: string): Promise<void> {
    const bytes = await readBytes(path).catch(() => null);
    if (bytes) await insertImageFile(basename(path), bytes);
  }

  async function insertPastedImage(file: File): Promise<void> {
    const buffer = await file.arrayBuffer();
    const extension = file.type.split('/')[1] ?? 'png';
    const name = file.name || `pegado-${Date.now()}.${extension}`;
    await insertImageFile(name, Array.from(new Uint8Array(buffer)));
  }

  async function saveDiagram(format: 'svg' | 'png', data: string): Promise<void> {
    const path = await saveDialog({
      defaultPath: `diagrama.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    }).catch(() => null);
    if (!path) return;
    try {
      if (format === 'svg') {
        await writeText(path, data, 'lf');
      } else {
        const bytes = Array.from(
          Uint8Array.from(atob(data.split(',')[1] ?? ''), (c) => c.charCodeAt(0)),
        );
        await writeBytes(path, bytes);
      }
      toasts.push(t('diagram.saved'));
    } catch (error) {
      reportError('error.saveFailed', error);
    }
  }

  function goToSource(line: number): void {
    editor?.moveCursorToLine(line);
    if (ui.viewMode === 'preview') ui.viewMode = 'split';
  }

  function handleAction(action: string, argument?: string | number): void {
    if (EDITOR_ACTIONS.has(action)) {
      editor?.run(action, argument);
      return;
    }
    const handlers: Record<string, () => void> = {
      new: () => documents.create(),
      open: () => void openFileFlow(),
      openFolder: () => void openFolderFlow(),
      save: () => void saveFlow(),
      saveAs: () => void saveAsFlow(),
      close: () => {
        if (documents.activeId) requestClose(documents.activeId);
      },
      cycleView: () => ui.cycleViewMode(),
      toggleFiles: () => ui.toggleSidebar('files'),
      toggleOutline: () => ui.toggleSidebar('outline'),
      toggleZen: () => ui.toggleZen(),
      exitZen: () => {
        if (ui.diagram !== null) ui.diagram = null;
        else if (ui.paletteOpen) ui.paletteOpen = false;
        else if (ui.settingsOpen) ui.settingsOpen = false;
        else if (ui.zen) ui.zen = false;
      },
      settings: () => (ui.settingsOpen = true),
      nextTab: () => cycleTab(1),
      prevTab: () => cycleTab(-1),
      exportHtml: () => void exportHtmlFlow(),
      print: printFlow,
      palette: () => (ui.paletteOpen = true),
      viewEditor: () => (ui.viewMode = 'editor'),
      viewSplit: () => (ui.viewMode = 'split'),
      viewPreview: () => (ui.viewMode = 'preview'),
      toggleToolbar: () => {
        ui.toggleToolbar();
        prefs.update({ showToolbar: ui.showToolbar });
      },
      toggleSync: () => {
        ui.toggleScrollSync();
        prefs.update({ scrollSync: ui.scrollSync });
      },
      zoomIn: () => zoomEditor(1),
      zoomOut: () => zoomEditor(-1),
      zoomReset: resetZoom,
    };
    handlers[action]?.();
  }

  function goToHeading(line: number): void {
    editor?.moveCursorToLine(line);
    preview?.scrollToLine(line);
  }

  function onEditorScroll(line: number): void {
    if (!ui.scrollSync) return;
    if (ui.viewMode === 'split' && guard.claim('editor')) preview?.scrollToLine(line);
  }

  function onPreviewScroll(line: number): void {
    if (!ui.scrollSync) return;
    if (ui.viewMode === 'split' && guard.claim('preview')) editor?.scrollToLine(line);
  }

  function onActiveBlock(start: number, end: number): void {
    activeBlock = { start, end };
    if (prefs.current.highlightActiveBlock && ui.viewMode === 'split' && !ui.scrollSync) {
      preview?.revealBlock(start);
    }
  }

  onMount(() => {
    const stop = registerShortcuts({
      new: () => handleAction('new'),
      open: () => handleAction('open'),
      openFolder: () => handleAction('openFolder'),
      save: () => handleAction('save'),
      saveAs: () => handleAction('saveAs'),
      close: () => handleAction('close'),
      cycleView: () => handleAction('cycleView'),
      toggleFiles: () => handleAction('toggleFiles'),
      toggleOutline: () => handleAction('toggleOutline'),
      toggleZen: () => handleAction('toggleZen'),
      exitZen: () => handleAction('exitZen'),
      settings: () => handleAction('settings'),
      nextTab: () => handleAction('nextTab'),
      prevTab: () => handleAction('prevTab'),
      exportHtml: () => handleAction('exportHtml'),
      print: () => handleAction('print'),
      palette: () => handleAction('palette'),
      zoomIn: () => handleAction('zoomIn'),
      zoomOut: () => handleAction('zoomOut'),
      zoomReset: () => handleAction('zoomReset'),
    });
    return stop;
  });

  onMount(() => {
    let disposed = false;
    const cleanups: (() => void)[] = [];

    void (async () => {
      await prefs.load();
      setLanguage(prefs.current.language);
      ui.splitRatio = prefs.current.splitRatio;
      ui.scrollSync = prefs.current.scrollSync;
      ui.showToolbar = prefs.current.showToolbar;
      await recent.load();
      if (prefs.current.lastFolder) await setFolder(prefs.current.lastFolder);

      const paths = await startupPaths().catch(() => []);
      for (const path of paths) await openDocument(path);
      if (!disposed) await appWindow.show();

      const offFs = await onFsChanged(({ path, kind }) => {
        const doc = documents.findByPath(path);
        if (doc) void documents.markExternalChange(doc.id, kind);
      });
      cleanups.push(offFs);

      const offOpen = await onOpenPaths((incoming) => {
        void (async () => {
          for (const path of incoming) await openDocument(path);
        })();
      });
      cleanups.push(offOpen);

      const offDrop = await getCurrentWebview().onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type !== 'drop') return;
        void (async () => {
          for (const path of payload.paths) {
            const extension = extname(path);
            if (MARKDOWN_EXTENSIONS.includes(extension)) await openDocument(path);
            else if (IMAGE_EXTENSIONS.includes(extension)) await insertDroppedImage(path);
          }
        })();
      });
      cleanups.push(offDrop);

      const offClose = await appWindow.onCloseRequested((event) => {
        if (documents.dirtyDocuments.length === 0) return;
        event.preventDefault();
        void requestQuit();
      });
      cleanups.push(offClose);
    })();

    return () => {
      disposed = true;
      for (const off of cleanups) off();
    };
  });

  onMount(() => {
    function onBlur(): void {
      if (prefs.current.autosave !== 'onFocusChange') return;
      for (const doc of documents.dirtyDocuments) {
        if (doc.path !== null) void documents.save(doc.id).catch(() => undefined);
      }
    }
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  });

  $effect(() => {
    const theme = resolvedTheme();
    document.documentElement.dataset.theme = theme;
  });

  $effect(() => {
    if (prefs.current.theme !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      document.documentElement.dataset.theme = resolvedTheme();
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  });

  $effect(() => {
    const doc = documents.active;
    const dirty = doc !== null && doc.text !== doc.savedText;
    document.title = doc ? `${dirty ? '• ' : ''}${doc.title} — Reader` : 'Reader';
  });

  $effect(() => {
    const doc = documents.active;
    if (!doc || prefs.current.autosave !== 'afterDelay') return;
    const text = doc.text;
    if (doc.path === null || text === doc.savedText) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      void documents.save(doc.id).catch(() => undefined);
    }, prefs.current.autosaveDelayMs);
    return () => {
      if (autosaveTimer) clearTimeout(autosaveTimer);
    };
  });
</script>

<div class="app" class:zen={ui.zen}>
  {#if !ui.zen}
    <TitleBar
      items={tabs}
      activeId={documents.activeId}
      onselect={(id) => (documents.activeId = id)}
      onclose={requestClose}
      onaction={handleAction}
      onrequestclose={() => void requestQuit()}
    />
  {/if}

  {#if ui.showToolbar && !ui.zen}
    <Toolbar disabled={active === null} onaction={handleAction} />
  {/if}

  <div class="body">
    {#if ui.sidebar !== null && !ui.zen}
      <Sidebar
        {entries}
        {outline}
        activeIndex={activeHeading}
        activePath={active?.path ?? null}
        onopen={(path) => void openDocument(path)}
        onheading={goToHeading}
        onopenfolder={() => void openFolderFlow()}
      />
    {/if}

    <main>
      {#if active === null}
        <Welcome
          onopen={(path) => void openDocument(path)}
          onopendialog={() => void openFileFlow()}
          onnew={() => documents.create()}
        />
      {:else}
        {#if active.externalChange !== 'none'}
          <div class="notice" role="status">
            <span>
              {active.externalChange === 'removed'
                ? t('reload.deleted', { name: active.title })
                : t('reload.changed', { name: active.title })}
            </span>
            {#if active.externalChange === 'modified'}
              <button onclick={() => void documents.reload(active.id)}>{t('reload.reload')}</button>
            {/if}
            <button onclick={() => documents.dismissExternalChange(active.id)}>
              {t('reload.keep')}
            </button>
          </div>
        {/if}

        <div class="panes">
          {#if ui.viewMode === 'split'}
            <SplitPane
              ratio={ui.splitRatio}
              onratio={(value) => {
                ui.splitRatio = value;
                prefs.update({ splitRatio: value });
              }}
            >
              {#snippet left()}
                <Editor
                  bind:this={editor}
                  docId={active.id}
                  onpasteimage={insertPastedImage}
                  onscrollline={onEditorScroll}
                  onblock={onActiveBlock}
                  onselection={(n) => (selectedWords = n)}
                />
              {/snippet}
              {#snippet right()}
                <Preview
                  bind:this={preview}
                  docId={active.id}
                  {activeBlock}
                  onopen={(path) => void openDocument(path)}
                  onscrollline={onPreviewScroll}
                  onpicksource={goToSource}
                  oncopy={(ok) => toasts.push(t(ok ? 'preview.copied' : 'preview.copyFailed'))}
                  ondiagram={(svg) => (ui.diagram = svg)}
                />
              {/snippet}
            </SplitPane>
          {:else if ui.viewMode === 'editor'}
            <Editor
              bind:this={editor}
              docId={active.id}
              onpasteimage={insertPastedImage}
              onblock={onActiveBlock}
              onselection={(n) => (selectedWords = n)}
            />
          {:else}
            <Preview
              bind:this={preview}
              docId={active.id}
              onopen={(path) => void openDocument(path)}
              onpicksource={goToSource}
              oncopy={(ok) => toasts.push(t(ok ? 'preview.copied' : 'preview.copyFailed'))}
              ondiagram={(svg) => (ui.diagram = svg)}
            />
          {/if}
        </div>
      {/if}
    </main>
  </div>

  {#if !ui.zen}
    <StatusBar
      doc={active}
      dirty={active !== null && active.text !== active.savedText}
      {saving}
      {selectedWords}
      onlineending={(value) => {
        if (active) documents.setLineEnding(active.id, value);
      }}
    />
  {/if}
</div>

{#if pending}
  <Dialog
    title={t('dialog.unsavedTitle')}
    body={t('dialog.unsavedBody', { name: pending.doc.title })}
    choices={[
      { id: 'save', label: t('dialog.save'), tone: 'primary' },
      { id: 'discard', label: t('dialog.discard'), tone: 'danger' },
      { id: 'cancel', label: t('dialog.cancel') },
    ]}
    onchoose={(choice) => void resolvePending(choice)}
  />
{/if}

{#if ui.settingsOpen}
  <Settings onclose={() => (ui.settingsOpen = false)} />
{/if}

{#if ui.paletteOpen}
  <CommandPalette
    hasDocument={active !== null}
    onrun={handleAction}
    onclose={() => (ui.paletteOpen = false)}
  />
{/if}

{#if ui.diagram !== null}
  <DiagramViewer
    svg={ui.diagram}
    onclose={() => (ui.diagram = null)}
    onsave={(format, data) => void saveDiagram(format, data)}
  />
{/if}

<Toasts />

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .body {
    display: flex;
    flex: 1;
    min-height: 0;
    min-width: 0;
  }

  main {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  .panes {
    flex: 1;
    min-height: 0;
  }

  .notice {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 7px 14px;
    background: var(--accent-soft);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .notice span {
    flex: 1;
  }

  .notice button {
    padding: 3px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 5px;
    background: var(--bg);
  }

  .notice button:hover {
    background: var(--bg-hover);
  }
</style>
