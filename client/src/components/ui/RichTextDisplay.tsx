import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface RichTextDisplayProps {
  content: string;
  className?: string;
}

/**
 * Renders Markdown content from the RichTextEditor.
 * Uses react-markdown with GFM (GitHub Flavored Markdown) support.
 * Handles tables, strikethrough, task lists, and autolinks.
 */
export function RichTextDisplay({ content, className = '' }: RichTextDisplayProps) {
  if (!content) {
    return null;
  }

  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
