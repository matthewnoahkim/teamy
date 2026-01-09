-- AlterTable: Add default test taking window fields to Tournament
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "defaultStartAt" TIMESTAMP(3);
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "defaultEndAt" TIMESTAMP(3);

