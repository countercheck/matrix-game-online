import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import { CharacterCount } from '@tiptap/extension-character-count';
import { Markdown } from 'tiptap-markdown';
import { useCallback, useEffect, useRef } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  className?: string;
  id?: string;
  rows?: number;
  disabled?: boolean;
}

interface ToolbarProps {
  editor: Editor | null;
  disabled?: boolean;
}

function Toolbar({ editor, disabled }: ToolbarProps) {
  if (!editor) return null;

  const buttonClass = (isActive: boolean) =>
    `p-1.5 rounded text-sm font-medium transition-colors ${
      isActive
        ? 'bg-primary text-primary-foreground'
        : 'hover:bg-muted text-muted-foreground hover:text-foreground'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`;

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30">
      {/* Text formatting */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={disabled}
        className={buttonClass(editor.isActive('bold'))}
        title="Bold (Ctrl+B)"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={disabled}
        className={buttonClass(editor.isActive('italic'))}
        title="Italic (Ctrl+I)"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={disabled}
        className={buttonClass(editor.isActive('strike'))}
        title="Strikethrough"
      >
        <s>S</s>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCode().run()}
        disabled={disabled}
        className={buttonClass(editor.isActive('code'))}
        title="Inline Code"
      >
        {'</>'}
      </button>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Headings */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        disabled={disabled}
        className={buttonClass(editor.isActive('heading', { level: 2 }))}
        title="Heading 2"
      >
        H2
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        disabled={disabled}
        className={buttonClass(editor.isActive('heading', { level: 3 }))}
        title="Heading 3"
      >
        H3
      </button>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Lists */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        disabled={disabled}
        className={buttonClass(editor.isActive('bulletList'))}
        title="Bullet List"
      >
        &bull;
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        disabled={disabled}
        className={buttonClass(editor.isActive('orderedList'))}
        title="Numbered List"
      >
        1.
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        disabled={disabled}
        className={buttonClass(editor.isActive('taskList'))}
        title="Task List"
      >
        &#x2610;
      </button>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Block elements */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        disabled={disabled}
        className={buttonClass(editor.isActive('blockquote'))}
        title="Blockquote"
      >
        &ldquo;
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        disabled={disabled}
        className={buttonClass(editor.isActive('codeBlock'))}
        title="Code Block"
      >
        {'{ }'}
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        disabled={disabled}
        className={buttonClass(false)}
        title="Horizontal Rule"
      >
        &mdash;
      </button>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Table */}
      <button
        type="button"
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
        disabled={disabled}
        className={buttonClass(false)}
        title="Insert Table"
      >
        &#x25A6;
      </button>

      {/* Link */}
      <button
        type="button"
        onClick={() => {
          const url = window.prompt('Enter URL:');
          if (url) {
            editor.chain().focus().setLink({ href: url }).run();
          }
        }}
        disabled={disabled}
        className={buttonClass(editor.isActive('link'))}
        title="Insert Link"
      >
        &#x1F517;
      </button>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  maxLength,
  placeholder,
  className = '',
  id,
  rows = 4,
  disabled = false,
}: RichTextEditorProps) {
  // Track if we're currently updating from external value to avoid loops
  const isUpdatingRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Write something...',
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      ...(maxLength ? [CharacterCount.configure({ limit: maxLength })] : []),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      if (!isUpdatingRef.current) {
        // Get markdown output - use type assertion for tiptap-markdown storage
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const markdown = (editor.storage as any).markdown.getMarkdown();
        onChange(markdown);
      }
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[80px] px-3 py-2',
        id: id || '',
      },
    },
  });

  // Update content when value prop changes externally
  const updateContent = useCallback(() => {
    if (editor) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentMarkdown = (editor.storage as any).markdown.getMarkdown();
      if (value !== currentMarkdown) {
        isUpdatingRef.current = true;
        editor.commands.setContent(value);
        isUpdatingRef.current = false;
      }
    }
  }, [editor, value]);

  useEffect(() => {
    updateContent();
  }, [updateContent]);

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  // Calculate min-height based on rows
  const minHeight = `${rows * 24}px`;

  const characterCount = editor?.storage.characterCount?.characters() || 0;

  return (
    <div className={`border rounded-md bg-background overflow-hidden ${className}`}>
      <Toolbar editor={editor} disabled={disabled} />
      <div style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
      {maxLength && (
        <div className="px-3 py-1.5 text-xs text-muted-foreground text-right border-t bg-muted/30">
          {characterCount}/{maxLength} characters
        </div>
      )}
    </div>
  );
}
