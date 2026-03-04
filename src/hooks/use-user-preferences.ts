'use client'

import { useQuery } from '@tanstack/react-query'

export const USER_PREFERENCES_QUERY_KEY = ['user-preferences'] as const

export type UserPreferences = Record<string, unknown> | null

export interface UserPreferencesResponse {
  preferences: UserPreferences
}

async function fetchUserPreferences(): Promise<UserPreferencesResponse> {
  const response = await fetch('/api/user/preferences', {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch user preferences: ${response.status}`)
  }

  const data = (await response.json()) as UserPreferencesResponse
  return {
    preferences: data?.preferences ?? null,
  }
}

export function useUserPreferences(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: USER_PREFERENCES_QUERY_KEY,
    queryFn: fetchUserPreferences,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}
