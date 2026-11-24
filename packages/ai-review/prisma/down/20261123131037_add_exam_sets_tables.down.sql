-- Rollback for 20261123131037_add_exam_sets_tables (strictly scoped to schema "ai_review")

BEGIN;

DROP TABLE IF EXISTS "ai_review"."exam_set_items";
DROP TABLE IF EXISTS "ai_review"."exam_sets";

DELETE FROM "ai_review"."_prisma_migrations"
WHERE "migration_name" = '20261123131037_add_exam_sets_tables';

COMMIT;
