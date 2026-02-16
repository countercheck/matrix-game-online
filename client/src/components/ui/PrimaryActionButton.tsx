import { ButtonHTMLAttributes, forwardRef } from 'react';

interface PrimaryActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
}

/**
 * High-contrast primary action button used for key game actions.
 * Provides consistent styling for "Propose Action", "I'm Done", "Submit Vote", etc.
 */
export const PrimaryActionButton = forwardRef<HTMLButtonElement, PrimaryActionButtonProps>(
  ({ children, loading = false, loadingText, disabled, className = '', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        aria-disabled={disabled || loading}
        className={`w-full py-3 px-8 bg-green-600 text-white text-lg font-bold rounded-lg shadow-lg hover:bg-green-500 active:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 ${className}`}
        {...props}
      >
        {loading && loadingText ? loadingText : children}
      </button>
    );
  }
);

PrimaryActionButton.displayName = 'PrimaryActionButton';
