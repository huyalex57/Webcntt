import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
interface Toast { id: number; message: string; kind: 'success' | 'error' | 'info'; }
const Ctx = createContext<{ push: (message: string, kind?: Toast['kind']) => void } | null>(null);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded border px-4 py-2.5 text-sm font-medium shadow-lg bg-white ${t.kind === 'error' ? 'border-red-200 text-red-700' : t.kind === 'info' ? 'border-sky-200 text-sky-800' : 'border-emerald-200 text-emerald-700'}`}>{t.message}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export function useToast() { const c = useContext(Ctx); if (!c) throw new Error('useToast phải dùng trong ToastProvider'); return c; }
