import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Decode HTML entities that may have been encoded by server-side sanitization.
 * This is needed because the server encodes strings on input (e.g., " → &quot;)
 * but react-markdown treats them as literal text, not HTML.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");
}

interface RichTextDisplayProps {
  content: string;
  className?: string;
  inline?: boolean;
  disableLinks?: boolean;
}

/**
 * Renders Markdown content from the RichTextEditor.
 * Uses react-markdown with GFM (GitHub Flavored Markdown) support.
 * Handles tables, strikethrough, task lists, and autolinks.
 *
 * @param inline - If true, renders as a span instead of div for inline content.
 *   Note: prose classes are intentionally excluded for inline rendering to avoid
 *   block-level margins/padding. Callers should provide inline-specific styling via className.
 * @param disableLinks - If true, renders links as plain text to avoid nested anchor issues.
 */
export function RichTextDisplay({
  content,
  className = '',
  inline = false,
  disableLinks = false,
}: RichTextDisplayProps) {
  if (!content) {
    return null;
  }

  const Component = inline ? 'span' : 'div';
  const baseClasses = inline
    ? className
    : `prose prose-sm dark:prose-invert max-w-none ${className}`;

  return (
    <Component className={baseClasses}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={
          disableLinks
            ? {
                a: ({ children, ...props }) => {
                  // Remove invalid HTML attributes for span element
                  const { ...rest } = props;
                  return <span {...rest}>{children}</span>;
                },
              }
            : undefined
        }
      >
        {decodeHtmlEntities(content)}
      </ReactMarkdown>
    </Component>
  );
}
