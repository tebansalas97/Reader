export type ErrorKind = 'NotFound' | 'PermissionDenied' | 'NotUtf8' | 'Io' | 'InvalidPath';
export type LineEnding = 'lf' | 'crlf';

export interface TextFile {
  text: string;
  modifiedMs: number;
  lineEnding: LineEnding;
}

export interface Entry {
  name: string;
  path: string;
  is_dir: boolean;
  children?: Entry[];
}

export interface RecentItem {
  path: string;
  openedMs: number;
}

export class ReaderError extends Error {
  kind: ErrorKind;
  path?: string;

  constructor(kind: ErrorKind, message: string, path?: string) {
    super(message);
    this.name = 'ReaderError';
    this.kind = kind;
    this.path = path;
  }
}

export function toReaderError(raw: unknown): ReaderError {
  if (raw && typeof raw === 'object' && 'kind' in raw) {
    const e = raw as { kind: ErrorKind; message: string; path?: string };
    return new ReaderError(e.kind, e.message, e.path);
  }
  if (raw instanceof Error) return new ReaderError('Io', raw.message);
  return new ReaderError('Io', String(raw));
}
