-- CreateEnum
CREATE TYPE "StudyNoteType" AS ENUM ('NOTE_SHEET', 'BINDER');

-- CreateTable
CREATE TABLE "StudyNote" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "eventSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "noteType" "StudyNoteType" NOT NULL,
    "sheetCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyNote_clubId_idx" ON "StudyNote"("clubId");

-- CreateIndex
CREATE INDEX "StudyNote_membershipId_idx" ON "StudyNote"("membershipId");

-- CreateIndex
CREATE INDEX "StudyNote_eventSlug_idx" ON "StudyNote"("eventSlug");

-- CreateIndex
CREATE UNIQUE INDEX "StudyNote_clubId_membershipId_eventSlug_key" ON "StudyNote"("clubId", "membershipId", "eventSlug");

