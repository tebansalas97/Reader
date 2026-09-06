<script lang="ts">
  import { t } from '$lib/i18n';
  import { prefs } from '$lib/state/prefs.svelte';
  import { ui } from '$lib/state/ui.svelte';

  interface Props {
    disabled: boolean;
    onaction: (action: string, argument?: string | number) => void;
  }

  const { disabled, onaction }: Props = $props();

  let headingOpen = $state(false);
  let headingAnchor = $state<HTMLElement | null>(null);
  let headingTrigger = $state<HTMLElement | null>(null);
  let menuLeft = $state(0);
  let menuTop = $state(0);

  function openHeadings(): void {
    if (headingOpen) {
      headingOpen = false;
      return;
    }
    const box = headingTrigger?.getBoundingClientRect();
    if (box) {
      menuLeft = box.left;
      menuTop = box.bottom + 4;
    }
    headingOpen = true;
  }

  const LEVELS = [1, 2, 3, 4, 5, 6];

  const KEYS: Record<string, string> = {
    undo: 'Ctrl+Z',
    redo: 'Ctrl+Y',
    bold: 'Ctrl+B',
    italic: 'Ctrl+I',
    strike: 'Ctrl+Shift+X',
    code: String.fromCharCode(67, 116, 114, 108, 43, 96),
    bullet: 'Ctrl+Shift+L',
    task: 'Ctrl+Shift+T',
    quote: 'Ctrl+Shift+Q',
    link: 'Ctrl+K',
    find: 'Ctrl+F',
  };

  function tip(key: string): string {
    const label = t(`toolbar.${key}`);
    const keys = KEYS[key];
    return keys ? `${label} · ${keys}` : label;
  }

  function pickHeading(level: number): void {
    headingOpen = false;
    onaction('heading', level);
  }

  function onWindowPointerDown(event: PointerEvent): void {
    if (!headingOpen) return;
    const target = event.target;
    if (target instanceof Node && headingAnchor?.contains(target)) return;
    headingOpen = false;
  }
</script>

<svelte:window onpointerdown={onWindowPointerDown} />

