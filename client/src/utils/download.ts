/**
 * Sanitize a filename by removing invalid characters and limiting length
 */
export function sanitizeFilename(filename: string, maxLength = 100): string {
  return filename
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .substring(0, maxLength);
}

/**
 * Extract filename from Content-Disposition header
 * Handles both quoted and unquoted filename values
 */
export function extractFilenameFromHeader(contentDisposition: string): string | null {
  if (!contentDisposition) return null;
  
  // Match: filename="value" or filename=value, stopping unquoted values at ';' or newline.
  // Intentionally ignore RFC 5987 filename* parameters, which use a different encoding scheme.
  const matches = contentDisposition.match(/filename(?!\*)[^;=\n]*=\s*(?:"([^"\n]*)"|([^;\n]*))/i);
  if (matches) {
    const value = matches[1] ?? matches[2];
    if (value) {
      return value.trim();
    }
  }
  
  return null;
}

/**
 * Download a blob as a file with optional filename from Content-Disposition header
 */
export function downloadBlob(
  blob: Blob,
  defaultFilename: string,
  contentDisposition?: string
): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  // Extract filename from header or use default, then sanitize for safety
  const headerFilename = contentDisposition 
    ? extractFilenameFromHeader(contentDisposition) 
    : null;
  const filenameSource = headerFilename ?? defaultFilename;
  const filename = sanitizeFilename(filenameSource);
  
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  
  // Delay cleanup to ensure download starts in all browsers
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}
