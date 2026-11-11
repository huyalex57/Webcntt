import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addComment,
  contributeResource,
  getResource,
  listComments,
  listResources,
  rateResource,
  reportResource,
  type ResourceFilter,
} from '../../../lib/api';
import type { ContributeResourceInput } from '@devstudy/shared';

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

export const useContributeResource = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ContributeResourceInput & { author: string; uploaderId?: string }) =>
      contributeResource(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resources'] });
    },
  });
};

export const useResourceComments = (resourceId: string) =>
  useQuery({
    queryKey: ['resource-comments', resourceId],
    queryFn: () => listComments(resourceId),
    enabled: !!resourceId,
  });

export const useAddComment = (resourceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      author: string;
      userRole?: string;
      content: string;
      rating?: number;
      parentId?: string;
    }) => addComment(resourceId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resource-comments', resourceId] });
      qc.invalidateQueries({ queryKey: ['resource', resourceId] });
      qc.invalidateQueries({ queryKey: ['resources'] });
    },
  });
};

export const useRateResource = (resourceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rating: number) => rateResource(resourceId, rating),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resource', resourceId] });
      qc.invalidateQueries({ queryKey: ['resources'] });
    },
  });
};
