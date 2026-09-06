export type ViewMode = 'editor' | 'split' | 'preview';
export type SidebarPanel = 'files' | 'outline' | null;

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

  toggleToolbar(): void {
    this.showToolbar = !this.showToolbar;
  }
}

export const ui = new UiStore();
