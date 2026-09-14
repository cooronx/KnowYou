-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "outline" JSONB;

-- CreateTable
CREATE TABLE "Seed" (
    "workId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "labels" TEXT[],
    "description" TEXT NOT NULL DEFAULT '',
    "artwork" TEXT NOT NULL DEFAULT '',
    "authorName" TEXT NOT NULL DEFAULT '',
    "authorAvatar" TEXT NOT NULL DEFAULT '',
    "introduction" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "outline" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Seed_pkey" PRIMARY KEY ("workId")
);

-- CreateIndex
CREATE INDEX "Seed_fetchedAt_idx" ON "Seed"("fetchedAt");
