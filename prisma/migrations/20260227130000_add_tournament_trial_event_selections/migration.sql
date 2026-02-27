-- CreateTable: TournamentTrialEventSelection
CREATE TABLE IF NOT EXISTS "TournamentTrialEventSelection" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventDivision" "Division" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentTrialEventSelection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TournamentTrialEventSelection_registrationId_eventName_eventDivision_key"
ON "TournamentTrialEventSelection"("registrationId", "eventName", "eventDivision");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TournamentTrialEventSelection_registrationId_idx"
ON "TournamentTrialEventSelection"("registrationId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'TournamentTrialEventSelection_registrationId_fkey'
    ) THEN
        ALTER TABLE "TournamentTrialEventSelection"
        ADD CONSTRAINT "TournamentTrialEventSelection_registrationId_fkey"
        FOREIGN KEY ("registrationId") REFERENCES "TournamentRegistration"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;
