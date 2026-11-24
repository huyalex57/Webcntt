-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'READ_CODE', 'DEBUG');

-- CreateEnum
CREATE TYPE "QuestionLevel" AS ENUM ('CO_BAN', 'TRUNG_BINH', 'NANG_CAO');

-- CreateEnum
CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "topic" "ResourceTopic" NOT NULL,
    "level" "QuestionLevel" NOT NULL DEFAULT 'TRUNG_BINH',
    "type" "QuestionType" NOT NULL DEFAULT 'MCQ',
    "difficulty" "QuestionDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "prompt" TEXT NOT NULL,
    "code" TEXT,
    "options" JSONB NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "estimatedTimeSec" INTEGER NOT NULL DEFAULT 45,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "practiceSetId" TEXT,
    "topic" "ResourceTopic",
    "totalQuestions" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_answers" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "topic" "ResourceTopic" NOT NULL,
    "difficulty" "QuestionDifficulty" NOT NULL,
    "selectedIndex" INTEGER,
    "isCorrect" BOOLEAN NOT NULL,
    "timeSpentMs" INTEGER NOT NULL DEFAULT 0,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "questions_status_topic_difficulty_idx" ON "questions"("status", "topic", "difficulty");

-- CreateIndex
CREATE INDEX "questions_topic_level_type_idx" ON "questions"("topic", "level", "type");

-- CreateIndex
CREATE INDEX "questions_tags_idx" ON "questions" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "practice_attempts_userId_submittedAt_idx" ON "practice_attempts"("userId", "submittedAt");

-- CreateIndex
CREATE INDEX "practice_attempts_userId_topic_idx" ON "practice_attempts"("userId", "topic");

-- CreateIndex
CREATE INDEX "practice_attempts_practiceSetId_idx" ON "practice_attempts"("practiceSetId");

-- CreateIndex
CREATE INDEX "practice_answers_userId_answeredAt_idx" ON "practice_answers"("userId", "answeredAt");

-- CreateIndex
CREATE INDEX "practice_answers_userId_topic_answeredAt_idx" ON "practice_answers"("userId", "topic", "answeredAt");

-- CreateIndex
CREATE INDEX "practice_answers_questionId_idx" ON "practice_answers"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "practice_answers_attemptId_questionId_key" ON "practice_answers"("attemptId", "questionId");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_answers" ADD CONSTRAINT "practice_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "practice_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_answers" ADD CONSTRAINT "practice_answers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_answers" ADD CONSTRAINT "practice_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
