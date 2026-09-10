import { getStamps, setStamps } from '$lib/fs/api';

export type StampKind = 'draw' | 'image';

export interface StampItem {
  id: string;
  name: string;
  kind: StampKind;
  strokes: string;
  image: string;
  ratio: number;
}

const MAX_ITEMS = 24;

export function cleanItem(value: unknown): StampItem | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const kind = raw.kind === 'image' ? 'image' : 'draw';
  const id = typeof raw.id === 'string' && raw.id !== '' ? raw.id : '';
  if (id === '') return null;

  const strokes = typeof raw.strokes === 'string' ? raw.strokes : '';
  const image = typeof raw.image === 'string' ? raw.image : '';
  if (kind === 'draw' && strokes === '') return null;
  if (kind === 'image' && !image.startsWith('data:image/')) return null;

  const ratio = typeof raw.ratio === 'number' && Number.isFinite(raw.ratio) ? raw.ratio : 0.35;
  return {
    id,
    name: typeof raw.name === 'string' ? raw.name.slice(0, 40) : '',
    kind,
    strokes,
    image,
    ratio: Math.min(8, Math.max(0.02, ratio)),
  };
}

export function cleanItems(value: unknown): StampItem[] {
  if (!Array.isArray(value)) return [];
  const items: StampItem[] = [];
  for (const entry of value) {
    const item = cleanItem(entry);
    if (item) items.push(item);
  }
  return items.slice(0, MAX_ITEMS);
}

export function newStampId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

class StampStore {
  items = $state<StampItem[]>([]);
  active = $state<string | null>(null);

  async load(): Promise<void> {
    const stored = await getStamps<unknown>().catch(() => []);
    this.items = cleanItems(stored);
  }

  add(item: StampItem): void {
    this.items = [item, ...this.items].slice(0, MAX_ITEMS);
    this.active = item.id;
    this.save();
  }

  remove(id: string): void {
    this.items = this.items.filter((item) => item.id !== id);
    if (this.active === id) this.active = null;
    this.save();
  }

  rename(id: string, name: string): void {
    this.items = this.items.map((item) =>
      item.id === id ? { ...item, name: name.slice(0, 40) } : item,
    );
    this.save();
  }

  byId(id: string | null): StampItem | null {
    if (id === null) return null;
    return this.items.find((item) => item.id === id) ?? null;
  }

  private save(): void {
    void setStamps($state.snapshot(this.items)).catch(() => undefined);
  }
}

export const stamps = new StampStore();
