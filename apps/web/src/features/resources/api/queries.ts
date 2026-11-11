import { useMutation, useQuery } from '@tanstack/react-query';
import { getResource, listResources, reportResource, type ResourceFilter } from '../../../lib/api';

export const useResources = (f: ResourceFilter = {}) =>
  useQuery({
    queryKey: ['resources', f],
    queryFn: () => listResources(f),
  });

export const useResource = (id: string) =>
  useQuery({
    queryKey: ['resource', id],
    queryFn: () => getResource(id),
    enabled: !!id,
  });

export const useReportResource = () =>
  useMutation({
    mutationFn: ({ id, reason, detail }: { id: string; reason: string; detail: string }) =>
      reportResource(id, reason, detail),
  });
