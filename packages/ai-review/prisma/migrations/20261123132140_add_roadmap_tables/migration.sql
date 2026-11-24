-- CreateTable
CREATE TABLE "roadmap_sources" (
    "id" TEXT NOT NULL,
    "repo_url" TEXT NOT NULL,
    "commit_sha" TEXT NOT NULL,
    "license_sha256" TEXT NOT NULL,
    "license_name" TEXT NOT NULL,
    "license_option" TEXT NOT NULL DEFAULT 'C',
    "attribution" TEXT NOT NULL,
    "snapshot_checksum" TEXT NOT NULL,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roadmap_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmaps" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "source_id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "deprecated_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roadmaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_topics" (
    "id" TEXT NOT NULL,
    "roadmap_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'topic',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "year" INTEGER,
    "resource_format" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "source_url" TEXT NOT NULL,
    "deprecated_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roadmap_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_tag_map" (
    "topic_id" TEXT NOT NULL,
    "tag_code" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "origin" TEXT NOT NULL DEFAULT 'manual',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "topic_tag_map_pkey" PRIMARY KEY ("topic_id","tag_code")
);

-- CreateIndex
CREATE UNIQUE INDEX "roadmap_sources_repo_url_commit_sha_key" ON "roadmap_sources"("repo_url", "commit_sha");

-- CreateIndex
CREATE UNIQUE INDEX "roadmaps_slug_key" ON "roadmaps"("slug");

-- CreateIndex
CREATE INDEX "roadmaps_deprecated_at_order_index_idx" ON "roadmaps"("deprecated_at", "order_index");

-- CreateIndex
CREATE INDEX "roadmap_topics_roadmap_id_parent_id_order_index_idx" ON "roadmap_topics"("roadmap_id", "parent_id", "order_index");

-- CreateIndex
CREATE INDEX "roadmap_topics_deprecated_at_idx" ON "roadmap_topics"("deprecated_at");

-- CreateIndex
CREATE INDEX "topic_tag_map_tag_code_idx" ON "topic_tag_map"("tag_code");

-- AddForeignKey
ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "roadmap_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_topics" ADD CONSTRAINT "roadmap_topics_roadmap_id_fkey" FOREIGN KEY ("roadmap_id") REFERENCES "roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_topics" ADD CONSTRAINT "roadmap_topics_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "roadmap_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_tag_map" ADD CONSTRAINT "topic_tag_map_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "roadmap_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
