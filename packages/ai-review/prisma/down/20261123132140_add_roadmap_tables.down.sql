-- Rollback for 20261123132140_add_roadmap_tables (strictly scoped to schema "ai_review")

BEGIN;

DROP TABLE IF EXISTS "ai_review"."topic_tag_map";
DROP TABLE IF EXISTS "ai_review"."roadmap_topics";
DROP TABLE IF EXISTS "ai_review"."roadmaps";
DROP TABLE IF EXISTS "ai_review"."roadmap_sources";

DELETE FROM "ai_review"."_prisma_migrations"
WHERE "migration_name" = '20261123132140_add_roadmap_tables';

COMMIT;
