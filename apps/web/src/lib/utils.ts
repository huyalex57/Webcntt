export const formatVND = (n: number) => n.toLocaleString('vi-VN') + 'đ';
export const formatDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
export const formatDateTime = (iso: string) => new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const todayKey = () => new Date().toISOString().slice(0, 10);
/** Đếm lượt dùng theo ngày trong localStorage (quota AI Free 10 câu/ngày). */
export function getDailyCount(key: string): number {
  try { const raw = localStorage.getItem(`dsh:${key}:${todayKey()}`); return raw ? parseInt(raw, 10) || 0 : 0; } catch { return 0; }
}
export function addDailyCount(key: string, n = 1): number {
  const v = getDailyCount(key) + n;
  try { localStorage.setItem(`dsh:${key}:${todayKey()}`, String(v)); } catch { /* ignore */ }
  return v;
}
export function loadJSON<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(`dsh:${key}`); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
export function saveJSON(key: string, value: unknown) { try { localStorage.setItem(`dsh:${key}`, JSON.stringify(value)); } catch { /* ignore */ } }
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
