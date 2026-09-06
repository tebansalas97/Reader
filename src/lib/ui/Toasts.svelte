<script lang="ts">
  import { toasts } from '$lib/state/toasts.svelte';
</script>

<div class="toasts">
  {#each toasts.list as toast (toast.id)}
    <div class="toast" class:error={toast.level === 'error'} role="status">
      <span>{toast.message}</span>
      <button aria-label="Cerrar" onclick={() => toasts.dismiss(toast.id)}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M0 0l10 10M10 0L0 10" stroke="currentColor" stroke-width="1.4" />
        </svg>
      </button>
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    right: 16px;
    bottom: calc(var(--statusbar-height) + 16px);
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 380px;
  }

  .toast {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    line-height: 1.45;
  }

  .toast.error {
    border-left-color: var(--danger);
  }

  .toast button {
    color: var(--text-faint);
    flex-shrink: 0;
    padding: 2px;
  }

  .toast button:hover {
    color: var(--text);
  }
</style>
