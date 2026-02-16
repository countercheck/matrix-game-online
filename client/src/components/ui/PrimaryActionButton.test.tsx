import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PrimaryActionButton } from './PrimaryActionButton';

describe('PrimaryActionButton', () => {
  it('renders children correctly', () => {
    render(<PrimaryActionButton>Click Me</PrimaryActionButton>);
    expect(screen.getByRole('button', { name: 'Click Me' })).toBeInTheDocument();
  });

  it('shows loading text when loading', () => {
    render(
      <PrimaryActionButton loading loadingText="Loading...">
        Submit
      </PrimaryActionButton>
    );
    expect(screen.getByRole('button', { name: 'Loading...' })).toBeInTheDocument();
  });

  it('shows children when loading without loadingText', () => {
    render(<PrimaryActionButton loading>Submit</PrimaryActionButton>);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });

  it('is disabled when loading', () => {
    render(<PrimaryActionButton loading>Submit</PrimaryActionButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled when disabled prop is true', () => {
    render(<PrimaryActionButton disabled>Submit</PrimaryActionButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<PrimaryActionButton onClick={handleClick}>Click Me</PrimaryActionButton>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <PrimaryActionButton onClick={handleClick} disabled>
        Click Me
      </PrimaryActionButton>
    );

    await user.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('has type="button" by default', () => {
    render(<PrimaryActionButton>Submit</PrimaryActionButton>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('can override type attribute', () => {
    render(<PrimaryActionButton type="submit">Submit</PrimaryActionButton>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('applies custom className', () => {
    render(<PrimaryActionButton className="custom-class">Submit</PrimaryActionButton>);
    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });

  it('is full width by default', () => {
    render(<PrimaryActionButton>Submit</PrimaryActionButton>);
    expect(screen.getByRole('button')).toHaveClass('w-full');
  });

  it('can disable full width', () => {
    render(<PrimaryActionButton fullWidth={false}>Submit</PrimaryActionButton>);
    expect(screen.getByRole('button')).not.toHaveClass('w-full');
  });
});
