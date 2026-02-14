import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sanitizeFilename, extractFilenameFromHeader, downloadBlob } from './download';

describe('sanitizeFilename', () => {
  it('should remove invalid characters', () => {
    const result = sanitizeFilename('my<game>:file/name\\test|?*.yaml');
    expect(result).toBe('mygamefilenametest.yaml');
  });

  it('should limit length to maxLength', () => {
    const longName = 'a'.repeat(150);
    const result = sanitizeFilename(longName, 100);
    expect(result).toHaveLength(100);
  });

  it('should remove control characters', () => {
    const result = sanitizeFilename('game\x00\x01\x1Fname.yaml');
    expect(result).toBe('gamename.yaml');
  });

  it('should handle already clean filenames', () => {
    const result = sanitizeFilename('my-game-export.yaml');
    expect(result).toBe('my-game-export.yaml');
  });
});

describe('extractFilenameFromHeader', () => {
  it('should extract quoted filename', () => {
    const result = extractFilenameFromHeader('attachment; filename="my-game.yaml"');
    expect(result).toBe('my-game.yaml');
  });

  it('should extract unquoted filename', () => {
    const result = extractFilenameFromHeader('attachment; filename=my-game.yaml');
    expect(result).toBe('my-game.yaml');
  });

  it('should return null for empty header', () => {
    const result = extractFilenameFromHeader('');
    expect(result).toBeNull();
  });

  it('should return null for header without filename', () => {
    const result = extractFilenameFromHeader('attachment');
    expect(result).toBeNull();
  });

  it('should trim whitespace', () => {
    const result = extractFilenameFromHeader('filename=" my-game.yaml "');
    expect(result).toBe('my-game.yaml');
  });

  it('should handle unquoted filename with semicolon separator', () => {
    const result = extractFilenameFromHeader('attachment; filename=foo.yaml; size=123');
    expect(result).toBe('foo.yaml');
  });

  it('should handle unquoted filename at end of header', () => {
    const result = extractFilenameFromHeader('attachment; filename=my-game.yaml');
    expect(result).toBe('my-game.yaml');
  });
});

describe('downloadBlob', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let appendChildSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let removeChildSpy: any;

  beforeEach(() => {
    vi.useFakeTimers();
    // Use spies instead of direct assignment
    appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    // Mock URL methods on globalThis
    if (!globalThis.URL.createObjectURL) {
      globalThis.URL.createObjectURL = vi.fn();
    }
    if (!globalThis.URL.revokeObjectURL) {
      globalThis.URL.revokeObjectURL = vi.fn();
    }
    vi.spyOn(globalThis.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(globalThis.URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should create download link with default filename', () => {
    const blob = new Blob(['test'], { type: 'text/yaml' });
    downloadBlob(blob, 'my-game-export.yaml');

    expect(appendChildSpy).toHaveBeenCalled();
    const link = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(link.download).toBe('my-game-export.yaml');
    expect(link.href).toBe('blob:mock-url');
  });

  it('should use filename from Content-Disposition header', () => {
    const blob = new Blob(['test'], { type: 'text/yaml' });
    downloadBlob(blob, 'default.yaml', 'attachment; filename="server-name.yaml"');

    const link = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(link.download).toBe('server-name.yaml');
  });

  it('should sanitize filename from Content-Disposition header', () => {
    const blob = new Blob(['test'], { type: 'text/yaml' });
    downloadBlob(blob, 'default.yaml', 'attachment; filename="my<bad>:name.yaml"');

    const link = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(link.download).toBe('mybadname.yaml');
  });

  it('should sanitize default filename with invalid characters', () => {
    const blob = new Blob(['test'], { type: 'text/yaml' });
    downloadBlob(blob, 'my<game>:file*.yaml');

    const link = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(link.download).toBe('mygamefile.yaml');
  });

  it('should click the link to trigger download', () => {
    const blob = new Blob(['test'], { type: 'text/yaml' });
    const clickSpy = vi.fn();

    // Temporarily override the spy to add click spy
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    appendChildSpy.mockImplementationOnce((node: any) => {
      if (node instanceof HTMLAnchorElement) {
        node.click = clickSpy;
      }
      return node;
    });

    downloadBlob(blob, 'test.yaml');
    expect(clickSpy).toHaveBeenCalled();
  });

  it('should cleanup after 100ms timeout', () => {
    const blob = new Blob(['test'], { type: 'text/yaml' });
    downloadBlob(blob, 'test.yaml');

    // Should not cleanup immediately
    expect(removeChildSpy).not.toHaveBeenCalled();
    expect(globalThis.URL.revokeObjectURL).not.toHaveBeenCalled();

    // Fast-forward time
    vi.advanceTimersByTime(100);

    // Should cleanup after timeout
    expect(removeChildSpy).toHaveBeenCalled();
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
