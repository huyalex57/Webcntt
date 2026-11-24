import { PrismaClient } from '@ai-review/prisma-client';

export type AiReviewPrismaClient = PrismaClient;

export function createAiReviewPrismaClient(databaseUrl: string): AiReviewPrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}
