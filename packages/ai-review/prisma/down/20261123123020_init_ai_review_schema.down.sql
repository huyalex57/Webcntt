-- Rollback for 20261123123020_init_ai_review_schema (strictly scoped to schema "ai_review")

BEGIN;

DROP TABLE IF EXISTS "ai_review"."module_meta";

DELETE FROM "ai_review"."_prisma_migrations"
WHERE "migration_name" = '20261123123020_init_ai_review_schema';

COMMIT;
