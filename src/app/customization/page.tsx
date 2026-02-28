import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CustomizationClient } from '@/components/customization-client'

export default async function CustomizationPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login?callbackUrl=/customization')
  }

  // Fetch user data including preferences
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      preferences: true,
    },
  })

  // Fetch user's clubs for the header dropdown
  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
    include: {
      club: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' }
  })

  const allClubs = memberships.map(m => m.club)
  const preferences = (user?.preferences as Record<string, unknown>) || null

  return (
    <CustomizationClient 
      user={{
        id: user?.id || session.user.id,
        name: user?.name || session.user.name,
        email: user?.email || session.user.email || '',
        image: user?.image || session.user.image,
      }}
      preferences={preferences}
      allClubs={allClubs}
    />
  )
}
