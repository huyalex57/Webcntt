import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';

export interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string, detail: string) => Promise<void>;
}

export function ReportModal({ open, onClose, onSubmit }: ReportModalProps) {
  const [reason, setReason] = useState('BAN_QUYEN');
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
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="BAN_QUYEN">Vi phạm bản quyền học liệu</option>
            <option value="SAI_LECH">Nội dung học vụ sai lệch / lỗi thời</option>
            <option value="SPAM">Spam / tài liệu rác</option>
            <option value="KHAC">Lý do khác</option>
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
          <Button variant="outline" onClick={onClose}>
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
