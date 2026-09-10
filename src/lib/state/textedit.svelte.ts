import { readBytesRaw } from '$lib/fs/api';
import type { PageText, TextEdit } from '$lib/pdf/edit/document';
import { buildReplacement, type EditOutcome } from '$lib/pdf/edit/replace';
import { originOf, type TextRun } from '$lib/pdf/edit/runs';

export interface RunAt {
  run: TextRun;
  text: string;
  page: number;
}

class TextEditSession {
  ready = $state(false);
  loading = $state(false);
  failed = $state(false);

  private docId: string | null = null;
  private document: import('pdf-lib').PDFDocument | null = null;
  private pages = new Map<number, PageText>();

  async open(id: string, path: string): Promise<void> {
    if (this.docId === id && (this.ready || this.loading)) return;
    this.close();
    this.docId = id;
    this.loading = true;

    try {
      const bytes = await readBytesRaw(path);
      const { loadForWriting } = await import('$lib/pdf/annotations/write');
      this.document = await loadForWriting(bytes);
      this.ready = true;
    } catch {
      this.failed = true;
    } finally {
      this.loading = false;
    }
  }

  close(): void {
    this.docId = null;
    this.document = null;
    this.pages.clear();
    this.ready = false;
    this.failed = false;
  }

  async pageText(page: number): Promise<PageText | null> {
    const document = this.document;
    if (!document) return null;
    const known = this.pages.get(page);
    if (known) return known;

    const { readPageText } = await import('$lib/pdf/edit/document');
    const text = await readPageText(document, page);
    if (text) this.pages.set(page, text);
    return text;
  }

  async runAt(page: number, x: number, y: number): Promise<RunAt | null> {
    const text = await this.pageText(page);
    if (!text) return null;

    let best: TextRun | null = null;
    let closest = Number.POSITIVE_INFINITY;
    for (const run of text.runs) {
      const origin = originOf(run);
      const distance = Math.hypot(origin.x - x, origin.y - y);
      if (distance > 2 || distance >= closest) continue;
      closest = distance;
      best = run;
    }

    if (!best) return null;
    const font = text.fonts.get(best.font);
    return { run: best, page, text: font ? font.toUnicode(best.bytes) : best.bytes };
  }

  async check(page: number, run: TextRun, value: string): Promise<EditOutcome> {
    const text = await this.pageText(page);
    const font = text?.fonts.get(run.font) ?? null;
    return buildReplacement(run, value, font);
  }
}

export const textEdits = new TextEditSession();

export function editFor(page: number, run: TextRun, oldText: string, newText: string): TextEdit {
  const origin = originOf(run);
  return {
    id: `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    page,
    x: origin.x,
    y: origin.y,
    width: run.advance,
    height: run.size,
    oldText,
    newText,
  };
}
