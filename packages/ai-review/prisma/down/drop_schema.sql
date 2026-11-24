-- Full schema teardown for uninstalling @devstudy/ai-review.
-- Strictly drops ONLY schema "ai_review"; leaves core schema "public" untouched.

DROP SCHEMA IF EXISTS "ai_review" CASCADE;
