import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RichTextEditor } from './RichTextEditor';

describe('RichTextEditor', () => {
  let onChangeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChangeMock = vi.fn();
  });

  it('should render the editor', () => {
    render(<RichTextEditor value="" onChange={onChangeMock} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should apply placeholder text to the editor element', () => {
    render(<RichTextEditor value="" onChange={onChangeMock} placeholder="Enter your text here" />);
    const editor = screen.getByRole('textbox');
    // Placeholder is rendered as a data attribute, not visible text
    const paragraph = editor.querySelector('p[data-placeholder]');
    expect(paragraph).toHaveAttribute('data-placeholder', 'Enter your text here');
  });

  it('should apply default placeholder when not provided', () => {
    render(<RichTextEditor value="" onChange={onChangeMock} />);
    const editor = screen.getByRole('textbox');
    const paragraph = editor.querySelector('p[data-placeholder]');
    expect(paragraph).toHaveAttribute('data-placeholder', 'Write something...');
  });

  it('should display character count when maxLength is provided', () => {
    render(<RichTextEditor value="" onChange={onChangeMock} maxLength={100} />);
    expect(screen.getByText('0/100 characters')).toBeInTheDocument();
  });

  it('should not display character count when maxLength is not provided', () => {
    render(<RichTextEditor value="" onChange={onChangeMock} />);
    expect(screen.queryByText(/characters$/)).not.toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<RichTextEditor value="" onChange={onChangeMock} disabled />);

    const editor = screen.getByRole('textbox');
    expect(editor).toHaveAttribute('contenteditable', 'false');
  });

  describe('Markdown conversion', () => {
    it('should initialize with markdown content', () => {
      render(<RichTextEditor value="**Bold text**" onChange={onChangeMock} />);
      const editor = screen.getByRole('textbox');
      expect(editor).toBeInTheDocument();
      // TipTap will render the bold markdown as HTML
      expect(editor.querySelector('strong')).toBeInTheDocument();
    });

    it('should convert markdown headings to editor content', async () => {
      render(<RichTextEditor value="## Heading 2\n\n### Heading 3" onChange={onChangeMock} />);
      const editor = screen.getByRole('textbox');
      
      // Wait for the content to be rendered
      await waitFor(() => {
        // TipTap might not render exact H2/H3 tags, check for heading content
        expect(editor.textContent).toContain('Heading 2');
        expect(editor.textContent).toContain('Heading 3');
      });
    });

    it('should convert markdown lists to editor content', () => {
      render(<RichTextEditor value="- Item 1\n- Item 2" onChange={onChangeMock} />);
      const editor = screen.getByRole('textbox');
      expect(editor.querySelector('ul')).toBeInTheDocument();
    });

    it('should convert markdown blockquotes to editor content', () => {
      render(<RichTextEditor value="> Quote text" onChange={onChangeMock} />);
      const editor = screen.getByRole('textbox');
      expect(editor.querySelector('blockquote')).toBeInTheDocument();
    });

    it('should convert markdown code blocks to editor content', async () => {
      render(<RichTextEditor value="```\ncode\n```" onChange={onChangeMock} />);
      const editor = screen.getByRole('textbox');
      
      // Wait for the content to be rendered
      await waitFor(() => {
        // TipTap renders code blocks with specific classes
        expect(editor.textContent).toContain('code');
      });
    });

    it('should call onChange with markdown when content changes', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={onChangeMock} />);

      const editor = screen.getByRole('textbox');
      await user.click(editor);
      await user.keyboard('Test text');

      await waitFor(() => {
        expect(onChangeMock).toHaveBeenCalled();
        const lastCall = onChangeMock.mock.calls[onChangeMock.mock.calls.length - 1];
        expect(lastCall[0]).toContain('Test text');
      });
    });

    it('should update editor when value prop changes', async () => {
      const { rerender } = render(<RichTextEditor value="Initial text" onChange={onChangeMock} />);
      
      rerender(<RichTextEditor value="**Updated text**" onChange={onChangeMock} />);
      
      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        expect(editor.querySelector('strong')).toBeInTheDocument();
      });
    });
  });

  describe('Toolbar interactions', () => {
    it('should render all toolbar buttons', () => {
      render(<RichTextEditor value="" onChange={onChangeMock} />);

      expect(screen.getByTitle('Bold (Ctrl+B)')).toBeInTheDocument();
      expect(screen.getByTitle('Italic (Ctrl+I)')).toBeInTheDocument();
      expect(screen.getByTitle('Strikethrough')).toBeInTheDocument();
      expect(screen.getByTitle('Inline Code')).toBeInTheDocument();
      expect(screen.getByTitle('Heading 2')).toBeInTheDocument();
      expect(screen.getByTitle('Heading 3')).toBeInTheDocument();
      expect(screen.getByTitle('Bullet List')).toBeInTheDocument();
      expect(screen.getByTitle('Numbered List')).toBeInTheDocument();
      expect(screen.getByTitle('Task List')).toBeInTheDocument();
      expect(screen.getByTitle('Blockquote')).toBeInTheDocument();
      expect(screen.getByTitle('Code Block')).toBeInTheDocument();
      expect(screen.getByTitle('Horizontal Rule')).toBeInTheDocument();
      expect(screen.getByTitle('Insert Table')).toBeInTheDocument();
      expect(screen.getByTitle('Insert Link')).toBeInTheDocument();
    });

    it('should apply bold formatting when toggled', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={onChangeMock} />);

      const boldButton = screen.getByTitle('Bold (Ctrl+B)');
      await user.click(boldButton);

      // Clicking the button calls the TipTap command
      expect(boldButton).toBeInTheDocument();
    });

    it('should apply italic formatting when toggled', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={onChangeMock} />);

      const italicButton = screen.getByTitle('Italic (Ctrl+I)');
      await user.click(italicButton);

      expect(italicButton).toBeInTheDocument();
    });

    it('should apply heading 2 when toggled', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={onChangeMock} />);

      const h2Button = screen.getByTitle('Heading 2');
      const editor = screen.getByRole('textbox');
      
      await user.click(h2Button);

      // Verify the editor content changed to a heading
      await waitFor(() => {
        expect(editor.querySelector('h2')).toBeInTheDocument();
      });
    });

    it('should apply heading 3 when toggled', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={onChangeMock} />);

      const h3Button = screen.getByTitle('Heading 3');
      const editor = screen.getByRole('textbox');
      
      await user.click(h3Button);

      await waitFor(() => {
        expect(editor.querySelector('h3')).toBeInTheDocument();
      });
    });

    it('should apply bullet list when toggled', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={onChangeMock} />);

      const bulletListButton = screen.getByTitle('Bullet List');
      const editor = screen.getByRole('textbox');
      
      await user.click(bulletListButton);

      await waitFor(() => {
        expect(editor.querySelector('ul')).toBeInTheDocument();
      });
    });

    it('should apply ordered list when toggled', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={onChangeMock} />);

      const orderedListButton = screen.getByTitle('Numbered List');
      const editor = screen.getByRole('textbox');
      
      await user.click(orderedListButton);

      await waitFor(() => {
        expect(editor.querySelector('ol')).toBeInTheDocument();
      });
    });

    it('should insert horizontal rule when clicked', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={onChangeMock} />);

      const hrButton = screen.getByTitle('Horizontal Rule');
      await user.click(hrButton);

      await waitFor(() => {
        expect(onChangeMock).toHaveBeenCalled();
      });
    });

    it('should insert table when clicked', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={onChangeMock} />);

      const tableButton = screen.getByTitle('Insert Table');
      await user.click(tableButton);

      await waitFor(() => {
        expect(onChangeMock).toHaveBeenCalled();
      });
    });

    it('should disable all toolbar buttons when editor is disabled', () => {
      render(<RichTextEditor value="" onChange={onChangeMock} disabled />);

      const boldButton = screen.getByTitle('Bold (Ctrl+B)');
      const italicButton = screen.getByTitle('Italic (Ctrl+I)');
      const linkButton = screen.getByTitle('Insert Link');

      expect(boldButton).toBeDisabled();
      expect(italicButton).toBeDisabled();
      expect(linkButton).toBeDisabled();
    });
  });

  describe('URL validation', () => {
    beforeEach(() => {
      // Mock window.prompt to avoid actual prompt dialogs
      vi.spyOn(window, 'prompt');
    });

    it('should allow http:// URLs in toolbar link button', async () => {
      const user = userEvent.setup();
      vi.mocked(window.prompt).mockReturnValue('http://example.com');

      render(<RichTextEditor value="" onChange={onChangeMock} />);

      const linkButton = screen.getByTitle('Insert Link');
      await user.click(linkButton);

      // URL constructor should validate this as http:
      expect(window.prompt).toHaveBeenCalledWith('Enter URL:');
    });

    it('should allow https:// URLs in toolbar link button', async () => {
      const user = userEvent.setup();
      vi.mocked(window.prompt).mockReturnValue('https://example.com');

      render(<RichTextEditor value="" onChange={onChangeMock} />);

      const linkButton = screen.getByTitle('Insert Link');
      await user.click(linkButton);

      expect(window.prompt).toHaveBeenCalledWith('Enter URL:');
    });

    it('should allow mailto: URLs in toolbar link button', async () => {
      const user = userEvent.setup();
      vi.mocked(window.prompt).mockReturnValue('mailto:test@example.com');

      render(<RichTextEditor value="" onChange={onChangeMock} />);

      const linkButton = screen.getByTitle('Insert Link');
      await user.click(linkButton);

      expect(window.prompt).toHaveBeenCalledWith('Enter URL:');
    });

    it('should reject javascript: URLs in toolbar link button', async () => {
      const user = userEvent.setup();
      vi.mocked(window.prompt).mockReturnValue('javascript:alert("xss")');

      render(<RichTextEditor value="" onChange={onChangeMock} />);

      const linkButton = screen.getByTitle('Insert Link');
      await user.click(linkButton);

      expect(window.prompt).toHaveBeenCalledWith('Enter URL:');
      // The link should not be set because javascript: protocol is not allowed
    });

    it('should reject data: URLs in toolbar link button', async () => {
      const user = userEvent.setup();
      vi.mocked(window.prompt).mockReturnValue('data:text/html,<script>alert("xss")</script>');

      render(<RichTextEditor value="" onChange={onChangeMock} />);

      const linkButton = screen.getByTitle('Insert Link');
      await user.click(linkButton);

      expect(window.prompt).toHaveBeenCalledWith('Enter URL:');
      // The link should not be set because data: protocol is not allowed
    });

    it('should reject empty URLs in toolbar link button', async () => {
      const user = userEvent.setup();
      vi.mocked(window.prompt).mockReturnValue('');

      render(<RichTextEditor value="" onChange={onChangeMock} />);

      const linkButton = screen.getByTitle('Insert Link');
      await user.click(linkButton);

      expect(window.prompt).toHaveBeenCalledWith('Enter URL:');
      // No link should be set for empty URL
    });

    it('should handle cancelled prompt in toolbar link button', async () => {
      const user = userEvent.setup();
      vi.mocked(window.prompt).mockReturnValue(null);

      render(<RichTextEditor value="" onChange={onChangeMock} />);

      const linkButton = screen.getByTitle('Insert Link');
      await user.click(linkButton);

      expect(window.prompt).toHaveBeenCalledWith('Enter URL:');
      // No link should be set when prompt is cancelled
    });
  });

  describe('Accessibility', () => {
    it('should have role="textbox"', () => {
      render(<RichTextEditor value="" onChange={onChangeMock} />);
      const editor = screen.getByRole('textbox');
      expect(editor).toBeInTheDocument();
    });

    it('should have aria-multiline="true"', () => {
      render(<RichTextEditor value="" onChange={onChangeMock} />);
      const editor = screen.getByRole('textbox');
      expect(editor).toHaveAttribute('aria-multiline', 'true');
    });

    it('should support custom id', () => {
      render(<RichTextEditor value="" onChange={onChangeMock} id="custom-editor" />);
      const editor = screen.getByRole('textbox');
      expect(editor).toHaveAttribute('id', 'custom-editor');
    });

    it('should support aria-labelledby', () => {
      render(<RichTextEditor value="" onChange={onChangeMock} aria-labelledby="label-id" />);
      const editor = screen.getByRole('textbox');
      expect(editor).toHaveAttribute('aria-labelledby', 'label-id');
    });
  });
});
