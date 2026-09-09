import type { AnnotationKind } from '$lib/pdf/annotations/model';

export type ViewMode = 'editor' | 'split' | 'preview';
export type AnnotationTool = 'none' | AnnotationKind;
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
  paletteOpen = $state(false);
  folder = $state<string | null>(null);
  scrollSync = $state(true);
  showToolbar = $state(true);
  diagram = $state<string | null>(null);
  historyStamp = $state(0);
  spellState = $state<'off' | 'loading' | 'ready' | 'failed'>('off');
  snapshotPreview = $state<{ text: string; label: string } | null>(null);
  annotationTool = $state<AnnotationTool>('none');
  selectedAnnotation = $state<string | null>(null);
  selectedPages = $state<number[]>([]);

  cycleViewMode(): void {
    const index = ORDER.indexOf(this.viewMode);
    this.viewMode = ORDER[(index + 1) % ORDER.length]!;
  }

  toggleSidebar(panel: Exclude<SidebarPanel, null>): void {
    this.sidebar = this.sidebar === panel ? null : panel;
  }

  toggleZen(): void {
    this.zen = !this.zen;
  }

  toggleScrollSync(): void {
    this.scrollSync = !this.scrollSync;
  }

  useTool(tool: AnnotationTool): void {
    this.annotationTool = this.annotationTool === tool ? 'none' : tool;
    if (this.annotationTool !== 'none') this.selectedAnnotation = null;
  }

  toggleToolbar(): void {
    this.showToolbar = !this.showToolbar;
  }
}

export const ui = new UiStore();
