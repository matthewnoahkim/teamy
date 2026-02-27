-- CreateTable: TournamentMemberEventAssignment
CREATE TABLE IF NOT EXISTS "TournamentMemberEventAssignment" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentMemberEventAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TournamentMemberEventAssignment_registrationId_membershipId_eventId_key"
ON "TournamentMemberEventAssignment"("registrationId", "membershipId", "eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TournamentMemberEventAssignment_registrationId_idx"
ON "TournamentMemberEventAssignment"("registrationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TournamentMemberEventAssignment_membershipId_idx"
ON "TournamentMemberEventAssignment"("membershipId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TournamentMemberEventAssignment_eventId_idx"
ON "TournamentMemberEventAssignment"("eventId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'TournamentMemberEventAssignment_registrationId_fkey'
    ) THEN
        ALTER TABLE "TournamentMemberEventAssignment"
        ADD CONSTRAINT "TournamentMemberEventAssignment_registrationId_fkey"
        FOREIGN KEY ("registrationId") REFERENCES "TournamentRegistration"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'TournamentMemberEventAssignment_membershipId_fkey'
    ) THEN
        ALTER TABLE "TournamentMemberEventAssignment"
        ADD CONSTRAINT "TournamentMemberEventAssignment_membershipId_fkey"
        FOREIGN KEY ("membershipId") REFERENCES "Membership"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'TournamentMemberEventAssignment_eventId_fkey'
    ) THEN
        ALTER TABLE "TournamentMemberEventAssignment"
        ADD CONSTRAINT "TournamentMemberEventAssignment_eventId_fkey"
        FOREIGN KEY ("eventId") REFERENCES "Event"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- CreateTable: TournamentMemberTrialEventAssignment
CREATE TABLE IF NOT EXISTS "TournamentMemberTrialEventAssignment" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventDivision" "Division" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentMemberTrialEventAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TournamentMemberTrialEventAssignment_registrationId_membershipId_eventName_eventDivision_key"
ON "TournamentMemberTrialEventAssignment"("registrationId", "membershipId", "eventName", "eventDivision");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TournamentMemberTrialEventAssignment_registrationId_idx"
ON "TournamentMemberTrialEventAssignment"("registrationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TournamentMemberTrialEventAssignment_membershipId_idx"
ON "TournamentMemberTrialEventAssignment"("membershipId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'TournamentMemberTrialEventAssignment_registrationId_fkey'
    ) THEN
        ALTER TABLE "TournamentMemberTrialEventAssignment"
        ADD CONSTRAINT "TournamentMemberTrialEventAssignment_registrationId_fkey"
        FOREIGN KEY ("registrationId") REFERENCES "TournamentRegistration"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'TournamentMemberTrialEventAssignment_membershipId_fkey'
    ) THEN
        ALTER TABLE "TournamentMemberTrialEventAssignment"
        ADD CONSTRAINT "TournamentMemberTrialEventAssignment_membershipId_fkey"
        FOREIGN KEY ("membershipId") REFERENCES "Membership"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;
