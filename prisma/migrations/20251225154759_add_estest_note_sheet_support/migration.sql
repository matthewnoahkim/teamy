-- AlterTable
ALTER TABLE "NoteSheet" 
  ADD COLUMN IF NOT EXISTS "esTestId" TEXT,
  ALTER COLUMN "testId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "NoteSheet" 
  ADD CONSTRAINT "NoteSheet_esTestId_fkey" 
  FOREIGN KEY ("esTestId") 
  REFERENCES "ESTest"("id") 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NoteSheet_esTestId_idx" ON "NoteSheet"("esTestId");

-- CreateUniqueConstraint (Note: Prisma will handle this, but adding for completeness)
-- Note: The unique constraint on nullable fields allows multiple NULLs
-- We need to ensure exactly one of testId or esTestId is set (application-level validation)
