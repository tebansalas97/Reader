import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const SPLITTER_WARNINGS = new Set([
  'a11y_no_noninteractive_tabindex',
  'a11y_no_noninteractive_element_interactions',
]);

export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    runes: true,
    warningFilter: (warning) => !SPLITTER_WARNINGS.has(warning.code),
  },
};
