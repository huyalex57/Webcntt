import { Button } from './Button';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}

export function Pagination({ page, totalPages, onPage }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Trước
      </Button>
      <span className="text-sm">Trang {page} / {totalPages}</span>
      <Button variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Sau →
      </Button>
    </div>
  );
}
