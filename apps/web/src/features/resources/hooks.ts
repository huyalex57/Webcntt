import { useQuery } from '@tanstack/react-query';
import { getCourse, getResource, listCourses, listResources, type ResourceFilter } from '../../lib/api';
export const useResources = (f: ResourceFilter) => useQuery({ queryKey: ['resources', f], queryFn: () => listResources(f) });
export const useResource = (id: string) => useQuery({ queryKey: ['resource', id], queryFn: () => getResource(id) });
export const useCourses = (q = '') => useQuery({ queryKey: ['courses', q], queryFn: () => listCourses(q) });
export const useCourse = (id: string) => useQuery({ queryKey: ['course', id], queryFn: () => getCourse(id) });
