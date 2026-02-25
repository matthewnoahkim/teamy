import { Role, TestAssignmentScope } from '@prisma/client'

export interface MembershipAuthzContext {
  id: string
  teamId: string | null
  role: Role
  roles?: string[]
}

export interface AnnouncementTarget {
  targetRole: string | null
  eventId: string | null
}

export interface TestAssignmentTarget {
  assignedScope: TestAssignmentScope | 'CLUB' | 'TEAM' | 'PERSONAL'
  teamId: string | null
  targetMembershipId: string | null
  eventId: string | null
}

export function getAudienceRolesForMembership(membership: MembershipAuthzContext): string[] {
  const defaultRole = membership.role === Role.ADMIN ? 'COACH' : 'MEMBER'
  const rawRoles = [defaultRole, ...(membership.roles ?? [])]
  const normalized = rawRoles
    .map(role => role.trim().toUpperCase())
    .filter(role => role.length > 0)
  return [...new Set(normalized)]
}

export function hasAnnouncementTargetAccess(
  targets: AnnouncementTarget[],
  membership: MembershipAuthzContext,
  userEventIds: string[],
): boolean {
  if (targets.length === 0) {
    return true
  }

  const userRoles = getAudienceRolesForMembership(membership)
  return targets.some(target => {
    if (target.targetRole && userRoles.includes(target.targetRole.toUpperCase())) {
      return true
    }
    if (target.eventId && userEventIds.includes(target.eventId)) {
      return true
    }
    return false
  })
}

export function hasTestAssignmentAccess(
  assignments: TestAssignmentTarget[],
  membership: MembershipAuthzContext,
  userEventIds: string[],
): boolean {
  if (assignments.length === 0) {
    return false
  }

  return assignments.some(assignment => {
    if (assignment.assignedScope === TestAssignmentScope.CLUB) {
      return true
    }
    if (assignment.teamId && membership.teamId && assignment.teamId === membership.teamId) {
      return true
    }
    if (assignment.targetMembershipId === membership.id) {
      return true
    }
    if (assignment.eventId && userEventIds.includes(assignment.eventId)) {
      return true
    }
    return false
  })
}
