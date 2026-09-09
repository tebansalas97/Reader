import { exists, pushRecent, readText, unwatch, watch, writeText } from '$lib/fs/api';
import type { LineEnding } from '$lib/fs/api-types';
import { extname, normalise, titleFromPath } from '$lib/fs/paths';
import type { Annotation } from '$lib/pdf/annotations/model';
import {
  replaceAnnotation,
  sameAnnotations,
  withoutAnnotation,
} from '$lib/pdf/annotations/model';
import { initialPlan, planAfterSave, samePlan, type PageEdit } from '$lib/pdf/pages';

export const LARGE_FILE_BYTES = 20 * 1024 * 1024;

export type DocumentKind = 'markdown' | 'pdf';

interface BaseDocument {
  id: string;
  path: string | null;
  title: string;
  modifiedMs: number;
  readOnly: boolean;
  externalChange: 'none' | 'modified' | 'removed';
}

export interface MarkdownDocument extends BaseDocument {
  kind: 'markdown';
  text: string;
  savedText: string;
  lineEnding: LineEnding;
  previewDisabled: boolean;
  cursor: { line: number; col: number };
  scrollLine: number;
}

export interface PdfDocument extends BaseDocument {
  kind: 'pdf';
  assetUrl: string;
  pageCount: number;
  page: number;
  zoom: number | 'fit-width' | 'fit-page';
  rotation: 0 | 90 | 180 | 270;
  annotations: Annotation[];
  savedAnnotations: Annotation[];
  pages: PageEdit[];
  savedPages: PageEdit[];
  encrypted: boolean;
}

export type Document = MarkdownDocument | PdfDocument;

export type SaveResult = 'saved' | 'needs-path' | 'unchanged';

export function isMarkdown(doc: Document | null): doc is MarkdownDocument {
  return doc !== null && doc.kind === 'markdown';
}

export function isPdf(doc: Document | null): doc is PdfDocument {
  return doc !== null && doc.kind === 'pdf';
}

export function documentIsDirty(doc: Document): boolean {
  if (doc.kind === 'markdown') return doc.text !== doc.savedText;
  if (!samePlan(doc.pages, doc.savedPages)) return true;
  return !sameAnnotations(doc.annotations, doc.savedAnnotations);
}

let counter = 0;

function nextId(): string {
  counter += 1;
  return `doc-${counter}`;
}

function blankMarkdown(path: string | null, text = ''): MarkdownDocument {
  return {
    kind: 'markdown',
    id: nextId(),
    path,
    title: titleFromPath(path),
    text,
    savedText: text,
    lineEnding: 'lf',
    modifiedMs: 0,
    readOnly: false,
    previewDisabled: false,
    externalChange: 'none',
    cursor: { line: 1, col: 1 },
    scrollLine: 0,
  };
}

export interface PdfOpenInfo {
  assetUrl: string;
  pageCount: number;
  annotations: Annotation[];
  encrypted: boolean;
}

function blankPdf(path: string, info: PdfOpenInfo): PdfDocument {
  return {
    kind: 'pdf',
    id: nextId(),
    path,
    title: titleFromPath(path),
    modifiedMs: 0,
    readOnly: info.encrypted,
    externalChange: 'none',
    assetUrl: info.assetUrl,
    pageCount: info.pageCount,
    page: 1,
    zoom: 'fit-width',
    rotation: 0,
    annotations: info.annotations,
    savedAnnotations: info.annotations.map((a) => ({ ...a })),
    pages: initialPlan(info.pageCount),
    savedPages: initialPlan(info.pageCount),
    encrypted: info.encrypted,
  };
}

class DocumentsStore {
  list = $state<Document[]>([]);
  activeId = $state<string | null>(null);

  get active(): Document | null {
    return this.list.find((d) => d.id === this.activeId) ?? null;
  }

  get activeMarkdown(): MarkdownDocument | null {
    const doc = this.active;
    return isMarkdown(doc) ? doc : null;
  }

  get activePdf(): PdfDocument | null {
    const doc = this.active;
    return isPdf(doc) ? doc : null;
  }

  byId(id: string): Document | null {
    return this.list.find((d) => d.id === id) ?? null;
  }

  markdownById(id: string): MarkdownDocument | null {
    const doc = this.byId(id);
    return isMarkdown(doc) ? doc : null;
  }

  pdfById(id: string): PdfDocument | null {
    const doc = this.byId(id);
    return isPdf(doc) ? doc : null;
  }

