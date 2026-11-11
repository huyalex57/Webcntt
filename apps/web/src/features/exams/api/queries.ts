import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createExam, getExam, listExams } from '../../../lib/api';
import type { CodeLanguage, CreateExamInput, Problem } from '@devstudy/shared';

export const useExams = () =>
  useQuery({
    queryKey: ['exams'],
    queryFn: listExams,
  });

export const useExam = (id: string) =>
  useQuery({
    queryKey: ['exam', id],
    queryFn: () => getExam(id),
    enabled: !!id,
  });

export const useCreateExam = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input: CreateExamInput & { languages: CodeLanguage[]; problems?: Problem[] }
    ) => createExam(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exams'] });
    },
  });
};
