-- Rollback for 20261123124042_add_quota_and_usage_tables (strictly scoped to schema "ai_review")

BEGIN;

DROP TABLE IF EXISTS "ai_review"."usage_events";
DROP TABLE IF EXISTS "ai_review"."usage_counters";
DROP TABLE IF EXISTS "ai_review"."plan_limits";

DELETE FROM "ai_review"."_prisma_migrations"
WHERE "migration_name" = '20261123124042_add_quota_and_usage_tables';

COMMIT;
