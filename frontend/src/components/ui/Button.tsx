'use client';
import { forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonState = 'idle' | 'loading' | 'success' | 'error';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brown-600 text-cream-50 hover:bg-brown-700 focus:ring-brown-600',
  secondary: 'bg-gold-600 text-cream-50 hover:bg-gold-700 focus:ring-gold-600',
  ghost:
    'border-2 border-brown-300 text-brown-700 hover:border-brown-500 hover:bg-brown-50 focus:ring-brown-400',
  danger: 'bg-error text-white hover:bg-error-dark focus:ring-error',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-5 py-2.5 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-xl',
};

const stateClasses: Record<ButtonState, string> = {
  idle: '',
  loading: 'opacity-75',
  success: 'bg-green-600 hover:bg-green-600 text-white',
  error: 'bg-red-600 hover:bg-red-600 text-white',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  state?: ButtonState;
  /** Makes the button fill its container */
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    state = 'idle',
    fullWidth = false,
    disabled,
    children,
    className = '',
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading || state === 'loading';
  const showSpinner = state === 'loading';
  const showSuccess = state === 'success';
  const showError = state === 'error';

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-busy={showSpinner}
      className={[
        'inline-flex items-center justify-center gap-2 font-semibold transition',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        state === 'idle' ? variantClasses[variant] : '',
        stateClasses[state],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {showSpinner && (
        <svg
          className="animate-spin h-4 w-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      )}
      {showSuccess && (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M20 6L9 17l-5-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {showError && (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          <path d="M12 8v4m0 4v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
});
