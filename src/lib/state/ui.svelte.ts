import type { AnnotationKind } from '$lib/pdf/annotations/model';
import { prefs } from './prefs.svelte';

export type ViewMode = 'editor' | 'split' | 'preview';
export type AnnotationTool = 'none' | AnnotationKind | 'signature' | 'text' | 'redact';
export type SidebarPanel =
  | 'files'
  | 'outline'
  | 'search'
  | 'history'
  | 'pages'
  | 'marks'
  | null;

const ORDER: ViewMode[] = ['editor', 'split', 'preview'];

class UiStore {
  viewMode = $state<ViewMode>('split');
  sidebar = $state<SidebarPanel>(null);
  sidebarWidth = $state(250);
  zen = $state(false);
  splitRatio = $state(0.5);
  settingsOpen = $state(false);
  aboutOpen = $state(false);
  paletteOpen = $state(false);
  folder = $state<string | null>(null);
  scrollSync = $state(true);
  showToolbar = $state(true);
  diagram = $state<string | null>(null);
  historyStamp = $state(0);
  spellState = $state<'off' | 'loading' | 'ready' | 'failed'>('off');
  snapshotPreview = $state<{ text: string; label: string } | null>(null);
  annotationTool = $state<AnnotationTool>('none');
  selection = $state<string[]>([]);
  selectedPages = $state<number[]>([]);
  signatureOpen = $state(false);
  editingText = $state(false);

  get selectedAnnotation(): string | null {
    return this.selection.length === 1 ? this.selection[0]! : null;
  }

  set selectedAnnotation(id: string | null) {
    this.selection = id === null ? [] : [id];
  }

  cycleViewMode(): void {
    const index = ORDER.indexOf(this.viewMode);
    this.viewMode = ORDER[(index + 1) % ORDER.length]!;
  }

  useSidebar(panel: SidebarPanel): void {
    this.sidebar = panel;
    prefs.update({ sidebarPanel: panel });
  }

  toggleSidebar(panel: Exclude<SidebarPanel, null>): void {
    this.useSidebar(this.sidebar === panel ? null : panel);
  }

  toggleZen(): void {
    this.zen = !this.zen;
  }

  toggleScrollSync(): void {
    this.scrollSync = !this.scrollSync;
  }

  useTool(tool: AnnotationTool): void {
    this.annotationTool = this.annotationTool === tool ? 'none' : tool;
    if (this.annotationTool !== 'none') this.selection = [];
  }

  toggleToolbar(): void {
    this.showToolbar = !this.showToolbar;
  }
}

export const ui = new UiStore();
