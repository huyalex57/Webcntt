import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createOrder, getCourse, listCourses } from '../../../lib/api';
import { COURSES, SEED_ENROLLMENTS } from '../../../lib/seed';
import { loadJSON, saveJSON } from '../../../lib/utils';
import type { Enrollment } from '@devstudy/shared';

const DEFAULT_ENROLLMENTS: Enrollment[] = SEED_ENROLLMENTS;

export const useCourses = (q = '') =>
  useQuery({
    queryKey: ['courses', q],
    queryFn: () => listCourses(q),
  });

export const useCourse = (id: string) =>
  useQuery({
    queryKey: ['course', id],
    queryFn: () => getCourse(id),
    enabled: !!id,
  });

/**
 * Reactive hook for enrollments using TanStack Query
 * Allows automatic UI updates when enrollments change
 */
export function useEnrollments(): Enrollment[] {
  const { data } = useQuery({
    queryKey: ['enrollments'],
    queryFn: () => loadJSON<Enrollment[]>('enrollments', DEFAULT_ENROLLMENTS),
    initialData: () => loadJSON<Enrollment[]>('enrollments', DEFAULT_ENROLLMENTS),
  });
  return data ?? DEFAULT_ENROLLMENTS;
}

export function useBuyCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => createOrder(courseId),
    onSuccess: (_res, courseId) => {
      const list = loadJSON<Enrollment[]>('enrollments', DEFAULT_ENROLLMENTS);
      if (!list.some((e) => e.courseId === courseId)) {
        const targetCourse = COURSES.find((c) => c.id === courseId);
        const totalLessons =
          targetCourse?.sections.reduce((acc, s) => acc + s.lessons.length, 0) ||
          targetCourse?.lessonsCount ||
          10;
        saveJSON('enrollments', [
          ...list,
          {
            courseId,
            progress: 0,
            completedLessons: 0,
            totalLessons,
            certificateIssued: false,
          },
        ]);
      }
      qc.invalidateQueries({ queryKey: ['enrollments'] });
      qc.invalidateQueries({ queryKey: ['courses'] });
    },
  });
}

export function useMarkLessonDone(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await new Promise((r) => setTimeout(r, 300));
      return courseId;
    },
    onSuccess: () => {
      const list = loadJSON<Enrollment[]>('enrollments', DEFAULT_ENROLLMENTS);
      const next = list.map((e) => {
        if (e.courseId !== courseId) return e;
        const done = Math.min(e.totalLessons, e.completedLessons + 1);
        const progress = Math.round((done / e.totalLessons) * 100);
        return { ...e, completedLessons: done, progress, certificateIssued: progress === 100 };
      });
      saveJSON('enrollments', next);
      qc.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });
}
