-- Rollback for 20261123130338_add_audit_and_idempotency_tables (strictly scoped to schema "ai_review")

BEGIN;

DROP TABLE IF EXISTS "ai_review"."audit_events";
DROP TABLE IF EXISTS "ai_review"."idempotency_keys";

DELETE FROM "ai_review"."_prisma_migrations"
WHERE "migration_name" = '20261123130338_add_audit_and_idempotency_tables';

COMMIT;
