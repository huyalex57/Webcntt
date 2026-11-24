-- CreateTable
CREATE TABLE "exam_sets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "model_id" TEXT,
    "rationale" TEXT,
    "requested" INTEGER NOT NULL DEFAULT 20,
    "fulfilled" INTEGER NOT NULL,
    "rejected_count" INTEGER NOT NULL DEFAULT 0,
    "filled_by_fallback" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_set_items" (
    "exam_set_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "question_id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "reason_code" TEXT NOT NULL,

    CONSTRAINT "exam_set_items_pkey" PRIMARY KEY ("exam_set_id","position")
);

-- CreateIndex
CREATE INDEX "exam_sets_user_id_created_at_idx" ON "exam_sets"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "exam_set_items_question_id_idx" ON "exam_set_items"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_set_items_exam_set_id_question_id_key" ON "exam_set_items"("exam_set_id", "question_id");

-- AddForeignKey
ALTER TABLE "exam_set_items" ADD CONSTRAINT "exam_set_items_exam_set_id_fkey" FOREIGN KEY ("exam_set_id") REFERENCES "exam_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
