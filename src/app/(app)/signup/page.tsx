import { redirect } from 'next/navigation'

type SignUpPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string
  }>
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const resolvedSearchParams = await searchParams
  const params = new URLSearchParams({ mode: 'signup' })

  if (resolvedSearchParams?.callbackUrl) {
    params.set('callbackUrl', resolvedSearchParams.callbackUrl)
  }

  redirect(`/login?${params.toString()}`)
}
