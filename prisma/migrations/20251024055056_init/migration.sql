-- CreateEnum
CREATE TYPE "Division" AS ENUM ('B', 'C');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CAPTAIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "AnnouncementScope" AS ENUM ('TEAM', 'SUBTEAM');

-- CreateEnum
CREATE TYPE "CalendarScope" AS ENUM ('PERSONAL', 'SUBTEAM', 'TEAM');

-- CreateEnum
CREATE TYPE "RSVPStatus" AS ENUM ('YES', 'NO');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CheckInSource" AS ENUM ('CODE', 'MANUAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "division" "Division" NOT NULL,
    "createdById" TEXT NOT NULL,
    "captainInviteCodeHash" TEXT NOT NULL,
    "memberInviteCodeHash" TEXT NOT NULL,
    "captainInviteCodeEncrypted" TEXT NOT NULL,
    "memberInviteCodeEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "subteamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subteam" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subteam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "division" "Division" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "maxCompetitors" INTEGER NOT NULL DEFAULT 2,
    "selfScheduled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictGroup" (
    "id" TEXT NOT NULL,
    "division" "Division" NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflictGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictGroupEvent" (
    "id" TEXT NOT NULL,
    "conflictGroupId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflictGroupEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterAssignment" (
    "id" TEXT NOT NULL,
    "subteamId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "calendarEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementReply" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnouncementReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "announcementId" TEXT,
    "eventId" TEXT,
    "replyId" TEXT,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementVisibility" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "scope" "AnnouncementScope" NOT NULL,
    "subteamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementVisibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "scope" "CalendarScope" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startUTC" TIMESTAMP(3) NOT NULL,
    "endUTC" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "color" TEXT,
    "rsvpEnabled" BOOLEAN NOT NULL DEFAULT true,
    "subteamId" TEXT,
    "attendeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRSVP" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "RSVPStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRSVP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT,
    "toUserId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "calendarEventId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "graceMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCheckIn" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "source" "CheckInSource" NOT NULL,
    "reason" TEXT,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCodeAttempt" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,

    CONSTRAINT "AttendanceCodeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Team_createdById_idx" ON "Team"("createdById");

-- CreateIndex
CREATE INDEX "Membership_teamId_idx" ON "Membership"("teamId");

-- CreateIndex
CREATE INDEX "Membership_subteamId_idx" ON "Membership"("subteamId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_teamId_key" ON "Membership"("userId", "teamId");

-- CreateIndex
CREATE INDEX "Subteam_teamId_idx" ON "Subteam"("teamId");

-- CreateIndex
CREATE INDEX "Event_division_idx" ON "Event"("division");

-- CreateIndex
CREATE UNIQUE INDEX "Event_division_slug_key" ON "Event"("division", "slug");

-- CreateIndex
CREATE INDEX "ConflictGroup_division_idx" ON "ConflictGroup"("division");

-- CreateIndex
CREATE UNIQUE INDEX "ConflictGroup_division_blockNumber_key" ON "ConflictGroup"("division", "blockNumber");

-- CreateIndex
CREATE INDEX "ConflictGroupEvent_eventId_idx" ON "ConflictGroupEvent"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "ConflictGroupEvent_conflictGroupId_eventId_key" ON "ConflictGroupEvent"("conflictGroupId", "eventId");

-- CreateIndex
CREATE INDEX "RosterAssignment_subteamId_eventId_idx" ON "RosterAssignment"("subteamId", "eventId");

-- CreateIndex
CREATE INDEX "RosterAssignment_eventId_idx" ON "RosterAssignment"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterAssignment_membershipId_eventId_key" ON "RosterAssignment"("membershipId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Announcement_calendarEventId_key" ON "Announcement"("calendarEventId");

-- CreateIndex
CREATE INDEX "Announcement_teamId_idx" ON "Announcement"("teamId");

-- CreateIndex
CREATE INDEX "Announcement_authorId_idx" ON "Announcement"("authorId");

-- CreateIndex
CREATE INDEX "Announcement_createdAt_idx" ON "Announcement"("createdAt");

-- CreateIndex
CREATE INDEX "Announcement_calendarEventId_idx" ON "Announcement"("calendarEventId");

-- CreateIndex
CREATE INDEX "AnnouncementReply_announcementId_idx" ON "AnnouncementReply"("announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementReply_authorId_idx" ON "AnnouncementReply"("authorId");

-- CreateIndex
CREATE INDEX "AnnouncementReply_createdAt_idx" ON "AnnouncementReply"("createdAt");

-- CreateIndex
CREATE INDEX "Reaction_announcementId_idx" ON "Reaction"("announcementId");

-- CreateIndex
CREATE INDEX "Reaction_eventId_idx" ON "Reaction"("eventId");

-- CreateIndex
CREATE INDEX "Reaction_replyId_idx" ON "Reaction"("replyId");

-- CreateIndex
CREATE INDEX "Reaction_userId_idx" ON "Reaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_userId_announcementId_emoji_key" ON "Reaction"("userId", "announcementId", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_userId_eventId_emoji_key" ON "Reaction"("userId", "eventId", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_userId_replyId_emoji_key" ON "Reaction"("userId", "replyId", "emoji");

-- CreateIndex
CREATE INDEX "AnnouncementVisibility_announcementId_idx" ON "AnnouncementVisibility"("announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementVisibility_subteamId_idx" ON "AnnouncementVisibility"("subteamId");

-- CreateIndex
CREATE INDEX "CalendarEvent_teamId_idx" ON "CalendarEvent"("teamId");

-- CreateIndex
CREATE INDEX "CalendarEvent_creatorId_idx" ON "CalendarEvent"("creatorId");

-- CreateIndex
CREATE INDEX "CalendarEvent_subteamId_idx" ON "CalendarEvent"("subteamId");

-- CreateIndex
CREATE INDEX "CalendarEvent_attendeeId_idx" ON "CalendarEvent"("attendeeId");

-- CreateIndex
CREATE INDEX "CalendarEvent_startUTC_idx" ON "CalendarEvent"("startUTC");

-- CreateIndex
CREATE INDEX "EventRSVP_eventId_idx" ON "EventRSVP"("eventId");

-- CreateIndex
CREATE INDEX "EventRSVP_userId_idx" ON "EventRSVP"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventRSVP_eventId_userId_key" ON "EventRSVP"("eventId", "userId");

-- CreateIndex
CREATE INDEX "EmailLog_announcementId_idx" ON "EmailLog"("announcementId");

-- CreateIndex
CREATE INDEX "EmailLog_toUserId_idx" ON "EmailLog"("toUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_calendarEventId_key" ON "Attendance"("calendarEventId");

-- CreateIndex
CREATE INDEX "Attendance_teamId_idx" ON "Attendance"("teamId");

-- CreateIndex
CREATE INDEX "Attendance_calendarEventId_idx" ON "Attendance"("calendarEventId");

-- CreateIndex
CREATE INDEX "Attendance_status_idx" ON "Attendance"("status");

-- CreateIndex
CREATE INDEX "AttendanceCheckIn_attendanceId_idx" ON "AttendanceCheckIn"("attendanceId");

-- CreateIndex
CREATE INDEX "AttendanceCheckIn_userId_idx" ON "AttendanceCheckIn"("userId");

-- CreateIndex
CREATE INDEX "AttendanceCheckIn_membershipId_idx" ON "AttendanceCheckIn"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceCheckIn_attendanceId_userId_key" ON "AttendanceCheckIn"("attendanceId", "userId");

-- CreateIndex
CREATE INDEX "AttendanceCodeAttempt_attendanceId_userId_attemptedAt_idx" ON "AttendanceCodeAttempt"("attendanceId", "userId", "attemptedAt");

-- CreateIndex
CREATE INDEX "AttendanceCodeAttempt_attendanceId_ipAddress_attemptedAt_idx" ON "AttendanceCodeAttempt"("attendanceId", "ipAddress", "attemptedAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_subteamId_fkey" FOREIGN KEY ("subteamId") REFERENCES "Subteam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subteam" ADD CONSTRAINT "Subteam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictGroupEvent" ADD CONSTRAINT "ConflictGroupEvent_conflictGroupId_fkey" FOREIGN KEY ("conflictGroupId") REFERENCES "ConflictGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictGroupEvent" ADD CONSTRAINT "ConflictGroupEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterAssignment" ADD CONSTRAINT "RosterAssignment_subteamId_fkey" FOREIGN KEY ("subteamId") REFERENCES "Subteam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterAssignment" ADD CONSTRAINT "RosterAssignment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterAssignment" ADD CONSTRAINT "RosterAssignment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementReply" ADD CONSTRAINT "AnnouncementReply_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementReply" ADD CONSTRAINT "AnnouncementReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "AnnouncementReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementVisibility" ADD CONSTRAINT "AnnouncementVisibility_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementVisibility" ADD CONSTRAINT "AnnouncementVisibility_subteamId_fkey" FOREIGN KEY ("subteamId") REFERENCES "Subteam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_subteamId_fkey" FOREIGN KEY ("subteamId") REFERENCES "Subteam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRSVP" ADD CONSTRAINT "EventRSVP_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRSVP" ADD CONSTRAINT "EventRSVP_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCheckIn" ADD CONSTRAINT "AttendanceCheckIn_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCheckIn" ADD CONSTRAINT "AttendanceCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCheckIn" ADD CONSTRAINT "AttendanceCheckIn_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCodeAttempt" ADD CONSTRAINT "AttendanceCodeAttempt_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
