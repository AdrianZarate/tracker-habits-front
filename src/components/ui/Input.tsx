import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({
  label,
  error,
  className = '',
  ...props
}: InputProps) {
  return (
    <div className='flex flex-col gap-1'>
      {label && <label className='text-sm text-dark-muted'>{label}</label>}
      <input
        className={`min-h-11 w-full min-w-0 rounded-lg border bg-dark-bg px-4 py-2.5 text-dark-text placeholder:text-dark-muted disabled:opacity-60
          ${error ? 'border-red-300' : 'border-dark-border focus:border-dark-accent'}
          aria-[invalid=true]:border-red-300
          ${className}`}
        {...props}
      />
      {error && <p className='text-sm text-red-300'>{error}</p>}
    </div>
  );
}
