import { z } from 'zod';

export const LessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  durationMin: z.number(),
  free: z.boolean().default(false),
  done: z.boolean().default(false),
});
export type Lesson = z.infer<typeof LessonSchema>;

export const SectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  lessons: z.array(LessonSchema),
});
export type Section = z.infer<typeof SectionSchema>;

export const CourseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  instructor: z.string(),
  instructorRole: z.string(),
  category: z.string(),
  price: z.number(),
  originalPrice: z.number(),
  rating: z.number(),
  ratingCount: z.number(),
  students: z.number(),
  hours: z.number(),
  lessonsCount: z.number(),
  labs: z.number(),
  level: z.enum(['Cơ bản', 'Trung cấp', 'Nâng cao']),
  tags: z.array(z.string()),
  sections: z.array(SectionSchema),
  certificate: z.boolean().default(true),
});
export type Course = z.infer<typeof CourseSchema>;

export const EnrollmentSchema = z.object({
  courseId: z.string(),
  progress: z.number().min(0).max(100),
  completedLessons: z.number(),
  totalLessons: z.number(),
  certificateIssued: z.boolean().default(false),
});
export type Enrollment = z.infer<typeof EnrollmentSchema>;
