-- AlterTable: Add default test creation settings to Tournament
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "defaultDurationMinutes" INTEGER;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "defaultStartAt" TIMESTAMP(3);
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "defaultEndAt" TIMESTAMP(3);
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "defaultReleaseScoresAt" TIMESTAMP(3);
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "defaultScoreReleaseMode" "ScoreReleaseMode";
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "defaultRequireFullscreen" BOOLEAN;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "defaultAllowCalculator" BOOLEAN;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "defaultCalculatorType" "CalculatorType";
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "defaultAllowNoteSheet" BOOLEAN;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "defaultAutoApproveNoteSheet" BOOLEAN;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "defaultRequireOneSitting" BOOLEAN;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "defaultMaxAttempts" INTEGER;

