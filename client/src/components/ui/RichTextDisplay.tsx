import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface RichTextDisplayProps {
  content: string;
  className?: string;
  inline?: boolean;
}

/**
 * Renders Markdown content from the RichTextEditor.
 * Uses react-markdown with GFM (GitHub Flavored Markdown) support.
 * Handles tables, strikethrough, task lists, and autolinks.
 * 
 * @param inline - If true, renders as a span instead of div for inline content
 */
export function RichTextDisplay({ content, className = '', inline = false }: RichTextDisplayProps) {
  if (!content) {
    return null;
  }

  const Component = inline ? 'span' : 'div';

  return (
    <Component className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </Component>
  );
}
