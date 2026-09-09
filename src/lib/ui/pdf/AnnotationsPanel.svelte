<script lang="ts">
  import { t } from '$lib/i18n';
  import type { Annotation } from '$lib/pdf/annotations/model';
  import { labelFor, pagesWithQuads, textInQuads } from '$lib/pdf/annotations/summary';
  import type { PdfHandle } from '$lib/pdf/document';
  import { positionOfSource, type PageEdit } from '$lib/pdf/pages';

  interface Props {
    annotations: Annotation[];
    plan: PageEdit[];
    handle: PdfHandle | null;
    selectedId: string | null;
    onselect: (id: string, page: number) => void;
    ondelete: (id: string) => void;
  }

  const { annotations, plan, handle, selectedId, onselect, ondelete }: Props = $props();

  const ICONS: Record<string, string> = {
    highlight: 'M3 12h10v2H3zM5 3h6l1 7H4z',
    underline: 'M5 2v5a3 3 0 006 0V2M4 14h8',
    strikeout: 'M5 3v4a3 3 0 006 0V3M3 8h10M8 10v3',
    ink: 'M3 13c3 1 4-6 7-6s2 4 3 4',
    note: 'M3 3h10v7H7l-3 3v-3H3z',
    rect: 'M3 4h10v8H3z',
    ellipse: 'M8 4c3 0 5 1.8 5 4s-2 4-5 4-5-1.8-5-4 2-4 5-4z',
  };

  let items = $state<Map<number, unknown[]>>(new Map());
  let list = $state<HTMLElement | null>(null);

  const placed = $derived(
    annotations
      .map((annotation) => ({ annotation, page: positionOfSource(plan, annotation.page) }))
      .filter((entry) => entry.page > 0)
      .sort((a, b) => a.page - b.page),
  );
  const groups = $derived(
    placed.reduce((list, entry) => {
      const last = list[list.length - 1];
      if (last && last.page === entry.page) last.marks.push(entry.annotation);
      else list.push({ page: entry.page, marks: [entry.annotation] });
      return list;
    }, [] as Array<{ page: number; marks: Annotation[] }>),
  );

  $effect(() => {
    const source = handle;
    const wanted = pagesWithQuads(annotations);
    if (!source || wanted.length === 0) return;

    let cancelled = false;
    void (async () => {
      const found = new Map(items);
      let added = false;
      for (const page of wanted) {
        if (found.has(page)) continue;
        const proxy = await source.page(page).catch(() => null);
        const content = await proxy?.getTextContent().catch(() => null);
        if (cancelled) return;
        found.set(page, content?.items ?? []);
        added = true;
      }
      if (!cancelled && added) items = found;
    })();

    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    const id = selectedId;
    const node = list;
    if (!id || !node) return;
    const row = node.querySelector<HTMLElement>('.mark.on');
    row?.scrollIntoView({ block: 'nearest' });
  });

  function textOf(annotation: Annotation): string | null {
    const quads = annotation.quads ?? [];
    if (quads.length === 0) return null;
    const page = items.get(annotation.page);
    if (!page) return null;
    return textInQuads(page, quads);
  }
</script>

{#if placed.length === 0}
  <div class="empty">
    <p>{t('pdf.noAnnotations')}</p>
    <p class="hint">{t('pdf.annotationsHint')}</p>
  </div>
{:else}
  <ul class="list" bind:this={list}>
    {#each groups as group (group.page)}
      <li class="group">
        <p class="page">{t('pdf.page')} {group.page}</p>
        <ul class="marks">
          {#each group.marks as mark (mark.id)}
            <li class="mark" class:on={mark.id === selectedId}>
              <button
                class="go"
                title={t('pdf.goToMark')}
                onclick={() => onselect(mark.id, group.page)}
              >
                <span class="dot" style="--dot: {mark.color}">
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d={ICONS[mark.kind] ?? ICONS.note} />
                  </svg>
                </span>
                <span class="text">{labelFor(mark, textOf(mark), t(`pdf.tool.${mark.kind}`))}</span>
              </button>
              <button
                class="remove"
                title={t('pdf.deleteMark')}
                aria-label={t('pdf.deleteMark')}
                onclick={() => ondelete(mark.id)}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
              </button>
            </li>
          {/each}
        </ul>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .empty {
    padding: 16px 12px;
    color: var(--text-faint);
  }

  .empty p {
    margin: 0 0 6px;
  }

  .hint {
    font-size: 0.92em;
  }

  .list,
  .marks {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .page {
    margin: 0;
    padding: 8px 10px 3px;
    font-size: 0.92em;
    font-weight: 600;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .mark {
    display: flex;
    align-items: center;
    gap: 2px;
    padding-right: 4px;
  }

  .mark:hover {
    background: var(--bg-hover);
  }

  .mark.on {
    background: var(--accent-soft);
  }

  .go {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 4px 5px 10px;
    text-align: left;
    color: var(--text);
  }

  .dot {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 5px;
    background: var(--dot);
    flex-shrink: 0;
  }

  .dot svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: rgba(0, 0, 0, 0.7);
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 5px;
    color: var(--text-faint);
    opacity: 0;
    flex-shrink: 0;
  }

  .mark:hover .remove,
  .mark.on .remove {
    opacity: 1;
  }

  .remove:hover {
    color: var(--danger);
    background: var(--bg-elevated);
  }

  .remove svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
  }
</style>
