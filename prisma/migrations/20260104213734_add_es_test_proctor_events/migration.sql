-- AlterTable: Make attemptId nullable to support both TestAttempt and ESTestAttempt (only if not already nullable)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ProctorEvent' 
        AND column_name = 'attemptId' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "ProctorEvent" ALTER COLUMN "attemptId" DROP NOT NULL;
    END IF;
END $$;

-- AlterTable: Add esAttemptId column for ESTestAttempt relation (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ProctorEvent' 
        AND column_name = 'esAttemptId'
    ) THEN
        ALTER TABLE "ProctorEvent" ADD COLUMN "esAttemptId" TEXT;
    END IF;
END $$;

-- CreateIndex: Add index on esAttemptId for performance (only if it doesn't exist)
CREATE INDEX IF NOT EXISTS "ProctorEvent_esAttemptId_idx" ON "ProctorEvent"("esAttemptId");

-- AddForeignKey: Add foreign key constraint for ESTestAttempt relation (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'ProctorEvent_esAttemptId_fkey'
    ) THEN
        ALTER TABLE "ProctorEvent" ADD CONSTRAINT "ProctorEvent_esAttemptId_fkey" FOREIGN KEY ("esAttemptId") REFERENCES "ESTestAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
