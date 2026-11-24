import type {
  AnonymousStudentSummary,
  StudentDirectoryPort,
} from '@devstudy/ai-review/contracts';
import { prisma } from '../../../config/prisma.js';

export function createStudentDirectoryAdapter(): StudentDirectoryPort {
  return {
    async getStudentSummary(userId: string): Promise<AnonymousStudentSummary> {
      const [enrollments, latestPath] = await Promise.all([
        prisma.enrollment.findMany({
          where: { userId },
          select: {
            progress: true,
            course: { select: { slug: true } },
          },
          orderBy: { enrolledAt: 'desc' },
          take: 20,
        }),
        prisma.learningPath.findFirst({
          where: { userId },
          select: { currentLevel: true },
          orderBy: { updatedAt: 'desc' },
        }),
      ]);

      return {
        selfLevel: latestPath?.currentLevel ?? undefined,
        enrolledCourses: enrollments.map((e) => ({
          slug: e.course.slug,
          progress: e.progress,
        })),
      };
    },
  };
}
