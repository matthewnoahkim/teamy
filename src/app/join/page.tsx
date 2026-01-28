import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'

type JoinPageProps = {
  searchParams?: Promise<{
    code?: string
  }>
}

export default async function JoinPage({ searchParams }: JoinPageProps) {
  const session = await getServerSession(authOptions)
  const resolvedSearchParams = await searchParams
  const code = resolvedSearchParams?.code?.toString() ?? ''

  // If not logged in, redirect to login with callback to this page
  if (!session?.user) {
    const target = code ? `/join?code=${encodeURIComponent(code)}` : '/join'
    redirect(`/login?callbackUrl=${encodeURIComponent(target)}`)
  }

  // If logged in, redirect to no-clubs page with the code
  if (code) {
    redirect(`/no-clubs?code=${encodeURIComponent(code)}`)
  } else {
    redirect('/no-clubs')
  }
}
