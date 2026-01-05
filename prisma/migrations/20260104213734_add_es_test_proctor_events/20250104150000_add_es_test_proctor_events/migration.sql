-- AlterTable: Make attemptId nullable to support both TestAttempt and ESTestAttempt
ALTER TABLE "ProctorEvent" ALTER COLUMN "attemptId" DROP NOT NULL;

-- AlterTable: Add esAttemptId column for ESTestAttempt relation
ALTER TABLE "ProctorEvent" ADD COLUMN "esAttemptId" TEXT;

-- CreateIndex: Add index on esAttemptId for performance
CREATE INDEX "ProctorEvent_esAttemptId_idx" ON "ProctorEvent"("esAttemptId");

-- AddForeignKey: Add foreign key constraint for ESTestAttempt relation
ALTER TABLE "ProctorEvent" ADD CONSTRAINT "ProctorEvent_esAttemptId_fkey" FOREIGN KEY ("esAttemptId") REFERENCES "ESTestAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

