import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RichTextDisplay } from './RichTextDisplay';

describe('RichTextDisplay - Markdown Styling', () => {
  it('should render markdown headings with proper styling (not muted)', () => {
    const markdown = '## Important Heading\n\nSome text';
    const { container } = render(<RichTextDisplay content={markdown} />);
    
    const heading = container.querySelector('h2');
    expect(heading).toBeInTheDocument();
    expect(heading?.textContent).toBe('Important Heading');
    
    // Heading should NOT have text-muted-foreground class
    expect(heading).not.toHaveClass('text-muted-foreground');
  });

  it('should render markdown links with proper styling (not muted)', () => {
    const markdown = '[Click here](https://example.com) for more info';
    const { container } = render(<RichTextDisplay content={markdown} />);
    
    const link = container.querySelector('a');
    expect(link).toBeInTheDocument();
    expect(link?.textContent).toBe('Click here');
    expect(link?.getAttribute('href')).toBe('https://example.com');
    
    // Link should NOT have text-muted-foreground class
    expect(link).not.toHaveClass('text-muted-foreground');
  });

  it('should render markdown lists with proper styling (not muted)', () => {
    const markdown = '- First item\n- Second item\n- Third item';
    const { container } = render(<RichTextDisplay content={markdown} />);
    
    const ul = container.querySelector('ul');
    const listItems = container.querySelectorAll('li');
    
    expect(ul).toBeInTheDocument();
    expect(listItems).toHaveLength(3);
    
    // List items should NOT have text-muted-foreground class
    listItems.forEach(li => {
      expect(li).not.toHaveClass('text-muted-foreground');
    });
  });

  it('should render markdown blockquotes with proper styling (not muted)', () => {
    const markdown = '> This is a quote\n> From someone wise';
    const { container } = render(<RichTextDisplay content={markdown} />);
    
    const blockquote = container.querySelector('blockquote');
    expect(blockquote).toBeInTheDocument();
    
    // Blockquote should NOT have text-muted-foreground class
    expect(blockquote).not.toHaveClass('text-muted-foreground');
  });

  it('should apply prose classes for proper markdown rendering', () => {
    const markdown = '**Bold text**';
    const { container } = render(<RichTextDisplay content={markdown} />);
    
    const wrapper = container.firstChild as HTMLElement;
    
    // Should have prose classes for typography styling
    expect(wrapper).toHaveClass('prose');
    expect(wrapper).toHaveClass('prose-sm');
    expect(wrapper).toHaveClass('dark:prose-invert');
    expect(wrapper).toHaveClass('max-w-none');
  });

  it('should render complex markdown with mixed elements correctly', () => {
    const markdown = `
## Game Rules

Here are the **important** rules:

1. Be respectful
2. Have fun
3. Follow the [guidelines](https://example.com)

> Remember: teamwork makes the dream work!
    `.trim();
    
    const { container } = render(<RichTextDisplay content={markdown} />);
    
    // All different markdown elements should be present
    expect(container.querySelector('h2')).toBeInTheDocument();
    expect(container.querySelector('strong')).toBeInTheDocument();
    expect(container.querySelector('ol')).toBeInTheDocument();
    expect(container.querySelector('a')).toBeInTheDocument();
    expect(container.querySelector('blockquote')).toBeInTheDocument();
    
    // Wrapper should have prose classes
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('prose');
  });

  it('should allow custom className while maintaining prose classes', () => {
    const markdown = '## Test';
    const { container } = render(
      <RichTextDisplay content={markdown} className="custom-class mt-2" />
    );
    
    const wrapper = container.firstChild as HTMLElement;
    
    // Should have both prose classes and custom classes
    expect(wrapper).toHaveClass('prose');
    expect(wrapper).toHaveClass('prose-sm');
    expect(wrapper).toHaveClass('custom-class');
    expect(wrapper).toHaveClass('mt-2');
  });

  it('should allow paragraph-specific styling without affecting other elements', () => {
    const markdown = '## Heading\n\nParagraph text\n\n- List item';
    const { container } = render(
      <RichTextDisplay 
        content={markdown} 
        className="[&_p]:my-1 [&_p]:text-muted-foreground" 
      />
    );
    
    const heading = container.querySelector('h2');
    const paragraph = container.querySelector('p');
    const listItem = container.querySelector('li');
    
    // Paragraph should have the custom styling
    expect(paragraph).toBeInTheDocument();
    
    // Heading and list items should NOT be affected by paragraph-specific classes
    expect(heading).not.toHaveClass('text-muted-foreground');
    expect(listItem).not.toHaveClass('text-muted-foreground');
  });
});
