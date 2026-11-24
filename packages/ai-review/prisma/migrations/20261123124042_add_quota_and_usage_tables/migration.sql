-- CreateTable
CREATE TABLE "plan_limits" (
    "plan_code" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "limit_value" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_limits_pkey" PRIMARY KEY ("plan_code","metric")
);

-- CreateTable
CREATE TABLE "usage_counters" (
    "user_id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("user_id","metric","period_key")
);

-- CreateTable
CREATE TABLE "usage_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "plan_code" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "limit_snapshot" INTEGER,
    "request_id" TEXT,
    "model_id" TEXT,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usage_counters_period_key_idx" ON "usage_counters"("period_key");

-- CreateIndex
CREATE INDEX "usage_events_user_id_created_at_idx" ON "usage_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "usage_events_user_id_metric_period_key_idx" ON "usage_events"("user_id", "metric", "period_key");

-- CreateIndex
CREATE INDEX "usage_events_created_at_idx" ON "usage_events"("created_at");

-- Seed default plan_limits (FREE & PREMIUM)
INSERT INTO "plan_limits" ("plan_code", "metric", "period", "limit_value", "updated_at")
VALUES
    ('FREE', 'exam_sets', 'day', 3, CURRENT_TIMESTAMP),
    ('PREMIUM', 'exam_sets', 'day', 30, CURRENT_TIMESTAMP),
    ('FREE', 'llm_tokens', 'month', 150000, CURRENT_TIMESTAMP),
    ('PREMIUM', 'llm_tokens', 'month', 5000000, CURRENT_TIMESTAMP)
ON CONFLICT ("plan_code", "metric") DO NOTHING;
