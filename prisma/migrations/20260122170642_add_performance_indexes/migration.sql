-- Add performance indexes for frequently queried fields.
CREATE INDEX IF NOT EXISTS "Tournament_slug_idx"
ON "Tournament"("slug");

CREATE INDEX IF NOT EXISTS "TournamentRegistration_tournamentId_status_idx"
ON "TournamentRegistration"("tournamentId", "status");

CREATE INDEX IF NOT EXISTS "TestAttempt_membershipId_status_idx"
ON "TestAttempt"("membershipId", "status");

CREATE INDEX IF NOT EXISTS "ESTestAttempt_membershipId_status_idx"
ON "ESTestAttempt"("membershipId", "status");
