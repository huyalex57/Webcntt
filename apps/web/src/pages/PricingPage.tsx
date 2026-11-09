import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { useToast } from '../lib/toast';
import { Badge, Button, Card, PageHeader } from '../components/ui';

export default function PricingPage() {
  const { user, upgradeToPremium } = useAuth(); const toast = useToast(); const nav = useNavigate();
  const [processing, setProcessing] = useState(false);
  const upgrade = async () => {
    if (!user) { nav('/login', { state: { redirect: '/pricing' } }); toast.push('Đăng nhập để nâng cấp Premium', 'info'); return; }
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 900));
    upgradeToPremium(); setProcessing(false);
    toast.push('Nâng cấp Premium thành công (mock — bản thật: webhook thanh toán xác nhận mới kích hoạt gói)');
    nav('/dashboard');
  };
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader title="Nâng cấp Premium" subtitle="Gói dịch vụ là thuộc tính độc lập của tài khoản — Premium không thay đổi role của bạn (workflow §1.2)." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6"><h3 className="text-lg font-bold">FREE</h3><p className="mt-1 text-2xl font-bold">0đ <span className="text-sm font-normal text-slate-500">/ mãi mãi</span></p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600"><li>✓ Tải tài liệu không giới hạn tốc độ</li><li>✓ AI luyện tập: 10 câu/ngày</li><li>✓ Playground: 256 MB RAM, timeout 2s, 30 lần chạy/ngày, 3 snippet</li><li>✓ Tham gia kỳ thi khi được mời</li><li>✗ Giảng viên Free: tạo tài liệu/khoá học, nhưng không tạo được bài thi</li></ul>
          <p className="mt-4 text-sm text-slate-500">Gói hiện tại của bạn: {user ? user.plan : 'Guest'}</p></Card>
        <Card className="border-primary p-6"><div className="flex items-center gap-2"><h3 className="text-lg font-bold">PREMIUM</h3><Badge color="navy">Khuyên dùng</Badge></div><p className="mt-1 text-2xl font-bold">99.000đ <span className="text-sm font-normal text-slate-500">/ tháng</span></p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600"><li>✓ AI không giới hạn + phân tích sâu, spaced repetition, sinh từ tài liệu</li><li>✓ Playground: 1 GB RAM, timeout 10s, 200 lần chạy/ngày, 50 snippet, đa file</li><li>✓ LECTURER Premium: tạo bài thi lập trình, chấm tự động, xuất bảng điểm</li><li>✓ Báo cáo tiến độ: biểu đồ điểm yếu theo chủ đề</li><li>✗ Premium không cấp role mới — STUDENT Premium vẫn không tạo được khoá học/bài thi</li></ul>
          <Button className="mt-5 w-full" disabled={processing || user?.plan === 'PREMIUM'} onClick={upgrade}>{user?.plan === 'PREMIUM' ? 'Bạn đang dùng Premium' : processing ? 'Đang xử lý thanh toán (mock)…' : 'Nâng cấp Premium ngay'}</Button>
          <p className="mt-2 text-xs text-slate-500">Mock checkout: bấm nút là kích hoạt ngay. Bản thật: VNPay/MoMo/Stripe + webhook xác nhận mới kích hoạt gói (business flow §8).</p></Card>
      </div>
    </div>
  );
}
