import { loadPdfjs } from './load';

export interface PageSize {
  width: number;
  height: number;
  rotation: number;
  offsetX?: number;
  offsetY?: number;
}

export interface OutlineEntry {
  title: string;
  page: number | null;
  depth: number;
}

export interface PdfHandle {
  pageCount: number;
  pageSizes: PageSize[];
  encrypted: boolean;
  outline(): Promise<OutlineEntry[]>;
  page(index: number): Promise<import('pdfjs-dist').PDFPageProxy>;
  hideFromCanvas(refs: string[]): void;
  destroy(): Promise<void>;
}

export class PdfOpenError extends Error {
  reason: 'password' | 'corrupt' | 'missing' | 'unknown';

  constructor(reason: PdfOpenError['reason'], message: string) {
    super(message);
    this.name = 'PdfOpenError';
    this.reason = reason;
  }
}

function classify(error: unknown): PdfOpenError {
  const name = (error as { name?: string })?.name ?? '';
  const message = error instanceof Error ? error.message : String(error);
  if (name === 'PasswordException') return new PdfOpenError('password', message);
  if (name === 'InvalidPDFException') return new PdfOpenError('corrupt', message);
  if (name === 'MissingPDFException') return new PdfOpenError('missing', message);
  return new PdfOpenError('unknown', message);
}

interface RawOutlineNode {
  title: string;
  dest: unknown;
  items?: RawOutlineNode[];
}

async function flattenOutline(
  document: import('pdfjs-dist').PDFDocumentProxy,
  nodes: RawOutlineNode[],
  depth: number,
  into: OutlineEntry[],
): Promise<void> {
  for (const node of nodes) {
    let page: number | null = null;
    try {
      const destination =
        typeof node.dest === 'string' ? await document.getDestination(node.dest) : node.dest;
      const reference = Array.isArray(destination) ? destination[0] : null;
      if (reference) page = (await document.getPageIndex(reference)) + 1;
    } catch {
      page = null;
    }
    into.push({ title: node.title.trim(), page, depth });
    if (node.items && node.items.length > 0) {
      await flattenOutline(document, node.items, depth + 1, into);
    }
  }
}

export function sizeOf(page: import('pdfjs-dist').PDFPageProxy): PageSize {
  const view = Array.isArray(page.view) ? (page.view as number[]) : [];
  const upright = page.getViewport({ scale: 1, rotation: 0 });
  const x0 = view.length >= 4 ? Math.min(view[0]!, view[2]!) : 0;
  const y0 = view.length >= 4 ? Math.min(view[1]!, view[3]!) : 0;
  return {
    width: upright.width,
    height: upright.height,
    rotation: page.rotate,
    offsetX: x0,
    offsetY: y0,
  };
}

export interface OpenPdfOptions {
  password?: string;
}

export async function openPdfDocument(
  source: string | Uint8Array,
  options: OpenPdfOptions = {},
): Promise<PdfHandle> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    ...(typeof source === 'string' ? { url: source } : { data: source.slice() }),
    password: options.password,
    isEvalSupported: false,
    enableXfa: false,
  });

  let document: import('pdfjs-dist').PDFDocumentProxy;
  try {
    document = await task.promise;
  } catch (error) {
    throw classify(error);
  }

  const pageCount = document.numPages;
  const pageSizes: PageSize[] = [];
  for (let index = 1; index <= pageCount; index += 1) {
    const page = await document.getPage(index);
    pageSizes.push(sizeOf(page));
  }

  const permissions = await document.getPermissions().catch(() => null);

  return {
    pageCount,
    pageSizes,
    encrypted: permissions !== null,
    async outline() {
      const raw = (await document.getOutline().catch(() => null)) as RawOutlineNode[] | null;
      if (!raw || raw.length === 0) return [];
      const entries: OutlineEntry[] = [];
      await flattenOutline(document, raw, 0, entries);
      return entries;
    },
    page(index: number) {
      return document.getPage(Math.min(Math.max(1, index), pageCount));
    },
    hideFromCanvas(refs: string[]) {
      for (const ref of refs) document.annotationStorage.setValue(ref, { noView: true });
    },
    async destroy() {
      await document.destroy();
    },
  };
}

export function heightsForWidth(sizes: PageSize[], width: number): number[] {
  return sizes.map((size) => (size.width === 0 ? 0 : (size.height / size.width) * width));
}
