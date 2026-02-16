/**
 * Decode HTML entities that may have been encoded by server-side sanitization.
 *
 * The server previously encoded all input strings (e.g., " → &quot;), storing
 * encoded values in the database. This function decodes them for display.
 * React's JSX rendering already prevents XSS, so decoding is safe here.
 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&');
}
