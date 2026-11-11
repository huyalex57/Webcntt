import type { Course } from '@devstudy/shared';
import { COURSES } from '../seed/courses';
import { delay, ApiError } from './common';

export async function listCourses(q = ''): Promise<Course[]> {
  await delay();
  return COURSES.filter((c) => !q || (c.title + c.description + c.tags.join(' ')).toLowerCase().includes(q.toLowerCase()));
}

export async function getCourse(id: string): Promise<Course> {
  await delay(200);
  const c = COURSES.find((x) => x.id === id);
  if (!c) throw new ApiError(404, 'Không tìm thấy khoá học');
  return c;
}

/** Mua khoá học: tạo Order PENDING → mô phỏng thanh toán → Enrollment.
 *  Lưu ý: bản thật chỉ webhook thanh toán mới được cấp quyền (workflow §5.3). */
export async function createOrder(courseId: string): Promise<{ orderId: string; status: 'PENDING' | 'PAID' }> {
  await delay(600);
  void courseId;
  return { orderId: `ORD-${Date.now().toString().slice(-6)}`, status: 'PAID' };
}
