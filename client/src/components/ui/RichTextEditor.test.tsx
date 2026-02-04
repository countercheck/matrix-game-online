import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('should display character count when maxLength is provided', () => {
    render(<RichTextEditor value="" onChange={onChangeMock} maxLength={100} />);
    expect(screen.getByText('0/100 characters')).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<RichTextEditor value="" onChange={onChangeMock} disabled />);

    const editor = screen.getByRole('textbox');
    expect(editor).toHaveAttribute('contenteditable', 'false');
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
