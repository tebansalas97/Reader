<script lang="ts">
  import { t } from '$lib/i18n';
  import { openExternal } from '$lib/fs/api';

  interface Props {
    version: string;
    onclose: () => void;
  }

  const { version, onclose }: Props = $props();

  const REPOSITORY = 'https://github.com/estebansalas/reader';

  const PARTS = [
    { name: 'pdf.js', license: 'Apache-2.0' },
    { name: 'pdf-lib', license: 'MIT' },
    { name: 'Svelte', license: 'MIT' },
    { name: 'Tauri', license: 'MIT o Apache-2.0' },
    { name: 'CodeMirror', license: 'MIT' },
    { name: 'markdown-it', license: 'MIT' },
    { name: 'KaTeX', license: 'MIT' },
    { name: 'Mermaid', license: 'MIT' },
    { name: 'highlight.js', license: 'BSD-3-Clause' },
    { name: 'DOMPurify', license: 'Apache-2.0' },
    { name: 'nspell', license: 'MIT' },
    { name: 'dictionary-es', license: 'MPL-1.1' },
    { name: 'dictionary-en', license: 'MIT y BSD' },
  ];
</script>

<div class="backdrop" role="presentation" onclick={onclose}></div>

<div class="about" role="dialog" aria-label={t('about.title')} tabindex="-1">
  <h2>Reader {version}</h2>
  <p class="author">{t('about.by')} Esteban D. Salas Herrera</p>

  <p class="licence">
    {t('about.licence')}
    <button class="link" onclick={() => void openExternal(`${REPOSITORY}/blob/main/LICENSE`)}>
      Apache License 2.0
    </button>
  </p>

  <p class="credit">{t('about.credit')}</p>

  <details>
    <summary>{t('about.parts')}</summary>
    <ul>
      {#each PARTS as part (part.name)}
        <li><span>{part.name}</span><span class="tag">{part.license}</span></li>
      {/each}
    </ul>
    <p class="full">{t('about.fullList')}</p>
  </details>

  <div class="row">
    <button class="link" onclick={() => void openExternal(REPOSITORY)}>{t('about.source')}</button>
    <button class="link" onclick={() => void openExternal(`${REPOSITORY}/releases`)}>
      {t('about.updates')}
    </button>
    <div class="grow"></div>
    <button class="text" onclick={onclose}>{t('about.close')}</button>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 60;
  }

  .about {
    position: fixed;
    z-index: 61;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 420px;
    max-height: 76vh;
    padding: 18px;
    overflow-y: auto;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
  }

  h2 {
    margin: 0;
    font-size: 1.2em;
  }

  p {
    margin: 0;
  }

  .author {
    color: var(--text);
  }

  .licence,
  .credit,
  .full {
    color: var(--text-muted);
  }

  .credit {
    padding: 8px 10px;
    background: var(--bg-inset);
    border-left: 2px solid var(--accent);
    border-radius: 4px;
  }

  details {
    color: var(--text-muted);
  }

  summary {
    cursor: pointer;
    padding: 4px 0;
  }

  ul {
    margin: 6px 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  li {
    display: flex;
    gap: 8px;
  }

  li span:first-child {
    flex: 1;
    color: var(--text);
  }

  .tag {
    color: var(--text-faint);
  }

  .full {
    font-size: 0.92em;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 4px;
  }

  .grow {
    flex: 1;
  }

  .link {
    color: var(--accent);
    text-decoration: underline;
  }

  .text {
    height: 28px;
    padding: 0 12px;
    border-radius: 6px;
    background: var(--accent-soft);
    color: var(--accent);
  }
</style>
