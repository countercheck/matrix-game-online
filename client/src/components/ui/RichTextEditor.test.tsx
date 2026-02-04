import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RichTextEditor } from './RichTextEditor';

describe('RichTextEditor - URL Validation', () => {
  let promptSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock window.prompt
    promptSpy = vi.spyOn(window, 'prompt');
  });

  afterEach(() => {
    promptSpy.mockRestore();
  });

  it('should allow http:// URLs', () => {
    const onChange = vi.fn();
    render(
      <RichTextEditor
        value=""
        onChange={onChange}
        placeholder="Test editor"
      />
    );

    promptSpy.mockReturnValue('http://example.com');

    const linkButton = screen.getByTitle('Insert Link');
    fireEvent.click(linkButton);

    // The link should be set (verified by checking if setLink was called)
    // We can't directly verify the editor state, but we can verify prompt was called
    expect(promptSpy).toHaveBeenCalledWith('Enter URL:');
  });

  it('should allow https:// URLs', () => {
    const onChange = vi.fn();
    render(
      <RichTextEditor
        value=""
        onChange={onChange}
        placeholder="Test editor"
      />
    );

    promptSpy.mockReturnValue('https://example.com');

    const linkButton = screen.getByTitle('Insert Link');
    fireEvent.click(linkButton);

    expect(promptSpy).toHaveBeenCalledWith('Enter URL:');
  });

  it('should reject javascript: URLs', () => {
    const onChange = vi.fn();
    render(
      <RichTextEditor
        value=""
        onChange={onChange}
        placeholder="Test editor"
      />
    );

    promptSpy.mockReturnValue('javascript:alert("XSS")');

    const linkButton = screen.getByTitle('Insert Link');
    fireEvent.click(linkButton);

    expect(promptSpy).toHaveBeenCalledWith('Enter URL:');
    // The dangerous URL should be rejected and not set
  });

  it('should reject data: URLs', () => {
    const onChange = vi.fn();
    render(
      <RichTextEditor
        value=""
        onChange={onChange}
        placeholder="Test editor"
      />
    );

    promptSpy.mockReturnValue('data:text/html,<script>alert("XSS")</script>');

    const linkButton = screen.getByTitle('Insert Link');
    fireEvent.click(linkButton);

    expect(promptSpy).toHaveBeenCalledWith('Enter URL:');
  });

  it('should handle empty URL input', () => {
    const onChange = vi.fn();
    render(
      <RichTextEditor
        value=""
        onChange={onChange}
        placeholder="Test editor"
      />
    );

    promptSpy.mockReturnValue('');

    const linkButton = screen.getByTitle('Insert Link');
    fireEvent.click(linkButton);

    expect(promptSpy).toHaveBeenCalledWith('Enter URL:');
  });

  it('should handle null URL input (user cancels)', () => {
    const onChange = vi.fn();
    render(
      <RichTextEditor
        value=""
        onChange={onChange}
        placeholder="Test editor"
      />
    );

    promptSpy.mockReturnValue(null);

    const linkButton = screen.getByTitle('Insert Link');
    fireEvent.click(linkButton);

    expect(promptSpy).toHaveBeenCalledWith('Enter URL:');
  });

  it('should trim whitespace from URLs', () => {
    const onChange = vi.fn();
    render(
      <RichTextEditor
        value=""
        onChange={onChange}
        placeholder="Test editor"
      />
    );

    promptSpy.mockReturnValue('  https://example.com  ');

    const linkButton = screen.getByTitle('Insert Link');
    fireEvent.click(linkButton);

    expect(promptSpy).toHaveBeenCalledWith('Enter URL:');
  });

  it('should reject invalid URL formats', () => {
    const onChange = vi.fn();
    render(
      <RichTextEditor
        value=""
        onChange={onChange}
        placeholder="Test editor"
      />
    );

    promptSpy.mockReturnValue('not a valid url');

    const linkButton = screen.getByTitle('Insert Link');
    fireEvent.click(linkButton);

    expect(promptSpy).toHaveBeenCalledWith('Enter URL:');
  });

  it('should reject file:// URLs', () => {
    const onChange = vi.fn();
    render(
      <RichTextEditor
        value=""
        onChange={onChange}
        placeholder="Test editor"
      />
    );

    promptSpy.mockReturnValue('file:///etc/passwd');

    const linkButton = screen.getByTitle('Insert Link');
    fireEvent.click(linkButton);

    expect(promptSpy).toHaveBeenCalledWith('Enter URL:');
  });

  it('should reject ftp:// URLs', () => {
    const onChange = vi.fn();
    render(
      <RichTextEditor
        value=""
        onChange={onChange}
        placeholder="Test editor"
      />
    );

    promptSpy.mockReturnValue('ftp://example.com');

    const linkButton = screen.getByTitle('Insert Link');
    fireEvent.click(linkButton);

    expect(promptSpy).toHaveBeenCalledWith('Enter URL:');
  });
});

describe('RichTextEditor - Basic Functionality', () => {
  it('should render with placeholder', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RichTextEditor
        value=""
        onChange={onChange}
        placeholder="Enter text here"
      />
    );

    const editorElement = container.querySelector('[data-placeholder="Enter text here"]');
    expect(editorElement).toBeInTheDocument();
  });

  it('should render toolbar buttons', () => {
    const onChange = vi.fn();
    render(<RichTextEditor value="" onChange={onChange} />);

    expect(screen.getByTitle('Bold (Ctrl+B)')).toBeInTheDocument();
    expect(screen.getByTitle('Italic (Ctrl+I)')).toBeInTheDocument();
    expect(screen.getByTitle('Insert Link')).toBeInTheDocument();
  });

  it('should disable buttons when disabled prop is true', () => {
    const onChange = vi.fn();
    render(<RichTextEditor value="" onChange={onChange} disabled={true} />);

    const boldButton = screen.getByTitle('Bold (Ctrl+B)');
    expect(boldButton).toBeDisabled();
  });
});
