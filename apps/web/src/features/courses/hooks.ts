import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOrder } from '../../lib/api';
import { loadJSON, saveJSON } from '../../lib/utils';
import type { Enrollment } from '@devstudy/shared';
export function useEnrollments() {
  return loadJSON<Enrollment[]>('enrollments', [
    { courseId: 'c1', progress: 65, completedLessons: 28, totalLessons: 43, certificateIssued: false },
    { courseId: 'c7', progress: 100, completedLessons: 36, totalLessons: 36, certificateIssued: true },
  ]);
}
export function useBuyCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => createOrder(courseId),
    onSuccess: (_res, courseId) => {
      const list = loadJSON<Enrollment[]>('enrollments', []);
      if (!list.some((e) => e.courseId === courseId)) {
        saveJSON('enrollments', [...list, { courseId, progress: 0, completedLessons: 0, totalLessons: 10, certificateIssued: false }]);
      }
      qc.invalidateQueries({ queryKey: ['courses'] });
    },
  });
}
export function useMarkLessonDone(courseId: string) {
  return useMutation({
    mutationFn: async () => { await new Promise((r) => setTimeout(r, 300)); return courseId; },
    onSuccess: () => {
      const list = loadJSON<Enrollment[]>('enrollments', []);
      const next = list.map((e) => {
        if (e.courseId !== courseId) return e;
        const done = Math.min(e.totalLessons, e.completedLessons + 1);
        const progress = Math.round((done / e.totalLessons) * 100);
        return { ...e, completedLessons: done, progress, certificateIssued: progress === 100 };
      });
      saveJSON('enrollments', next);
    },
  });
}
