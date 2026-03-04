export function buildAuthCallbackUrl(callbackUrl: string | undefined): string {
  const normalized = callbackUrl?.trim() || '/auth/callback'

  if (normalized.startsWith('/auth/callback')) {
    return normalized
  }

  const params = new URLSearchParams({ callbackUrl: normalized })
  return `/auth/callback?${params.toString()}`
}
