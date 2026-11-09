import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { AuthProvider } from '../features/auth/AuthContext';
import { ToastProvider } from '../lib/toast';
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  return <QueryClientProvider client={client}><AuthProvider><ToastProvider>{children}</ToastProvider></AuthProvider></QueryClientProvider>;
}
