import Link from 'next/link'

type PublicUserActionsProps = {
  variant: 'mobile' | 'desktop'
  isAuthenticated: boolean
}

export function PublicUserActions({ variant, isAuthenticated }: PublicUserActionsProps) {
  if (variant === 'mobile') {
    if (isAuthenticated) {
      return (
        <Link
          href="/auth/callback"
          className="block w-full rounded-full bg-white px-4 py-2.5 text-center text-sm font-semibold text-teamy-primary shadow-sm transition-all duration-200 hover:bg-white/90 hover:shadow-md"
        >
          My Clubs
        </Link>
      )
    }

    return (
      <div className="space-y-2">
        <Link
          href="/login"
          className="block w-full rounded-full border border-white/40 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-white/10"
        >
          Sign In
        </Link>
        <Link
          href="/signup"
          className="block w-full rounded-full bg-white px-4 py-2.5 text-center text-sm font-semibold text-teamy-primary shadow-sm transition-all duration-200 hover:bg-white/90 hover:shadow-md"
        >
          Sign Up
        </Link>
      </div>
    )
  }

  if (isAuthenticated) {
    return (
      <Link
        href="/auth/callback"
        className="hidden whitespace-nowrap rounded-full bg-white px-5 py-2 text-xs font-semibold text-teamy-primary shadow-sm transition-all duration-200 hover:bg-white/90 hover:shadow-md md:block md:px-6 md:py-2.5 md:text-sm"
      >
        My Clubs
      </Link>
    )
  }

  return (
    <div className="hidden md:flex items-center gap-3">
      <Link
        href="/login"
        className="whitespace-nowrap px-2 py-2 text-xs font-semibold text-white/90 transition-colors hover:text-white md:px-3 md:text-sm"
      >
        Sign In
      </Link>
      <Link
        href="/signup"
        className="block whitespace-nowrap rounded-full bg-white px-5 py-2 text-xs font-semibold text-teamy-primary shadow-sm transition-all duration-200 hover:bg-white/90 hover:shadow-md md:px-6 md:py-2.5 md:text-sm"
      >
        Sign Up
      </Link>
    </div>
  )
}
