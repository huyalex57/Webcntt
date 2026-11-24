import { forwardRef, type SelectHTMLAttributes } from 'react';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className = '', ...props },
  ref
) {
  return (
    <select
      ref={ref}
      {...props}
      className={`w-full rounded border border-border-strong bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-1 focus:ring-primary ${className}`}
    />
  );
});
