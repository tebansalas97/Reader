import { describe, expect, it } from 'vitest';
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  isExternalUrl,
  isMarkdown,
  join,
  resolveRelative,
  titleFromPath,
} from './paths';

describe('dirname', () => {
  it('returns the parent of a windows path', () => {
    expect(dirname('C:\\docs\\a.md')).toBe('C:/docs');
  });

  it('returns the parent of a posix path', () => {
    expect(dirname('/home/e/a.md')).toBe('/home/e');
  });

  it('returns empty string when there is no parent', () => {
    expect(dirname('a.md')).toBe('');
  });
});

describe('basename and extname', () => {
  it('extracts the file name', () => {
    expect(basename('C:/docs/a.md')).toBe('a.md');
  });

  it('lowercases the extension without the dot', () => {
    expect(extname('C:/docs/A.MD')).toBe('md');
  });

  it('returns empty extension when there is none', () => {
    expect(extname('C:/docs/LICENSE')).toBe('');
  });
});

describe('join', () => {
  it('joins with forward slashes and collapses duplicates', () => {
    expect(join('C:/docs/', '/assets', 'a.png')).toBe('C:/docs/assets/a.png');
  });

  it('ignores empty parts', () => {
    expect(join('C:/docs', '', 'a.png')).toBe('C:/docs/a.png');
  });
});

describe('isMarkdown', () => {
  it('accepts md and markdown', () => {
    expect(isMarkdown('a.md')).toBe(true);
    expect(isMarkdown('a.MARKDOWN')).toBe(true);
  });

  it('rejects other extensions', () => {
    expect(isMarkdown('a.txt')).toBe(false);
  });
});

describe('titleFromPath', () => {
  it('uses the file name', () => {
    expect(titleFromPath('C:/docs/mi nota.md')).toBe('mi nota.md');
  });

  it('falls back for unsaved documents', () => {
    expect(titleFromPath(null)).toBe('Sin título');
  });
});

describe('resolveRelative', () => {
  it('resolves a sibling file', () => {
    expect(resolveRelative('C:/docs/a.md', 'img/x.png')).toBe('C:/docs/img/x.png');
  });

  it('resolves a parent segment', () => {
    expect(resolveRelative('C:/docs/sub/a.md', '../img/x.png')).toBe('C:/docs/img/x.png');
  });

  it('collapses current-directory segments', () => {
    expect(resolveRelative('C:/docs/a.md', './x.png')).toBe('C:/docs/x.png');
  });

  it('returns absolute paths untouched', () => {
    expect(resolveRelative('C:/docs/a.md', 'D:/other/x.png')).toBe('D:/other/x.png');
  });

  it('decodes percent-encoded spaces', () => {
    expect(resolveRelative('C:/docs/a.md', 'mi%20imagen.png')).toBe('C:/docs/mi imagen.png');
  });
});

describe('isExternalUrl', () => {
  it('detects http, https and mailto', () => {
    expect(isExternalUrl('https://a.com')).toBe(true);
    expect(isExternalUrl('mailto:a@b.com')).toBe(true);
  });

  it('treats relative paths as internal', () => {
    expect(isExternalUrl('./a.md')).toBe(false);
  });
});

describe('isAbsolute', () => {
  it('detects drive letters and unc and posix roots', () => {
    expect(isAbsolute('C:/a')).toBe(true);
    expect(isAbsolute('//server/share')).toBe(true);
    expect(isAbsolute('/home')).toBe(true);
    expect(isAbsolute('a/b')).toBe(false);
  });
});
