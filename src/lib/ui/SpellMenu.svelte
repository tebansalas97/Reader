<script lang="ts">
  import { t } from '$lib/i18n';

  interface Props {
    word: string;
    suggestions: string[];
    x: number;
    y: number;
    onpick: (replacement: string) => void;
    onadd: () => void;
    onclose: () => void;
  }

  const { word, suggestions, x, y, onpick, onadd, onclose }: Props = $props();

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    onclose();
  }
</script>

<svelte:window onkeydown={onKeyDown} onpointerdown={onclose} />

<div
  class="menu"
  role="menu"
  tabindex="-1"
  style="left: {x}px; top: {y}px"
  onpointerdown={(event) => event.stopPropagation()}
>
  <p class="word">{word}</p>
  {#if suggestions.length === 0}
    <p class="none">{t('spell.noSuggestions')}</p>
  {:else}
    {#each suggestions as suggestion (suggestion)}
      <button role="menuitem" onclick={() => onpick(suggestion)}>{suggestion}</button>
    {/each}
  {/if}
  <div class="sep"></div>
  <button class="add" role="menuitem" onclick={onadd}>{t('spell.addWord')}</button>
</div>

<style>
  .menu {
    position: fixed;
    z-index: 75;
    min-width: 190px;
    max-height: 320px;
    overflow-y: auto;
    padding: 4px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: var(--shadow);
  }

  .word {
    margin: 0;
    padding: 5px 10px;
    color: var(--text-faint);
    font-size: 0.85em;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .menu button {
    display: block;
    width: 100%;
    padding: 5px 10px;
    border-radius: 5px;
    text-align: left;
  }

  .menu button:hover {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .add {
    color: var(--text-muted);
  }

  .none {
    margin: 0;
    padding: 5px 10px;
    color: var(--text-faint);
  }

  .sep {
    height: 1px;
    margin: 4px 6px;
    background: var(--border);
  }
</style>
