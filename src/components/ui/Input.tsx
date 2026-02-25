import { InputHTMLAttributes } from 'react';

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
        className={`w-full rounded-lg bg-dark-bg px-4 py-2.5 text-dark-text outline-none ring-1 transition
          ${error ? 'ring-red-400 focus:ring-red-400' : 'ring-dark-muted focus:ring-primary'}
          ${className}`}
        {...props}
      />
      {error && <p className='text-xs text-red-400'>{error}</p>}
    </div>
  );
}
