import { Link } from 'react-router-dom';
import { Badge } from '../../../components/ui/Badge';
import { QuotaBar } from '../../../components/ui/QuotaBar';
import type { AiReviewQuotaSnapshotDto, ApiQuotaErrorShape } from '../api/types';

export interface AiReviewQuotaCardProps {
  quota: AiReviewQuotaSnapshotDto | undefined;
  isLoading: boolean;
  quotaError: ApiQuotaErrorShape | null;
}

function formatResetTime(iso: string | undefined, timezone: string = 'Asia/Ho_Chi_Minh'): string {
  if (!iso) return '00:00 hôm sau';
  try {
    const dt = new Date(iso);
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    }).format(dt);
  } catch {
    return iso;
  }
}

function formatTokens(value: number | null): string {
  if (value === null) return 'Không giới hạn';
  return value.toLocaleString('vi-VN');
}

export function AiReviewQuotaCard({ quota, isLoading, quotaError }: AiReviewQuotaCardProps) {
  if (isLoading) {
    return (
      <div className="rounded border border-border bg-surface p-3 text-xs text-slate-500">
        Đang tải hạn mức AI Review…
      </div>
    );
  }

  if (!quota) {
    return null;
  }

  const examQuota = quota.quotas.exam_sets;
  const tokenQuota = quota.quotas.llm_tokens;
  const examLimit = examQuota.limit ?? Infinity;
  const tokenLimit = tokenQuota.limit ?? Infinity;

  return (
    <div
      className="rounded-lg border border-border bg-surface p-3.5 space-y-3"
      data-testid="ai-review-quota-card"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-700">Hạn mức AI Ôn tập</span>
        <Badge color={quota.plan === 'PREMIUM' ? 'green' : 'navy'}>
          Gói {quota.plan}
        </Badge>
      </div>

      <div>
        <QuotaBar
          used={examQuota.used}
          limit={examLimit}
          label="Bộ đề 20 câu hôm nay"
        />
        <p className="mt-1 text-[11px] text-slate-500">
          Còn lại: <strong>{examQuota.remaining ?? '∞'}</strong> · Làm mới lúc{' '}
          {formatResetTime(examQuota.resetAt, quota.timezone)} (giờ VN)
        </p>
      </div>

      <div>
        <QuotaBar
          used={tokenQuota.used}
          limit={tokenLimit}
          label="Token AI chu kỳ tháng"
        />
        <p className="mt-1 text-[11px] text-slate-500">
          Đã dùng {formatTokens(tokenQuota.used)} / {formatTokens(tokenQuota.limit)} token · Làm mới{' '}
          {formatResetTime(tokenQuota.resetAt, quota.timezone)}
        </p>
      </div>

      {quotaError && (
        <div
          role="alert"
          data-testid="ai-quota-exceeded-alert"
          className="rounded border border-red-200 bg-red-50 p-2.5 text-xs text-red-800"
        >
          <p className="font-semibold">
            {quotaError.message || 'Bạn đã dùng hết hạn mức AI trong chu kỳ hiện tại.'}
          </p>
          {quotaError.details?.reset_at && (
            <p className="mt-1">
              Thời điểm làm mới:{' '}
              <strong>{formatResetTime(quotaError.details.reset_at, quota.timezone)}</strong>
              {quotaError.details.retry_after_seconds
                ? ` (sau khoảng ${Math.ceil(quotaError.details.retry_after_seconds / 60)} phút)`
                : ''}
            </p>
          )}
          {quota.plan === 'FREE' && (
            <p className="mt-1">
              <Link to="/pricing" className="font-semibold underline">
                Nâng cấp Premium
              </Link>{' '}
              để tăng lên 30 bộ đề/ngày và 5.000.000 token/tháng.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
