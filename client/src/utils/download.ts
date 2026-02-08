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
  
  // Match: filename="value" or filename=value
  const matches = contentDisposition.match(/filename[^;=\n]*=(["']?)([^"'\n]*)\1/);
  if (matches && matches[2]) {
    return matches[2].trim();
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
  
  // Extract filename from header or use sanitized default
  const headerFilename = contentDisposition 
    ? extractFilenameFromHeader(contentDisposition) 
    : null;
  const filename = headerFilename || sanitizeFilename(defaultFilename);
  
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
