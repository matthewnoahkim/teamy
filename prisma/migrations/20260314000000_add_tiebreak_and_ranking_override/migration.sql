-- AlterTable: Add isTiebreak to Question (if not exists)
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "isTiebreak" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add isTiebreak to ESTestQuestion (if not exists)
ALTER TABLE "ESTestQuestion" ADD COLUMN IF NOT EXISTS "isTiebreak" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: TournamentRankingOverride (if not exists)
CREATE TABLE IF NOT EXISTS "TournamentRankingOverride" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "overrideRank" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentRankingOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "TournamentRankingOverride_testId_membershipId_key" ON "TournamentRankingOverride"("testId", "membershipId");

-- CreateIndex (if not exists)
CREATE INDEX IF NOT EXISTS "TournamentRankingOverride_tournamentId_idx" ON "TournamentRankingOverride"("tournamentId");

-- CreateIndex (if not exists)
CREATE INDEX IF NOT EXISTS "TournamentRankingOverride_testId_idx" ON "TournamentRankingOverride"("testId");
