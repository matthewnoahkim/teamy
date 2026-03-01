function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export function getConfiguredAppOrigins(): string[] {
  const configured = [
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

  const origins = configured
    .map((value) => normalizeOrigin(value))
    .filter((origin): origin is string => !!origin)

  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3000')
    origins.push('http://127.0.0.1:3000')
  }

  return [...new Set(origins)]
}

export function resolveSafeCallbackPath(
  rawCallbackUrl: string | undefined,
  defaultPath: string,
  allowedOrigins: string[] = getConfiguredAppOrigins()
): string {
  if (!rawCallbackUrl) return defaultPath

  if (rawCallbackUrl.startsWith('/') && !rawCallbackUrl.startsWith('//')) {
    return rawCallbackUrl
  }

  try {
    const url = new URL(rawCallbackUrl)
    const isHttp = url.protocol === 'http:' || url.protocol === 'https:'
    if (isHttp && allowedOrigins.includes(url.origin)) {
      return `${url.pathname}${url.search}${url.hash}`
    }
  } catch {
    // Ignore parse errors and fallback to default path.
  }

  return defaultPath
}

export function isTrustedOrigin(
  originHeader: string | null,
  allowedOrigins: string[] = getConfiguredAppOrigins()
): boolean {
  if (!originHeader) return true
  try {
    return allowedOrigins.includes(new URL(originHeader).origin)
  } catch {
    return false
  }
}