  isDirty(id: string): boolean {
    const doc = this.byId(id);
    return doc !== null && documentIsDirty(doc);
  }

  get dirtyDocuments(): Document[] {
    return this.list.filter(documentIsDirty);
  }

  reset(): void {
    this.list = [];
    this.activeId = null;
  }

  findByPath(path: string): Document | null {
    const key = normalise(path).toLowerCase();
    return (
      this.list.find((d) => d.path !== null && normalise(d.path).toLowerCase() === key) ?? null
    );
  }

  private focusExisting(path: string): string | null {
    const existing = this.findByPath(path);
    if (!existing) return null;
    this.activeId = existing.id;
    return existing.id;
  }

  async open(path: string): Promise<string> {
    return this.openMarkdown(path);
  }

  async openMarkdown(path: string): Promise<string> {
    const focused = this.focusExisting(path);
    if (focused !== null) return focused;
    const file = await readText(path);
    const doc = blankMarkdown(normalise(path), file.text);
    doc.lineEnding = file.lineEnding;
    doc.modifiedMs = file.modifiedMs;
    doc.previewDisabled = file.text.length > LARGE_FILE_BYTES;
    this.list = [...this.list, doc];
    this.activeId = doc.id;
    void watch(doc.path!).catch(() => undefined);
    void pushRecent(doc.path!).catch(() => undefined);
    return doc.id;
  }

  openPdf(path: string, info: PdfOpenInfo): string {
    const focused = this.focusExisting(path);
    if (focused !== null) return focused;
    const doc = blankPdf(normalise(path), info);
    this.list = [...this.list, doc];
    this.activeId = doc.id;
    void watch(doc.path!).catch(() => undefined);
    void pushRecent(doc.path!).catch(() => undefined);
    return doc.id;
  }

  create(): string {
    const doc = blankMarkdown(null);
    this.list = [...this.list, doc];
    this.activeId = doc.id;
    return doc.id;
  }

  setText(id: string, text: string): void {
    const doc = this.markdownById(id);
    if (doc) doc.text = text;
  }

  setCursor(id: string, line: number, col: number): void {
    const doc = this.markdownById(id);
    if (doc) doc.cursor = { line, col };
  }

  setScrollLine(id: string, line: number): void {
    const doc = this.markdownById(id);
    if (doc) doc.scrollLine = line;
  }

  setLineEnding(id: string, lineEnding: LineEnding): void {
    const doc = this.markdownById(id);
    if (!doc || doc.lineEnding === lineEnding) return;
    doc.lineEnding = lineEnding;
    doc.savedText = `${doc.text} `;
  }

  setPage(id: string, page: number): void {
    const doc = this.pdfById(id);
    if (!doc) return;
    doc.page = Math.min(Math.max(1, page), doc.pageCount);
  }

  setZoom(id: string, zoom: PdfDocument['zoom']): void {
    const doc = this.pdfById(id);
    if (doc) doc.zoom = zoom;
  }

  setRotation(id: string, rotation: PdfDocument['rotation']): void {
    const doc = this.pdfById(id);
    if (doc) doc.rotation = rotation;
  }

  setPages(id: string, pages: PageEdit[]): void {
    const doc = this.pdfById(id);
    if (!doc) return;
    doc.pages = pages;
    doc.page = Math.min(Math.max(1, doc.page), Math.max(1, pages.length));
  }

  setAnnotations(id: string, annotations: Annotation[]): void {
    const doc = this.pdfById(id);
    if (doc) doc.annotations = annotations;
  }

  loadAnnotations(id: string, annotations: Annotation[]): void {
    const doc = this.pdfById(id);
    if (!doc) return;
    doc.annotations = annotations;
    doc.savedAnnotations = annotations.map((a) => ({ ...a }));
  }

  addAnnotation(id: string, annotation: Annotation): void {
    const doc = this.pdfById(id);
    if (doc) doc.annotations = [...doc.annotations, annotation];
  }

  updateAnnotation(id: string, annotation: Annotation): void {
    const doc = this.pdfById(id);
    if (doc) doc.annotations = replaceAnnotation(doc.annotations, annotation);
  }

  removeAnnotation(id: string, annotationId: string): void {
    const doc = this.pdfById(id);
    if (doc) doc.annotations = withoutAnnotation(doc.annotations, annotationId);
  }

