import type { ReactNode } from 'react';

export interface CardProps {
  className?: string;
  children: ReactNode;
}

export function Card({ className = '', children }: CardProps) {
  return <div className={`rounded-lg border border-border bg-white ${className}`}>{children}</div>;
}
