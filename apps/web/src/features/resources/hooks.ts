export * from './api';

// Re-export for backward compatibility with old code that imported courses from resources/hooks
export { useCourses, useCourse } from '../courses/api';
