import { useMutation } from '@tanstack/react-query';
import { generatePracticeSet } from '../../../lib/api';
import type { PracticeSetRequest } from '@devstudy/shared';

export const useGeneratePracticeSet = () =>
  useMutation({
    mutationFn: (req: PracticeSetRequest) => generatePracticeSet(req),
  });
