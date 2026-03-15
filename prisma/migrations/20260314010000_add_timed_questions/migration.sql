-- Add timed question support
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "timedLimitSeconds" INTEGER;
ALTER TABLE "ESTestQuestion" ADD COLUMN IF NOT EXISTS "timedLimitSeconds" INTEGER;
ALTER TABLE "AttemptAnswer" ADD COLUMN IF NOT EXISTS "timedRevealedAt" TIMESTAMP(3);
ALTER TABLE "AttemptAnswer" ADD COLUMN IF NOT EXISTS "timedSubmittedAt" TIMESTAMP(3);
ALTER TABLE "ESTestAttemptAnswer" ADD COLUMN IF NOT EXISTS "timedRevealedAt" TIMESTAMP(3);
ALTER TABLE "ESTestAttemptAnswer" ADD COLUMN IF NOT EXISTS "timedSubmittedAt" TIMESTAMP(3);
