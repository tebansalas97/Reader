import type * as PdfjsModule from 'pdfjs-dist';

export type Pdfjs = typeof PdfjsModule;

const BASE = import.meta.env.BASE_URL ?? '/';

let pending: Promise<Pdfjs> | null = null;
let loaded: Pdfjs | null = null;

export function workerUrl(): string {
  return `${BASE}pdf/pdf.worker.min.mjs`.replace(/\/{2,}/g, '/');
}

export async function loadPdfjs(): Promise<Pdfjs> {
  if (loaded) return loaded;
  if (!pending) {
    pending = import('pdfjs-dist').then((module) => {
      module.GlobalWorkerOptions.workerSrc = workerUrl();
      return module;
    });
  }
  loaded = await pending;
  pending = null;
  return loaded;
}

export function pdfjsReady(): boolean {
  return loaded !== null;
}

export function resetPdfjs(): void {
  loaded = null;
  pending = null;
}

let pdfLib: Promise<typeof import('pdf-lib')> | null = null;

export function loadPdfLib(): Promise<typeof import('pdf-lib')> {
  if (!pdfLib) pdfLib = import('pdf-lib');
  return pdfLib;
}
