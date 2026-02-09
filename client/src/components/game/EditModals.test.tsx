import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditActionModal } from './EditActionModal';
import { EditArgumentModal } from './EditArgumentModal';
import { EditNarrationModal } from './EditNarrationModal';
import { EditRoundSummaryModal } from './EditRoundSummaryModal';

// Mock RichTextEditor to simplify testing
vi.mock('../ui/RichTextEditor', () => ({
  RichTextEditor: ({
    value,
    onChange,
    placeholder,
    id,
    disabled,
  }: {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    id?: string;
    disabled?: boolean;
  }) => (
    <textarea
      data-testid={id || 'rich-text-editor'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  ),
}));

describe('EditActionModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    initialActionDescription: 'Original action',
    initialDesiredOutcome: 'Original outcome',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    render(<EditActionModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Edit Action Proposal')).not.toBeInTheDocument();
  });

  it('should render with initial values', () => {
    render(<EditActionModal {...defaultProps} />);
    expect(screen.getByText('Edit Action Proposal')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Original action')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Original outcome')).toBeInTheDocument();
  });

  it('should call onSave with changed fields and close', async () => {
    const user = userEvent.setup();
    render(<EditActionModal {...defaultProps} />);

    const descriptionInput = screen.getByDisplayValue('Original action');
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'Updated action');

    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith({
        actionDescription: 'Updated action',
      });
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('should close without saving when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<EditActionModal {...defaultProps} />);

    await user.click(screen.getByText('Cancel'));

    expect(defaultProps.onSave).not.toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should close without saving when no changes are made', async () => {
    const user = userEvent.setup();
    render(<EditActionModal {...defaultProps} />);

    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(defaultProps.onSave).not.toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('should show error message on save failure', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue({
      response: { data: { error: { message: 'Forbidden' } } },
    });
    render(<EditActionModal {...defaultProps} onSave={onSave} />);

    const descriptionInput = screen.getByDisplayValue('Original action');
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'Changed');

    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Forbidden')).toBeInTheDocument();
    });
  });
});

describe('EditArgumentModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    initialContent: 'Original argument',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    render(<EditArgumentModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Edit Argument')).not.toBeInTheDocument();
  });

  it('should render with initial content', () => {
    render(<EditArgumentModal {...defaultProps} />);
    expect(screen.getByText('Edit Argument')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Original argument')).toBeInTheDocument();
  });

  it('should show argument type badge when provided', () => {
    render(<EditArgumentModal {...defaultProps} argumentType="FOR" />);
    expect(screen.getByText('FOR')).toBeInTheDocument();
  });

  it('should call onSave with updated content', async () => {
    const user = userEvent.setup();
    render(<EditArgumentModal {...defaultProps} />);

    const textarea = screen.getByDisplayValue('Original argument');
    await user.clear(textarea);
    await user.type(textarea, 'Updated argument');

    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith({ content: 'Updated argument' });
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('should close on Cancel click', async () => {
    const user = userEvent.setup();
    render(<EditArgumentModal {...defaultProps} />);

    await user.click(screen.getByText('Cancel'));

    expect(defaultProps.onSave).not.toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});

describe('EditNarrationModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    initialContent: 'Original narration',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    render(<EditNarrationModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Edit Narration')).not.toBeInTheDocument();
  });

  it('should render with initial content', () => {
    render(<EditNarrationModal {...defaultProps} />);
    expect(screen.getByText('Edit Narration')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Original narration')).toBeInTheDocument();
  });

  it('should call onSave with updated content', async () => {
    const user = userEvent.setup();
    render(<EditNarrationModal {...defaultProps} />);

    const textarea = screen.getByDisplayValue('Original narration');
    await user.clear(textarea);
    await user.type(textarea, 'Updated narration');

    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith({ content: 'Updated narration' });
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('should show error message on save failure', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue({
      response: { data: { error: { message: 'Not found' } } },
    });
    render(<EditNarrationModal {...defaultProps} onSave={onSave} />);

    const textarea = screen.getByDisplayValue('Original narration');
    await user.clear(textarea);
    await user.type(textarea, 'Changed');

    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Not found')).toBeInTheDocument();
    });
  });
});

describe('EditRoundSummaryModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    initialContent: 'Original summary',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    render(<EditRoundSummaryModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Edit Round Summary')).not.toBeInTheDocument();
  });

  it('should render with initial content', () => {
    render(<EditRoundSummaryModal {...defaultProps} />);
    expect(screen.getByText('Edit Round Summary')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Original summary')).toBeInTheDocument();
  });

  it('should call onSave with updated content', async () => {
    const user = userEvent.setup();
    render(<EditRoundSummaryModal {...defaultProps} />);

    const textarea = screen.getByDisplayValue('Original summary');
    await user.clear(textarea);
    await user.type(textarea, 'Updated summary');

    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith({ content: 'Updated summary' });
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('should close on Cancel click', async () => {
    const user = userEvent.setup();
    render(<EditRoundSummaryModal {...defaultProps} />);

    await user.click(screen.getByText('Cancel'));

    expect(defaultProps.onSave).not.toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
