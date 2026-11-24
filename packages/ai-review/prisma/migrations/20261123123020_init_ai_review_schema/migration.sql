-- CreateTable
CREATE TABLE "module_meta" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_meta_pkey" PRIMARY KEY ("key")
);
