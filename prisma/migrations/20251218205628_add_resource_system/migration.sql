-- CreateEnum
CREATE TYPE "ResourceScope" AS ENUM ('CLUB', 'PUBLIC');

-- CreateEnum
CREATE TYPE "ResourceRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "url" TEXT,
    "category" TEXT NOT NULL,
    "scope" "ResourceScope" NOT NULL DEFAULT 'CLUB',
    "clubId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "url" TEXT,
    "category" TEXT NOT NULL,
    "scope" "ResourceScope" NOT NULL DEFAULT 'PUBLIC',
    "clubId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "ResourceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Resource_category_idx" ON "Resource"("category");

-- CreateIndex
CREATE INDEX "Resource_clubId_idx" ON "Resource"("clubId");

-- CreateIndex
CREATE INDEX "Resource_scope_idx" ON "Resource"("scope");

-- CreateIndex
CREATE INDEX "ResourceRequest_status_idx" ON "ResourceRequest"("status");

-- CreateIndex
CREATE INDEX "ResourceRequest_clubId_idx" ON "ResourceRequest"("clubId");

-- CreateIndex
CREATE INDEX "ResourceRequest_requestedById_idx" ON "ResourceRequest"("requestedById");

-- CreateIndex
CREATE INDEX "ResourceRequest_createdAt_idx" ON "ResourceRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

