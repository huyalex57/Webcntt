export interface FooterProps {
  demo?: boolean;
  className?: string;
}

export function Footer({ demo = true, className = '' }: FooterProps) {
  return (
    <footer className={`border-t border-border bg-white py-6 text-center text-xs text-slate-500 ${className}`}>
      © 2026 DevStudy Hub — Nền tảng Học · Luyện · Thi dành cho sinh viên CNTT.
      {demo ? ' Bản demo dùng dữ liệu mock.' : ''}
    </footer>
  );
}
