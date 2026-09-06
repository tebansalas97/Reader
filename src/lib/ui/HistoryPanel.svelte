<script lang="ts">
  import { clearSnapshots, listSnapshots, readSnapshot } from '$lib/fs/api';
  import type { Snapshot } from '$lib/fs/api-types';
  import { t } from '$lib/i18n';

  interface Props {
    path: string | null;
    stamp: number;
    onrestore: (text: string) => void;
    onpreview: (text: string, label: string) => void;
  }

  const { path, stamp, onrestore, onpreview }: Props = $props();

  let snapshots = $state<Snapshot[]>([]);
  let busy = $state(false);

  function when(ms: number): string {
    const date = new Date(ms);
    const today = new Date();
    const sameDay =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();
    const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return time;
    return `${date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} ${time}`;
  }

  function size(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    return `${Math.round(bytes / 1024)} KB`;
  }

  async function refresh(): Promise<void> {
    if (!path) {
      snapshots = [];
      return;
    }
    busy = true;
    snapshots = await listSnapshots(path).catch(() => []);
    busy = false;
  }

  async function open(id: string, label: string): Promise<void> {
    if (!path) return;
    const text = await readSnapshot(path, id).catch(() => null);
    if (text !== null) onpreview(text, label);
  }

  async function restore(id: string): Promise<void> {
    if (!path) return;
    const text = await readSnapshot(path, id).catch(() => null);
    if (text !== null) onrestore(text);
  }

  async function wipe(): Promise<void> {
    if (!path) return;
    await clearSnapshots(path).catch(() => undefined);
    await refresh();
  }

  $effect(() => {
    void path;
    void stamp;
    void refresh();
  });
</script>

<div class="history">
  {#if path === null}
    <p class="note">{t('history.needsFile')}</p>
  {:else if busy && snapshots.length === 0}
    <p class="note">{t('history.loading')}</p>
  {:else if snapshots.length === 0}
    <p class="note">{t('history.empty')}</p>
  {:else}
    <div class="list">
      {#each snapshots as snapshot, index (snapshot.id)}
        <div class="entry">
          <button
            class="open"
            onclick={() => void open(snapshot.id, when(snapshot.savedMs))}
            title={t('history.preview')}
          >
            <span class="when">{when(snapshot.savedMs)}</span>
            <span class="meta">{size(snapshot.bytes)}</span>
            {#if index === 0}<span class="tag">{t('history.latest')}</span>{/if}
          </button>
          <button class="restore" onclick={() => void restore(snapshot.id)}>
            {t('history.restore')}
          </button>
        </div>
      {/each}
    </div>
    <button class="wipe" onclick={() => void wipe()}>{t('history.clear')}</button>
  {/if}
</div>

<style>
  .history {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .note {
    margin: 0;
    padding: 16px 12px;
    color: var(--text-faint);
  }

  .list {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    padding: 4px 0;
  }

  .entry {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-right: 8px;
  }

  .entry:hover {
    background: var(--bg-hover);
  }

  .open {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex: 1;
    min-width: 0;
    padding: 6px 10px;
    text-align: left;
  }

  .when {
    color: var(--text);
    white-space: nowrap;
  }

  .meta {
    color: var(--text-faint);
    font-size: 0.9em;
  }

  .tag {
    padding: 0 6px;
    border-radius: 8px;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 0.82em;
  }

  .restore {
    padding: 2px 8px;
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--text-muted);
    font-size: 0.88em;
    opacity: 0;
    flex-shrink: 0;
  }

  .entry:hover .restore,
  .restore:focus-visible {
    opacity: 1;
  }

  .restore:hover {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-contrast);
  }

  .wipe {
    margin: 8px 10px;
    padding: 5px;
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .wipe:hover {
    color: var(--danger);
    border-color: var(--danger);
  }
</style>
