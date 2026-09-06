<script lang="ts">
  import { setLanguage, t } from '$lib/i18n';
  import { prefs } from '$lib/state/prefs.svelte';
  import { ui } from '$lib/state/ui.svelte';

  interface Props {
    onclose: () => void;
  }

  const { onclose }: Props = $props();

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      onclose();
    }
  }
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="backdrop">
  <div class="panel" role="dialog" aria-modal="true" aria-label={t('settings.title')}>
    <header>
      <h2>{t('settings.title')}</h2>
      <button class="close" aria-label={t('settings.close')} onclick={onclose}>
        <svg width="12" height="12" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M0 0l10 10M10 0L0 10" stroke="currentColor" stroke-width="1.4" />
        </svg>
      </button>
    </header>

    <div class="body">
      <section>
        <h3>{t('settings.appearance')}</h3>
        <label>
          <span>{t('settings.theme')}</span>
          <select
            value={prefs.current.theme}
            onchange={(e) => prefs.update({ theme: e.currentTarget.value as 'system' })}
          >
            <option value="system">{t('settings.themeSystem')}</option>
            <option value="light">{t('settings.themeLight')}</option>
            <option value="dark">{t('settings.themeDark')}</option>
          </select>
        </label>
        <label>
          <span>{t('settings.language')}</span>
          <select
            value={prefs.current.language}
            onchange={(e) => {
              const language = e.currentTarget.value as 'es' | 'en';
              setLanguage(language);
              prefs.update({ language });
            }}
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </label>
      </section>

      <section>
        <h3>{t('settings.interface')}</h3>
        <label class="check">
          <input
            type="checkbox"
            checked={prefs.current.showToolbar}
            onchange={(e) => {
              ui.showToolbar = e.currentTarget.checked;
              prefs.update({ showToolbar: e.currentTarget.checked });
            }}
          />
          <span>{t('settings.showToolbar')}</span>
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={prefs.current.highlightActiveBlock}
            onchange={(e) => prefs.update({ highlightActiveBlock: e.currentTarget.checked })}
          />
          <span>{t('settings.highlightBlock')}</span>
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={prefs.current.scrollSync}
            onchange={(e) => {
              ui.scrollSync = e.currentTarget.checked;
              prefs.update({ scrollSync: e.currentTarget.checked });
            }}
          />
          <span>{t('settings.scrollSync')}</span>
        </label>
      </section>

      <section>
        <h3>{t('settings.editor')}</h3>
        <label>
          <span>{t('settings.fontSize')}</span>
          <input
            type="number"
            min="10"
            max="32"
            value={prefs.current.editorFontSize}
            onchange={(e) => prefs.update({ editorFontSize: Number(e.currentTarget.value) })}
          />
        </label>
        <label>
          <span>{t('settings.fontFamily')}</span>
          <input
            type="text"
            value={prefs.current.editorFont}
            onchange={(e) => prefs.update({ editorFont: e.currentTarget.value })}
          />
        </label>
        <label>
          <span>{t('settings.tabSize')}</span>
          <input
            type="number"
            min="1"
            max="8"
            value={prefs.current.tabSize}
            onchange={(e) => prefs.update({ tabSize: Number(e.currentTarget.value) })}
          />
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={prefs.current.wordWrap}
            onchange={(e) => prefs.update({ wordWrap: e.currentTarget.checked })}
          />
          <span>{t('settings.wordWrap')}</span>
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={prefs.current.lineNumbers}
            onchange={(e) => prefs.update({ lineNumbers: e.currentTarget.checked })}
          />
          <span>{t('settings.lineNumbers')}</span>
        </label>
      </section>

      <section>
        <h3>{t('settings.preview')}</h3>
        <label>
          <span>{t('settings.fontSize')}</span>
          <input
            type="number"
            min="12"
            max="32"
            value={prefs.current.previewFontSize}
            onchange={(e) => prefs.update({ previewFontSize: Number(e.currentTarget.value) })}
          />
        </label>
        <label>
          <span>{t('settings.fontFamily')}</span>
          <input
            type="text"
            value={prefs.current.previewFont}
            onchange={(e) => prefs.update({ previewFont: e.currentTarget.value })}
          />
        </label>
        <label>
          <span>{t('settings.readingWidth')}</span>
          <input
            type="number"
            min="480"
            max="1600"
            step="20"
            value={prefs.current.previewWidth}
            onchange={(e) => prefs.update({ previewWidth: Number(e.currentTarget.value) })}
          />
        </label>
      </section>

      <section>
        <h3>{t('settings.files')}</h3>
        <label>
          <span>{t('settings.autosave')}</span>
          <select
            value={prefs.current.autosave}
            onchange={(e) => prefs.update({ autosave: e.currentTarget.value as 'off' })}
          >
            <option value="off">{t('settings.autosaveOff')}</option>
            <option value="afterDelay">{t('settings.autosaveDelay')}</option>
            <option value="onFocusChange">{t('settings.autosaveFocus')}</option>
          </select>
        </label>
      </section>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 55;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.42);
  }

  .panel {
    width: min(520px, calc(100% - 48px));
    max-height: min(640px, calc(100% - 48px));
    display: flex;
    flex-direction: column;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
  }

  h2 {
    margin: 0;
    font-size: 1.05em;
    font-weight: 600;
  }

  .close {
    color: var(--text-muted);
    padding: 4px;
    border-radius: 4px;
  }

  .close:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .body {
    overflow-y: auto;
    padding: 6px 18px 18px;
  }

  section {
    padding: 14px 0;
    border-bottom: 1px solid var(--border);
  }

  section:last-child {
    border-bottom: none;
  }

  h3 {
    margin: 0 0 10px;
    font-size: 0.82em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
  }

  label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 5px 0;
  }

  label.check {
    justify-content: flex-start;
    gap: 8px;
  }

  input[type='text'],
  input[type='number'],
  select {
    padding: 5px 8px;
    background: var(--bg-inset);
    border: 1px solid var(--border);
    border-radius: 5px;
    min-width: 0;
  }

  input[type='text'] {
    flex: 1;
    max-width: 260px;
  }

  input[type='number'] {
    width: 80px;
  }

  input[type='checkbox'] {
    accent-color: var(--accent);
  }

  select {
    min-width: 150px;
  }
</style>
