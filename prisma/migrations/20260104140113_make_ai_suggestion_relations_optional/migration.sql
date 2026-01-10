-- Make AiGradingSuggestion relations optional by dropping foreign key constraints
-- This allows the same table to be used for both club tests (Test/TestAttempt/AttemptAnswer) 
-- and ES tests (ESTest/ESTestAttempt/ESTestAttemptAnswer)

-- Drop foreign key constraints
ALTER TABLE "AiGradingSuggestion" DROP CONSTRAINT IF EXISTS "AiGradingSuggestion_answerId_fkey";
ALTER TABLE "AiGradingSuggestion" DROP CONSTRAINT IF EXISTS "AiGradingSuggestion_attemptId_fkey";
ALTER TABLE "AiGradingSuggestion" DROP CONSTRAINT IF EXISTS "AiGradingSuggestion_questionId_fkey";
ALTER TABLE "AiGradingSuggestion" DROP CONSTRAINT IF EXISTS "AiGradingSuggestion_testId_fkey";
