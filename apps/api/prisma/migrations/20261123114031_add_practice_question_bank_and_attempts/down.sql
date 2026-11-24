-- Rollback for 20261123114031_add_practice_question_bank_and_attempts
-- Strictly drops only Phase 0 additive tables, enums, and its own Prisma migration record
-- without touching any existing core schema objects or data.
--
-- Usage:
--   npx prisma db execute --file prisma/migrations/20261123114031_add_practice_question_bank_and_attempts/down.sql --schema prisma/schema.prisma
-- Re-apply afterwards:
--   npx prisma migrate deploy

BEGIN;

DROP TABLE IF EXISTS "practice_answers";
DROP TABLE IF EXISTS "practice_attempts";
DROP TABLE IF EXISTS "questions";

DROP TYPE IF EXISTS "QuestionStatus";
DROP TYPE IF EXISTS "QuestionDifficulty";
DROP TYPE IF EXISTS "QuestionLevel";
DROP TYPE IF EXISTS "QuestionType";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261123114031_add_practice_question_bank_and_attempts';

COMMIT;