<div class="toolbar" role="toolbar" aria-label={t('toolbar.label')}>
  <div class="group">
    <button
      class="tool"
      {disabled}
      title={tip('undo')}
      aria-label={t('toolbar.undo')}
      onclick={() => onaction('undo')}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 7h7a3.5 3.5 0 010 7H7M3 7l3-3M3 7l3 3" />
      </svg>
    </button>
    <button
      class="tool"
      {disabled}
      title={tip('redo')}
      aria-label={t('toolbar.redo')}
      onclick={() => onaction('redo')}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M13 7H6a3.5 3.5 0 000 7h3M13 7l-3-3M13 7l-3 3" />
      </svg>
    </button>
  </div>

  <div class="sep"></div>

  <div class="group" bind:this={headingAnchor}>
    <button
      class="tool wide"
      bind:this={headingTrigger}
      {disabled}
      aria-expanded={headingOpen}
      title={t('toolbar.heading')}
      onclick={openHeadings}
    >
      <span class="label">H</span>
      <svg class="caret" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 4l3 3 3-3" /></svg>
    </button>
    {#if headingOpen}
      <div class="dropdown" role="menu" style="left: {menuLeft}px; top: {menuTop}px">
        {#each LEVELS as level (level)}
          <button role="menuitem" onclick={() => pickHeading(level)}>
            <span class="h{level}">{t('toolbar.headingLevel', { n: level })}</span>
            <kbd>Ctrl+{level}</kbd>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <div class="sep"></div>

  <div class="group">
    <button
      class="tool"
      {disabled}
      title={tip('bold')}
      aria-label={t('toolbar.bold')}
      onclick={() => onaction('bold')}
    >
      <span class="label bold">B</span>
    </button>
    <button
      class="tool"
      {disabled}
      title={tip('italic')}
      aria-label={t('toolbar.italic')}
      onclick={() => onaction('italic')}
    >
      <span class="label italic">I</span>
    </button>
    <button
      class="tool"
      {disabled}
      title={tip('strike')}
      aria-label={t('toolbar.strike')}
      onclick={() => onaction('strike')}
    >
      <span class="label strike">S</span>
    </button>
    <button
      class="tool"
      {disabled}
      title={tip('code')}
      aria-label={t('toolbar.code')}
      onclick={() => onaction('code')}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6 4L2.5 8 6 12M10 4l3.5 4-3.5 4" />
      </svg>
    </button>
  </div>

  <div class="sep"></div>

  <div class="group">
    <button
      class="tool"
      {disabled}
      title={tip('bullet')}
      aria-label={t('toolbar.bullet')}
      onclick={() => onaction('bullet')}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6 4h8M6 8h8M6 12h8" />
        <circle cx="3" cy="4" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="3" cy="8" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="3" cy="12" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    </button>
    <button
      class="tool"
      {disabled}
      title={t('toolbar.ordered')}
      aria-label={t('toolbar.ordered')}
      onclick={() => onaction('ordered')}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6 4h8M6 8h8M6 12h8M2 3v2.5M1.4 3H2M1.4 8.6h1.4L1.4 10.6h1.4M1.4 12.4h1.4v1h-1.4v1h1.4" />
      </svg>
    </button>
    <button
      class="tool"
      {disabled}
      title={tip('task')}
      aria-label={t('toolbar.task')}
      onclick={() => onaction('task')}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="1.5" y="4.5" width="7" height="7" rx="1.5" />
        <path d="M3.5 8l1.6 1.6L11 4" />
      </svg>
    </button>
    <button
      class="tool"
      {disabled}
      title={tip('quote')}
      aria-label={t('toolbar.quote')}
      onclick={() => onaction('quote')}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 3v10M6.5 5h7M6.5 8h7M6.5 11h4" />
      </svg>
    </button>
  </div>

  <div class="sep"></div>

  <div class="group">
    <button
      class="tool"
      {disabled}
      title={tip('link')}
      aria-label={t('toolbar.link')}
      onclick={() => onaction('link')}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6.5 9.5a3 3 0 004.2 0l2.3-2.3a3 3 0 10-4.2-4.2L7.6 4.2" />
        <path d="M9.5 6.5a3 3 0 00-4.2 0L3 8.8a3 3 0 104.2 4.2l1.2-1.2" />
      </svg>
    </button>
    <button
      class="tool"
      {disabled}
      title={t('toolbar.image')}
      aria-label={t('toolbar.image')}
      onclick={() => onaction('image')}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
        <circle cx="5.5" cy="6.5" r="1.2" />
        <path d="M2.5 11.5l3.5-3 3 2.5 2-1.5 2.5 2" />
      </svg>
    </button>
    <button
      class="tool"
      {disabled}
      title={t('toolbar.table')}
      aria-label={t('toolbar.table')}
      onclick={() => onaction('table')}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
        <path d="M1.5 6.5h13M6 3v10M10.5 3v10" />
      </svg>
    </button>
    <button
      class="tool"
      {disabled}
      title={t('toolbar.codeBlock')}
      aria-label={t('toolbar.codeBlock')}
      onclick={() => onaction('codeBlock')}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
        <path d="M6 6.5L4.5 8 6 9.5M10 6.5L11.5 8 10 9.5" />
      </svg>
    </button>
    <button
      class="tool"
      {disabled}
      title={t('toolbar.rule')}
      aria-label={t('toolbar.rule')}
      onclick={() => onaction('rule')}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h12" /></svg>
    </button>
  </div>

  <div class="sep"></div>

  <div class="group">
    <button
      class="tool"
      {disabled}
      title={tip('find')}
      aria-label={t('toolbar.find')}
      onclick={() => onaction('find')}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="7" cy="7" r="4.5" />
        <path d="M10.5 10.5L14 14" />
      </svg>
    </button>
  </div>

  <div class="grow"></div>

  <div class="group">
    <button
      class="tool toggle"
      class:on={prefs.current.highlightActiveBlock}
      title={t('toolbar.highlight')}
      aria-label={t('toolbar.highlight')}
      aria-pressed={prefs.current.highlightActiveBlock}
      onclick={() =>
        prefs.update({ highlightActiveBlock: !prefs.current.highlightActiveBlock })}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2 12.5l2.5.5 7-7a1.8 1.8 0 00-2.5-2.5l-7 7z" />
        <path d="M1 15h14" />
      </svg>
    </button>
    <label class="sync" title={t('toolbar.syncHint')}>
      <input
        type="checkbox"
        checked={ui.scrollSync}
        onchange={(e) => {
          ui.scrollSync = e.currentTarget.checked;
          prefs.update({ scrollSync: e.currentTarget.checked });
        }}
      />
      <span>{t('toolbar.sync')}</span>
    </label>
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    min-height: 36px;
    padding: 4px 8px;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .toolbar::-webkit-scrollbar {
    display: none;
  }

  .group {
    position: relative;
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .grow {
    flex: 1;
    min-width: 8px;
  }

  .sep {
    width: 1px;
    height: 18px;
    margin: 0 5px;
    background: var(--border);
    flex-shrink: 0;
  }

  .tool {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    width: 28px;
    height: 26px;
    border-radius: 5px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .tool.wide {
    width: auto;
    padding: 0 6px;
  }

  .tool:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text);
  }

  .tool:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .tool.toggle.on {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .tool svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.35;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .caret {
    width: 10px;
    height: 10px;
  }

  .label {
    font-size: 14px;
    line-height: 1;
  }

  .label.bold {
    font-weight: 800;
  }

  .label.italic {
    font-style: italic;
    font-family: Georgia, serif;
  }

  .label.strike {
    text-decoration: line-through;
  }

  .dropdown {
    position: fixed;
    z-index: 30;
    min-width: 190px;
    padding: 4px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: var(--shadow);
  }

  .dropdown button {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    padding: 5px 8px;
    border-radius: 5px;
    text-align: left;
  }

  .dropdown button:hover {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .dropdown kbd {
    font-family: inherit;
    font-size: 0.85em;
    color: var(--text-faint);
  }

  .dropdown button:hover kbd {
    color: var(--accent-contrast);
    opacity: 0.75;
  }

  .h1 {
    font-size: 1.35em;
    font-weight: 700;
  }

  .h2 {
    font-size: 1.2em;
    font-weight: 700;
  }

  .h3 {
    font-size: 1.08em;
    font-weight: 650;
  }

  .h4 {
    font-weight: 650;
  }

  .h5,
  .h6 {
    font-size: 0.94em;
    color: var(--text-muted);
  }

  .sync {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
    padding: 0 4px 0 6px;
    color: var(--text-muted);
    white-space: nowrap;
    cursor: pointer;
  }

  .sync input {
    accent-color: var(--accent);
    cursor: pointer;
  }

  .sync:hover {
    color: var(--text);
  }
</style>
