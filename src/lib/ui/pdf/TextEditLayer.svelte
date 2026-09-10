<script lang="ts">
  import { toScreenRect } from '$lib/pdf/annotations/geometry';
  import type { PageSize } from '$lib/pdf/document';
  import type { TextEdit } from '$lib/pdf/edit/document';

  interface Props {
    size: PageSize;
    scale: number;
    rotation: number;
    edits: TextEdit[];
    onremove: (id: string) => void;
  }

  const { size, scale, rotation, edits, onremove }: Props = $props();

  const placed = $derived(
    edits.map((edit) => ({
      edit,
      box: toScreenRect(
        {
          x: edit.x,
          y: edit.y - edit.height * 0.24,
          width: Math.max(edit.width, 1),
          height: edit.height * 1.18,
        },
        size,
        scale,
        rotation,
      ),
    })),
  );
</script>

<div class="edits">
  {#each placed as entry (entry.edit.id)}
    <button
      class="edit"
      style="left: {entry.box.x}px; top: {entry.box.y}px; width: {entry.box.width}px; height: {entry
        .box.height}px; font-size: {entry.edit.height * scale * 0.82}px"
      title={entry.edit.oldText}
      onclick={() => onremove(entry.edit.id)}
    >
      <span>{entry.edit.newText}</span>
    </button>
  {/each}
</div>

<style>
  .edits {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .edit {
    position: absolute;
    display: flex;
    align-items: center;
    padding: 0;
    background: #ffffff;
    border: 1px dashed var(--accent);
    color: #101010;
    font-family: inherit;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    pointer-events: auto;
    cursor: pointer;
  }

  .edit span {
    padding-left: 1px;
  }

  .edit:hover {
    background: var(--accent-soft);
  }
</style>
