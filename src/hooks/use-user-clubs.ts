'use client'

import { useQuery } from '@tanstack/react-query'

export const USER_CLUBS_QUERY_KEY = ['user-clubs'] as const

export interface UserClub {
  id: string
  name: string
}

interface UserClubsResponse {
  memberships?: Array<{
    club?: UserClub | null
  }>
}

async function fetchUserClubs(): Promise<UserClub[]> {
  const response = await fetch('/api/clubs', {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch user clubs: ${response.status}`)
  }

  const data = (await response.json()) as UserClubsResponse
  return (data.memberships ?? [])
    .map((membership) => membership.club)
    .filter((club): club is UserClub => Boolean(club?.id && club.name))
}

export function useUserClubs(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: USER_CLUBS_QUERY_KEY,
    queryFn: fetchUserClubs,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}
