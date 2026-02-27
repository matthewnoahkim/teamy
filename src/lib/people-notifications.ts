const peopleActivityActions = [
  'USER_JOINED_CLUB',
  'MEMBERSHIP_LEFT_CLUB',
  'MEMBERSHIP_REMOVED',
  'MEMBERSHIP_ROLE_CHANGED',
  'MEMBERSHIP_ROLES_CHANGED',
  'MEMBERSHIP_TEAM_CHANGED',
  // Reserved for future people-flow features.
  'CLUB_JOIN_REQUEST_CREATED',
  'CLUB_JOIN_REQUEST_APPROVED',
  'CLUB_JOIN_REQUEST_DENIED',
  'CLUB_INVITE_SENT',
  'CLUB_INVITE_ACCEPTED',
] as const

export const PEOPLE_ACTIVITY_ACTIONS: readonly string[] = peopleActivityActions

const peopleActivityActionSet = new Set<string>(PEOPLE_ACTIVITY_ACTIONS)

type MaybeMetadata = Record<string, unknown> | null | undefined

function extractClubId(metadata: MaybeMetadata): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const rawClubId = metadata.clubId
  return typeof rawClubId === 'string' ? rawClubId : null
}

export interface PeopleActivityUnreadInput {
  action: string
  clubId: string
  viewerUserId: string
  actorUserId?: string | null
  metadata?: Record<string, unknown> | null
}

export function shouldCountPeopleActivityAsUnread(input: PeopleActivityUnreadInput): boolean {
  if (!peopleActivityActionSet.has(input.action)) return false
  if (input.actorUserId && input.actorUserId === input.viewerUserId) return false
  return extractClubId(input.metadata) === input.clubId
}

