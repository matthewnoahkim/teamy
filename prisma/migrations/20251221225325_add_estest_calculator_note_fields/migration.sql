-- AlterTable
ALTER TABLE "ESTest" ADD COLUMN     "allowCalculator" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowNoteSheet" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "calculatorType" "CalculatorType",
ADD COLUMN     "noteSheetInstructions" TEXT;
