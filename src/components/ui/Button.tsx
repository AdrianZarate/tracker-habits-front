import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'success' | 'danger' | 'ghost';
  isLoading?: boolean;
}

export default function Button({
  variant = 'primary',
  isLoading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-primary hover:bg-primary-hover text-white',
    success: 'bg-success hover:bg-success-hover text-white',
    danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-400',
    ghost: 'border border-dark-border bg-dark-card hover:bg-dark-bg text-dark-muted hover:text-dark-text',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`ui-action disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className='flex items-center justify-center gap-2'>
          <span aria-hidden='true' className='h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent' />
          Cargando...
        </span>
      ) : (
        children
      )}
    </button>
  );
}
