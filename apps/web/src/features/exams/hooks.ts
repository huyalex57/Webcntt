import { useMutation, useQuery } from '@tanstack/react-query';
import { createExam, getExam, listExams } from '../../lib/api';
import type { CreateExamInput } from '@devstudy/shared';
export const useExams = () => useQuery({ queryKey: ['exams'], queryFn: listExams });
export const useExam = (id: string) => useQuery({ queryKey: ['exam', id], queryFn: () => getExam(id) });
export const useCreateExam = () => useMutation({ mutationFn: (input: CreateExamInput) => createExam(input) });
