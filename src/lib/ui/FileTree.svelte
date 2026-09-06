<script lang="ts">
  import { listDir } from '$lib/fs/api';
  import type { Entry } from '$lib/fs/api-types';
  import Self from './FileTree.svelte';

  interface Props {
    entries: Entry[];
    activePath: string | null;
    depth?: number;
    onopen: (path: string) => void;
  }

  const { entries, activePath, depth = 0, onopen }: Props = $props();

  const expanded = $state(new Set<string>());
  const loaded = $state(new Map<string, Entry[]>());

  async function toggle(entry: Entry): Promise<void> {
    if (expanded.has(entry.path)) {
      expanded.delete(entry.path);
      return;
    }
    expanded.add(entry.path);
    if (entry.children) {
      loaded.set(entry.path, entry.children);
      return;
    }
    if (loaded.has(entry.path)) return;
    const children = await listDir(entry.path, 2).catch(() => []);
    loaded.set(entry.path, children);
  }

  function childrenOf(entry: Entry): Entry[] {
    return loaded.get(entry.path) ?? entry.children ?? [];
  }

  function isActive(entry: Entry): boolean {
    return activePath !== null && activePath.toLowerCase() === entry.path.toLowerCase();
  }
</script>

<ul class="tree" role={depth === 0 ? 'tree' : 'group'}>
  {#each entries as entry (entry.path)}
    <li role="none">
      {#if entry.is_dir}
        <button
          class="row"
          role="treeitem"
          aria-selected="false"
          aria-expanded={expanded.has(entry.path)}
          style="padding-left: {8 + depth * 12}px"
          onclick={() => toggle(entry)}
        >
          <svg class="chevron" class:open={expanded.has(entry.path)} width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M3 1l4 4-4 4" stroke="currentColor" stroke-width="1.4" fill="none" />
          </svg>
          <span class="name">{entry.name}</span>
        </button>
        {#if expanded.has(entry.path)}
          <Self entries={childrenOf(entry)} {activePath} depth={depth + 1} {onopen} />
        {/if}
      {:else}
        <button
          class="row file"
          class:active={isActive(entry)}
          role="treeitem"
          aria-selected={isActive(entry)}
          style="padding-left: {20 + depth * 12}px"
          title={entry.path}
          onclick={() => onopen(entry.path)}
        >
          <span class="name">{entry.name}</span>
        </button>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .tree {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding-block: 4px;
    padding-right: 8px;
    text-align: left;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .row:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .row.active {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chevron {
    flex-shrink: 0;
    transition: transform 120ms ease;
    color: var(--text-faint);
  }

  .chevron.open {
    transform: rotate(90deg);
  }
</style>
