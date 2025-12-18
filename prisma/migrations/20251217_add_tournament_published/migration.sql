-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Tournament_published_idx" ON "Tournament"("published");

