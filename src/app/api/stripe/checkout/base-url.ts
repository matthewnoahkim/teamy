function normalizeAppOrigin(raw: string): string | null {
  const candidate = raw.trim()
  if (!candidate) return null

  const withProtocol =
    candidate.startsWith('http://') || candidate.startsWith('https://')
      ? candidate
      : `https://${candidate}`

  try {
    const parsed = new URL(withProtocol)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return null
  }
}

export function resolveTrustedBillingBaseUrl(): string | null {
  const envCandidates = [
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.NEXTAUTH_URL,
    process.env.APP_URL,
    process.env.VERCEL_URL,
  ]

  for (const candidate of envCandidates) {
    if (!candidate) continue
    const normalized = normalizeAppOrigin(candidate)
    if (normalized) return normalized
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3000'
  }

  return null
}
