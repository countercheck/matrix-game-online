import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RichTextDisplay } from './RichTextDisplay';

describe('RichTextDisplay', () => {
  describe('Rendering modes', () => {
    it('should render as div by default (block mode)', () => {
      const { container } = render(<RichTextDisplay content="Test content" />);
      const element = container.firstChild as HTMLElement;

      expect(element.tagName).toBe('DIV');
    });

    it('should render as span when inline prop is true', () => {
      const { container } = render(<RichTextDisplay content="Test content" inline />);
      const element = container.firstChild as HTMLElement;

      expect(element.tagName).toBe('SPAN');
    });

    it('should render basic text content in block mode', () => {
      const { container } = render(<RichTextDisplay content="Hello World" />);
      
      expect(container.textContent).toContain('Hello World');
    });

    it('should render basic text content in inline mode', () => {
      const { container } = render(<RichTextDisplay content="Hello World" inline />);
      
      expect(container.textContent).toContain('Hello World');
    });
  });

  describe('CSS class application', () => {
    it('should apply prose classes in block mode by default', () => {
      const { container } = render(<RichTextDisplay content="Test" />);
      const element = container.firstChild as HTMLElement;

      expect(element).toHaveClass('prose');
      expect(element).toHaveClass('prose-sm');
      expect(element).toHaveClass('dark:prose-invert');
      expect(element).toHaveClass('max-w-none');
    });

    it('should NOT apply prose classes in inline mode', () => {
      const { container } = render(<RichTextDisplay content="Test" inline />);
      const element = container.firstChild as HTMLElement;

      expect(element).not.toHaveClass('prose');
      expect(element).not.toHaveClass('prose-sm');
      expect(element).not.toHaveClass('dark:prose-invert');
      expect(element).not.toHaveClass('max-w-none');
    });

    it('should apply custom className in block mode', () => {
      const { container } = render(
        <RichTextDisplay content="Test" className="custom-class text-lg" />
      );
      const element = container.firstChild as HTMLElement;

      expect(element).toHaveClass('custom-class');
      expect(element).toHaveClass('text-lg');
      expect(element).toHaveClass('prose'); // prose classes still applied
    });

    it('should apply custom className in inline mode', () => {
      const { container } = render(
        <RichTextDisplay content="Test" className="custom-inline text-sm" inline />
      );
      const element = container.firstChild as HTMLElement;

      expect(element).toHaveClass('custom-inline');
      expect(element).toHaveClass('text-sm');
      expect(element).not.toHaveClass('prose'); // prose classes NOT applied
    });

    it('should handle empty className in block mode', () => {
      const { container } = render(<RichTextDisplay content="Test" className="" />);
      const element = container.firstChild as HTMLElement;

      expect(element).toHaveClass('prose');
      expect(element).toHaveClass('prose-sm');
    });

    it('should handle empty className in inline mode', () => {
      const { container } = render(<RichTextDisplay content="Test" className="" inline />);
      const element = container.firstChild as HTMLElement;

      expect(element.className).toBe('');
    });
  });

  describe('Empty/null content handling', () => {
    it('should return null when content is empty string', () => {
      const { container } = render(<RichTextDisplay content="" />);
      
      expect(container.firstChild).toBeNull();
    });

    it('should render when content is whitespace only', () => {
      const { container } = render(<RichTextDisplay content="   " />);
      
      // The component checks !content, so "   " is truthy and will render
      // Let's verify it renders the whitespace
      expect(container.firstChild).not.toBeNull();
    });

    it('should not render when content is empty in inline mode', () => {
      const { container } = render(<RichTextDisplay content="" inline />);
      
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Markdown rendering with remarkGfm', () => {
    it('should render bold markdown', () => {
      const { container } = render(<RichTextDisplay content="**bold text**" />);
      const strong = container.querySelector('strong');
      
      expect(strong).toBeInTheDocument();
      expect(strong?.textContent).toBe('bold text');
    });

    it('should render italic markdown', () => {
      const { container } = render(<RichTextDisplay content="*italic text*" />);
      const em = container.querySelector('em');
      
      expect(em).toBeInTheDocument();
      expect(em?.textContent).toBe('italic text');
    });

    it('should render strikethrough (GFM feature)', () => {
      const { container } = render(<RichTextDisplay content="~~strikethrough~~" />);
      const del = container.querySelector('del');
      
      expect(del).toBeInTheDocument();
      expect(del?.textContent).toBe('strikethrough');
    });

    it('should render links', () => {
      const { container } = render(<RichTextDisplay content="[link text](https://example.com)" />);
      const link = container.querySelector('a');
      
      expect(link).toBeInTheDocument();
      expect(link?.textContent).toBe('link text');
      expect(link?.getAttribute('href')).toBe('https://example.com');
    });

    it('should render autolinks (GFM feature)', () => {
      const { container } = render(<RichTextDisplay content="https://example.com" />);
      const link = container.querySelector('a');
      
      expect(link).toBeInTheDocument();
      expect(link?.getAttribute('href')).toBe('https://example.com');
    });

    it('should render headings', () => {
      const { container } = render(<RichTextDisplay content="## Heading 2" />);
      const heading = container.querySelector('h2');
      
      expect(heading).toBeInTheDocument();
      expect(heading?.textContent).toBe('Heading 2');
    });

    it('should render lists', () => {
      const { container } = render(<RichTextDisplay content="- Item 1\n- Item 2" />);
      const ul = container.querySelector('ul');
      
      expect(ul).toBeInTheDocument();
      expect(container.textContent).toContain('Item 1');
      expect(container.textContent).toContain('Item 2');
    });

    it('should render task lists (GFM feature)', () => {
      const { container } = render(<RichTextDisplay content="- [ ] Todo item\n- [x] Done item" />);
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      
      // Note: ReactMarkdown may render task lists differently, so we verify content is present
      expect(checkboxes.length).toBeGreaterThanOrEqual(1);
      expect(container.textContent).toContain('Todo item');
      expect(container.textContent).toContain('Done item');
    });

    it('should render tables (GFM feature)', () => {
      const markdown = `| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |`;
      
      const { container } = render(<RichTextDisplay content={markdown} />);
      const table = container.querySelector('table');
      const th = container.querySelectorAll('th');
      const td = container.querySelectorAll('td');
      
      expect(table).toBeInTheDocument();
      expect(th).toHaveLength(2);
      expect(td).toHaveLength(2);
      expect(th[0].textContent).toBe('Header 1');
      expect(td[0].textContent).toBe('Cell 1');
    });

    it('should render code blocks', () => {
      const { container } = render(<RichTextDisplay content="```\nconst x = 1;\n```" />);
      const code = container.querySelector('code');
      
      expect(code).toBeInTheDocument();
      expect(code?.textContent).toContain('const x = 1;');
    });

    it('should render inline code', () => {
      const { container } = render(<RichTextDisplay content="Use `console.log()` for debugging" />);
      const code = container.querySelector('code');
      
      expect(code).toBeInTheDocument();
      expect(code?.textContent).toBe('console.log()');
    });

    it('should render blockquotes', () => {
      const { container } = render(<RichTextDisplay content="> Quote text" />);
      const blockquote = container.querySelector('blockquote');
      
      expect(blockquote).toBeInTheDocument();
      expect(blockquote?.textContent).toContain('Quote text');
    });

    it('should render multiple markdown features together', () => {
      const markdown = `# Title\n\n**Bold** and *italic* and ~~strike~~\n\n- List item\n\n[Link](https://example.com)`;
      const { container } = render(<RichTextDisplay content={markdown} />);
      
      expect(container.querySelector('h1')).toBeInTheDocument();
      expect(container.querySelector('strong')).toBeInTheDocument();
      expect(container.querySelector('em')).toBeInTheDocument();
      expect(container.querySelector('del')).toBeInTheDocument();
      expect(container.querySelector('ul')).toBeInTheDocument();
      expect(container.querySelector('a')).toBeInTheDocument();
    });
  });

  describe('Inline mode markdown rendering', () => {
    it('should render markdown in inline mode', () => {
      const { container } = render(<RichTextDisplay content="**bold** text" inline />);
      const strong = container.querySelector('strong');
      
      expect(strong).toBeInTheDocument();
      expect(strong?.textContent).toBe('bold');
    });

    it('should use span wrapper for inline content', () => {
      const { container } = render(<RichTextDisplay content="*italic*" inline />);
      const wrapper = container.firstChild as HTMLElement;
      
      expect(wrapper.tagName).toBe('SPAN');
      expect(wrapper.querySelector('em')).toBeInTheDocument();
    });

    it('should not have block-level margins in inline mode', () => {
      const { container } = render(
        <RichTextDisplay content="Test" className="custom" inline />
      );
      const element = container.firstChild as HTMLElement;
      
      // Verify prose classes (which add margins) are not applied
      expect(element).not.toHaveClass('prose');
      expect(element).toHaveClass('custom');
    });
  });

  describe('Link handling', () => {
    it('should render links by default', () => {
      const { container } = render(
        <RichTextDisplay content="[link text](https://example.com)" />
      );
      const link = container.querySelector('a');
      
      expect(link).toBeInTheDocument();
      expect(link?.textContent).toBe('link text');
      expect(link?.getAttribute('href')).toBe('https://example.com');
    });

    it('should disable links when disableLinks prop is true', () => {
      const { container } = render(
        <RichTextDisplay content="[link text](https://example.com)" disableLinks />
      );
      const link = container.querySelector('a');
      // The custom a component renders as a span, wrapped in the prose div
      const spans = container.querySelectorAll('span');
      
      expect(link).not.toBeInTheDocument();
      // Should have at least one span (the one replacing the link)
      expect(spans.length).toBeGreaterThan(0);
      // Find the span with the link text
      const linkSpan = Array.from(spans).find(s => s.textContent === 'link text');
      expect(linkSpan).toBeInTheDocument();
    });

    it('should disable autolinks when disableLinks prop is true', () => {
      const { container } = render(
        <RichTextDisplay content="https://example.com" disableLinks />
      );
      const link = container.querySelector('a');
      
      expect(link).not.toBeInTheDocument();
      expect(container.textContent).toContain('https://example.com');
    });
  });
});
