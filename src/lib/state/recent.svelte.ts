import { clearRecent, getRecent } from '$lib/fs/api';
import type { RecentItem } from '$lib/fs/api-types';

class RecentStore {
  list = $state<RecentItem[]>([]);

  async load(): Promise<void> {
    this.list = await getRecent().catch(() => []);
  }

  async clear(): Promise<void> {
    await clearRecent().catch(() => undefined);
    this.list = [];
  }

  set(items: RecentItem[]): void {
    this.list = items;
  }
}

export const recent = new RecentStore();
