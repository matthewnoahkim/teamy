-- AlterTable
-- Note: Test table already has autoApproveNoteSheet column, only ESTest needs it
ALTER TABLE "ESTest" ADD COLUMN "autoApproveNoteSheet" BOOLEAN NOT NULL DEFAULT true;
