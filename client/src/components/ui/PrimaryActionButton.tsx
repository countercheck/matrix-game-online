import { ButtonHTMLAttributes, forwardRef } from 'react';

interface PrimaryActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
}

/**
 * High-contrast primary action button used for key game actions.
 * Provides consistent styling for "Propose Action", "I'm Done", "Submit Vote", etc.
 */
export const PrimaryActionButton = forwardRef<HTMLButtonElement, PrimaryActionButtonProps>(
  (
    {
      children,
      loading = false,
      loadingText,
      disabled,
      fullWidth = true,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        className={`${fullWidth ? 'w-full' : ''} py-3 px-8 bg-primary text-primary-foreground text-lg font-bold rounded-lg shadow-lg hover:bg-primary/90 active:bg-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${className}`}
        {...props}
      >
        {loading && loadingText ? loadingText : children}
      </button>
    );
  }
);

PrimaryActionButton.displayName = 'PrimaryActionButton';
