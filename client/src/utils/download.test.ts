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

  it('should extract filename with single quotes', () => {
    const result = extractFilenameFromHeader("attachment; filename='my-game.yaml'");
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
});

describe('downloadBlob', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock DOM methods
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should create download link with default filename', () => {
    const blob = new Blob(['test'], { type: 'text/yaml' });
    downloadBlob(blob, 'my-game-export.yaml');

    expect(document.body.appendChild).toHaveBeenCalled();
    const link = (document.body.appendChild as ReturnType<typeof vi.fn>).mock.calls[0][0] as HTMLAnchorElement;
    expect(link.download).toBe('my-game-export.yaml');
    expect(link.href).toBe('blob:mock-url');
  });

  it('should use filename from Content-Disposition header', () => {
    const blob = new Blob(['test'], { type: 'text/yaml' });
    downloadBlob(blob, 'default.yaml', 'attachment; filename="server-name.yaml"');

    const link = (document.body.appendChild as ReturnType<typeof vi.fn>).mock.calls[0][0] as HTMLAnchorElement;
    expect(link.download).toBe('server-name.yaml');
  });

  it('should sanitize default filename with invalid characters', () => {
    const blob = new Blob(['test'], { type: 'text/yaml' });
    downloadBlob(blob, 'my<game>:file*.yaml');

    const link = (document.body.appendChild as ReturnType<typeof vi.fn>).mock.calls[0][0] as HTMLAnchorElement;
    expect(link.download).toBe('mygamefile.yaml');
  });

  it('should click the link to trigger download', () => {
    const blob = new Blob(['test'], { type: 'text/yaml' });
    const clickSpy = vi.fn();
    
    // Spy on document.body.appendChild to capture the link
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    appendChildSpy.mockImplementation((node) => {
      if (node instanceof HTMLAnchorElement) {
        node.click = clickSpy;
      }
      return node;
    });

    downloadBlob(blob, 'test.yaml');
    expect(clickSpy).toHaveBeenCalled();
    
    appendChildSpy.mockRestore();
  });

  it('should cleanup after 100ms timeout', () => {
    const blob = new Blob(['test'], { type: 'text/yaml' });
    downloadBlob(blob, 'test.yaml');

    // Should not cleanup immediately
    expect(document.body.removeChild).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    // Fast-forward time
    vi.advanceTimersByTime(100);

    // Should cleanup after timeout
    expect(document.body.removeChild).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
