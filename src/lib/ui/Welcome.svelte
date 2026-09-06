<script lang="ts">
  import { basename, dirname } from '$lib/fs/paths';
  import { t } from '$lib/i18n';
  import { recent } from '$lib/state/recent.svelte';

  interface Props {
    onopen: (path: string) => void;
    onopendialog: () => void;
    onnew: () => void;
  }

  const { onopen, onopendialog, onnew }: Props = $props();
</script>

<div class="welcome">
  <div class="inner">
    <h1>Reader</h1>
    <p class="subtitle">{t('welcome.subtitle')}</p>
    <div class="actions">
      <button class="primary" onclick={onopendialog}>{t('welcome.open')}</button>
      <button class="secondary" onclick={onnew}>{t('welcome.newFile')}</button>
    </div>
    <section class="recent">
      <h2>{t('welcome.recent')}</h2>
      {#if recent.list.length === 0}
        <p class="none">{t('welcome.noRecent')}</p>
      {:else}
        <ul>
          {#each recent.list.slice(0, 8) as item (item.path)}
            <li>
              <button onclick={() => onopen(item.path)} title={item.path}>
                <span class="name">{basename(item.path)}</span>
                <span class="dir">{dirname(item.path)}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
    <p class="hint">{t('welcome.hint')}</p>
  </div>
</div>

<style>
  .welcome {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    overflow: auto;
    background: var(--bg);
  }

  .inner {
    width: min(520px, 100%);
    padding: 32px;
  }

  h1 {
    margin: 0;
    font-size: 2.4em;
    font-weight: 300;
    letter-spacing: -0.02em;
  }

  .subtitle {
    margin: 4px 0 28px;
    color: var(--text-muted);
    font-size: 1.05em;
  }

  .actions {
    display: flex;
    gap: 10px;
    margin-bottom: 36px;
  }

  .primary,
  .secondary {
    padding: 9px 18px;
    border-radius: var(--radius);
    border: 1px solid var(--border-strong);
  }

  .primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-contrast);
  }

  .primary:hover {
    filter: brightness(1.08);
  }

  .secondary:hover {
    background: var(--bg-hover);
  }

  .recent h2 {
    margin: 0 0 8px;
    font-size: 0.85em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
  }

  .recent ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .recent button {
    display: flex;
    align-items: baseline;
    gap: 10px;
    width: 100%;
    padding: 6px 8px;
    border-radius: 5px;
    text-align: left;
  }

  .recent button:hover {
    background: var(--bg-hover);
  }

  .name {
    color: var(--text);
    flex-shrink: 0;
  }

  .dir {
    color: var(--text-faint);
    font-size: 0.92em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    direction: rtl;
    text-align: left;
  }

  .none {
    margin: 0;
    padding: 6px 8px;
    color: var(--text-faint);
  }

  .hint {
    margin: 32px 0 0;
    color: var(--text-faint);
    font-size: 0.92em;
  }
</style>
