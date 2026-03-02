import { Prisma } from '@prisma/client'

async function transferOwnedClubsOrDelete(
  tx: Prisma.TransactionClient,
  userId: string
) {
  const clubsCreatedByUser = await tx.club.findMany({
    where: { createdById: userId },
    select: { id: true, name: true },
  })

  for (const club of clubsCreatedByUser) {
    const otherAdmin = await tx.membership.findFirst({
      where: {
        clubId: club.id,
        userId: { not: userId },
        role: 'ADMIN',
      },
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    })

    if (otherAdmin) {
      await tx.club.update({
        where: { id: club.id },
        data: { createdById: otherAdmin.userId },
      })
      continue
    }

    const anyMember = await tx.membership.findFirst({
      where: {
        clubId: club.id,
        userId: { not: userId },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, userId: true, role: true },
    })

    if (anyMember) {
      await tx.club.update({
        where: { id: club.id },
        data: { createdById: anyMember.userId },
      })

      if (anyMember.role !== 'ADMIN') {
        await tx.membership.update({
          where: { id: anyMember.id },
          data: { role: 'ADMIN' },
        })
      }
      continue
    }

    // No other members remain in this club; delete it before deleting the owner.
    await tx.club.delete({
      where: { id: club.id },
    })
  }
}

export async function deleteUserAccountData(
  tx: Prisma.TransactionClient,
  userId: string
) {
  await transferOwnedClubsOrDelete(tx, userId)

  // Purge user-linked operational data that does not cascade.
  await tx.aiGradingSuggestion.deleteMany({
    where: {
      OR: [
        { requestedByUserId: userId },
        { acceptedByUserId: userId },
      ],
    },
  })

  await tx.aIRosterGeneration.deleteMany({
    where: { createdById: userId },
  })

  // Scrub non-relational creator references that do not enforce FK constraints.
  await tx.album.updateMany({
    where: { createdById: userId },
    data: { createdById: 'deleted-user' },
  })

  await tx.form.updateMany({
    where: { uploadedById: userId },
    data: { uploadedById: 'deleted-user' },
  })

  await tx.promoCode.updateMany({
    where: { createdById: userId },
    data: { createdById: null },
  })

  await tx.attendanceCodeAttempt.deleteMany({
    where: { userId },
  })

  await tx.devAuditLog.deleteMany({
    where: { userId },
  })

  await tx.apiLog.deleteMany({
    where: { userId },
  })

  await tx.errorLog.deleteMany({
    where: { userId },
  })

  // Deleting TournamentStaff cascades ES tests + staff assignments owned by this account.
  await tx.tournamentStaff.deleteMany({
    where: { userId },
  })

  await tx.user.delete({
    where: { id: userId },
  })
}