  markPdfSaved(id: string, modifiedMs: number): void {
    const doc = this.pdfById(id);
    if (!doc) return;
    doc.savedAnnotations = doc.annotations.map((a) => ({ ...a }));
    doc.pages = planAfterSave(doc.pages);
    doc.savedPages = doc.pages.map((entry) => ({ ...entry }));
    doc.pageCount = doc.pages.length;
    doc.page = Math.min(Math.max(1, doc.page), Math.max(1, doc.pageCount));
    doc.modifiedMs = modifiedMs;
    doc.externalChange = 'none';
  }

  async save(id: string): Promise<SaveResult> {
    const doc = this.markdownById(id);
    if (!doc) return 'unchanged';
    if (doc.path === null) return 'needs-path';
    if (doc.text === doc.savedText) return 'unchanged';
    doc.modifiedMs = await writeText(doc.path, doc.text, doc.lineEnding);
    doc.savedText = doc.text;
    doc.externalChange = 'none';
    return 'saved';
  }

  attachPath(id: string, target: string, modifiedMs: number, assetUrl?: string): void {
    const doc = this.byId(id);
    if (!doc) return;
    const path = normalise(target);
    if (doc.kind === 'pdf' && assetUrl) doc.assetUrl = assetUrl;
    const previous = doc.path;
    doc.path = path;
    doc.title = titleFromPath(path);
    doc.modifiedMs = modifiedMs;
    doc.externalChange = 'none';
    if (previous !== null && previous !== path) void unwatch(previous).catch(() => undefined);
    void watch(path).catch(() => undefined);
    void pushRecent(path).catch(() => undefined);
  }

  async saveAs(id: string, target: string): Promise<void> {
    const doc = this.markdownById(id);
    if (!doc) return;
    const path = normalise(target);
    const previous = doc.path;
    doc.modifiedMs = await writeText(path, doc.text, doc.lineEnding);
    doc.savedText = doc.text;
    doc.path = path;
    doc.title = titleFromPath(path);
    doc.externalChange = 'none';
    if (previous !== null && previous !== path) void unwatch(previous).catch(() => undefined);
    void watch(path).catch(() => undefined);
    void pushRecent(path).catch(() => undefined);
  }

  close(id: string): void {
    const index = this.list.findIndex((d) => d.id === id);
    if (index === -1) return;
    const doc = this.list[index]!;
    if (doc.path !== null && !this.list.some((d) => d.id !== id && d.path === doc.path)) {
      void unwatch(doc.path).catch(() => undefined);
    }
    this.list = this.list.filter((d) => d.id !== id);
    if (this.activeId !== id) return;
    const neighbour = this.list[Math.min(index, this.list.length - 1)];
    this.activeId = neighbour ? neighbour.id : null;
  }

  async markExternalChange(id: string, kind: 'modified' | 'removed'): Promise<void> {
    const doc = this.byId(id);
    if (!doc || doc.path === null) return;
    const gone = kind === 'removed' && !(await exists(doc.path).catch(() => true));
    if (gone) {
      void unwatch(doc.path).catch(() => undefined);
      doc.path = null;
      if (doc.kind === 'markdown') doc.savedText = `${doc.text} `;
      else doc.savedAnnotations = [...doc.annotations, { ...PHANTOM }];
      doc.externalChange = 'removed';
      return;
    }
    if (doc.kind === 'pdf') return;
    if (this.isDirty(id)) {
      doc.externalChange = 'modified';
      return;
    }
    await this.reload(id);
  }

  async reload(id: string): Promise<void> {
    const doc = this.markdownById(id);
    if (!doc || doc.path === null) return;
    const file = await readText(doc.path);
    doc.text = file.text;
    doc.savedText = file.text;
    doc.lineEnding = file.lineEnding;
    doc.modifiedMs = file.modifiedMs;
    doc.externalChange = 'none';
  }

  dismissExternalChange(id: string): void {
    const doc = this.byId(id);
    if (doc) doc.externalChange = 'none';
  }
}

const PHANTOM: Annotation = {
  id: 'removed-from-disk',
  page: 0,
  kind: 'note',
  color: '#000000',
  opacity: 1,
  contents: '',
  author: '',
  createdMs: 0,
  origin: 'reader',
};

export function kindForPath(path: string): DocumentKind {
  return extname(path) === 'pdf' ? 'pdf' : 'markdown';
}

export const documents = new DocumentsStore();
