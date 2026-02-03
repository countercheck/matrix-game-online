import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { ConfirmDialog, useConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
  };

  it('should not render when isOpen is false', () => {
    render(<ConfirmDialog {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
  });

  it('should render when isOpen is true', () => {
    render(<ConfirmDialog {...defaultProps} />);

    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
  });

  it('should render default button text', () => {
    render(<ConfirmDialog {...defaultProps} />);

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should render custom button text', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmText="Delete"
        cancelText="Keep"
      />
    );

    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
  });

  it('should call onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    render(<ConfirmDialog {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('should call onConfirm when confirm is clicked', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        {...defaultProps}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('should call onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <ConfirmDialog {...defaultProps} onClose={onClose} />
    );

    // Click the backdrop (first div with bg-black/50)
    const backdrop = container.querySelector('.bg-black\\/50');
    if (backdrop) {
      fireEvent.click(backdrop);
    }

    expect(onClose).toHaveBeenCalled();
  });

  it('should show loading state during async confirm', async () => {
    const onConfirm = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });
  });

  it('should apply danger variant styling', () => {
    render(<ConfirmDialog {...defaultProps} variant="danger" />);

    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    expect(confirmButton).toHaveClass('bg-destructive');
  });

  it('should apply warning variant styling', () => {
    render(<ConfirmDialog {...defaultProps} variant="warning" />);

    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    expect(confirmButton).toHaveClass('bg-yellow-600');
  });
});

describe('useConfirmDialog hook', () => {
  it('should start with dialog closed', () => {
    const { result } = renderHook(() => useConfirmDialog());

    const { ConfirmDialog } = result.current;
    const { container } = render(<ConfirmDialog />);

    // Dialog should not be visible
    expect(container.querySelector('.fixed')).not.toBeInTheDocument();
  });

  it('should open dialog when confirm is called', () => {
    const { result } = renderHook(() => useConfirmDialog());

    act(() => {
      result.current.confirm({
        title: 'Test Title',
        message: 'Test Message',
        onConfirm: vi.fn(),
      });
    });

    const { ConfirmDialog } = result.current;
    render(<ConfirmDialog />);

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Message')).toBeInTheDocument();
  });

  it('should close dialog when close is called', () => {
    const { result } = renderHook(() => useConfirmDialog());

    // Open dialog
    act(() => {
      result.current.confirm({
        title: 'Test',
        message: 'Test',
        onConfirm: vi.fn(),
      });
    });

    // Close dialog
    act(() => {
      result.current.close();
    });

    const { ConfirmDialog } = result.current;
    const { container } = render(<ConfirmDialog />);

    expect(container.querySelector('.fixed')).not.toBeInTheDocument();
  });
});
