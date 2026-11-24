import { useState } from 'react';
import { REPORT_REASON_LABELS, type ReportReason } from '@devstudy/shared';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';

export interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason, detail: string) => Promise<void>;
}

export function ReportModal({ open, onClose, onSubmit }: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason>('BAN_QUYEN');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(reason, detail);
      setDetail('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Báo cáo vi phạm nội dung">
      <div className="space-y-4">
        <Field label="Lý do báo cáo">
          <Select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
            {(Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((key) => (
              <option key={key} value={key}>
                {REPORT_REASON_LABELS[key]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mô tả chi tiết vi phạm *">
          <Textarea
            rows={4}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Mô tả cụ thể trang nào vi phạm, tài liệu gốc ở đâu… (tối thiểu 10 ký tự)"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Huỷ
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Đang gửi…' : 'Gửi báo cáo cho kiểm duyệt viên'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
