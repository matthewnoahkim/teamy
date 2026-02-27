const SSL_MODE_ALIAS_TO_VERIFY_FULL = new Set(['prefer', 'require', 'verify-ca'])

export function normalizePgConnectionString(connectionString?: string): string | undefined {
  if (!connectionString) return connectionString

  try {
    const parsed = new URL(connectionString)
    const sslMode = parsed.searchParams.get('sslmode')

    if (!sslMode || parsed.searchParams.has('uselibpqcompat')) {
      return connectionString
    }

    if (SSL_MODE_ALIAS_TO_VERIFY_FULL.has(sslMode.toLowerCase())) {
      parsed.searchParams.set('sslmode', 'verify-full')
      return parsed.toString()
    }
  } catch {
    // If URL parsing fails, keep the original connection string.
  }

  return connectionString
}
