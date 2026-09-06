<script lang="ts">
  interface Choice {
    id: string;
    label: string;
    tone?: 'primary' | 'danger' | 'plain';
  }

  interface Props {
    title: string;
    body: string;
    choices: Choice[];
    onchoose: (id: string) => void;
  }

  const { title, body, choices, onchoose }: Props = $props();

  let panel = $state<HTMLElement | null>(null);

  $effect(() => {
    panel?.querySelector<HTMLButtonElement>('button')?.focus();
  });

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      const cancel = choices.find((c) => c.id === 'cancel') ?? choices[choices.length - 1];
      if (cancel) onchoose(cancel.id);
      return;
    }
    if (event.key !== 'Tab' || !panel) return;
    const focusable = Array.from(panel.querySelectorAll<HTMLButtonElement>('button'));
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="backdrop">
  <div class="panel" role="dialog" aria-modal="true" aria-label={title} bind:this={panel}>
    <h2>{title}</h2>
    <p>{body}</p>
    <div class="buttons">
      {#each choices as choice (choice.id)}
        <button class={choice.tone ?? 'plain'} onclick={() => onchoose(choice.id)}>
          {choice.label}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.42);
  }

  .panel {
    width: min(420px, calc(100% - 48px));
    padding: 20px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow);
  }

  h2 {
    margin: 0 0 8px;
    font-size: 1.1em;
    font-weight: 600;
  }

  p {
    margin: 0 0 20px;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .buttons button {
    padding: 7px 16px;
    border-radius: var(--radius);
    border: 1px solid var(--border-strong);
  }

  .buttons .primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-contrast);
  }

  .buttons .danger {
    color: var(--danger);
  }

  .buttons button:hover {
    filter: brightness(1.08);
  }

  .buttons .plain:hover,
  .buttons .danger:hover {
    background: var(--bg-hover);
  }
</style>
