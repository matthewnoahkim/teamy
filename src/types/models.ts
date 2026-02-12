/**
 * Shared type definitions derived from Prisma schema.
 *
 * These types mirror the deeply-included payloads returned by the server
 * component in club/[clubId]/page.tsx so that downstream client components
 * can stop using `any`.
 */

import type { Prisma } from '@prisma/client'

// ---------------------------------------------------------------------------
// Reusable user select shape (used throughout all includes)
// ---------------------------------------------------------------------------
export const userSelectFields = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const satisfies Prisma.UserSelect

export type UserBasic = Prisma.UserGetPayload<{ select: typeof userSelectFields }>

// ---------------------------------------------------------------------------
// Membership (with preferences) — what `currentMembership` is
// ---------------------------------------------------------------------------
export type MembershipWithPreferences = Prisma.MembershipGetPayload<{
  include: { preferences: true }
}>

// ---------------------------------------------------------------------------
// Club with full memberships & teams — the `club` prop
// ---------------------------------------------------------------------------
export type ClubWithMembers = Prisma.ClubGetPayload<{
  include: {
    memberships: {
      include: {
        user: { select: typeof userSelectFields }
        team: true
        rosterAssignments: { include: { event: true } }
        preferences: true
      }
    }
    teams: {
      include: {
        members: {
          include: {
            user: { select: typeof userSelectFields }
          }
        }
        _count: { select: { rosterAssignments: true } }
      }
    }
  }
}>

// ---------------------------------------------------------------------------
// Calendar event (full include from page.tsx wave 3)
// ---------------------------------------------------------------------------
export type CalendarEventFull = Prisma.CalendarEventGetPayload<{
  include: {
    creator: {
      include: { user: { select: typeof userSelectFields } }
    }
    team: true
    attendee: {
      include: { user: { select: typeof userSelectFields } }
    }
    rsvps: {
      include: { user: { select: typeof userSelectFields } }
    }
    attachments: {
      include: { uploadedBy: { select: typeof userSelectFields } }
    }
    targets: true
    test: { select: { id: true } }
  }
}>

// ---------------------------------------------------------------------------
// Announcement (full include from page.tsx wave 3)
// ---------------------------------------------------------------------------
export type AnnouncementFull = Prisma.AnnouncementGetPayload<{
  include: {
    author: {
      include: { user: { select: typeof userSelectFields } }
    }
    visibilities: { include: { team: true } }
    replies: {
      include: {
        author: {
          include: { user: { select: typeof userSelectFields } }
        }
        reactions: {
          include: { user: { select: typeof userSelectFields } }
        }
      }
    }
    reactions: {
      include: { user: { select: typeof userSelectFields } }
    }
    _count: { select: { replies: true; reactions: true } }
    calendarEvent: {
      include: {
        rsvps: {
          include: { user: { select: typeof userSelectFields } }
        }
        team: true
      }
    }
    attachments: {
      include: { uploadedBy: { select: typeof userSelectFields } }
    }
  }
}>

// ---------------------------------------------------------------------------
// Attendance (full include from page.tsx wave 2)
// ---------------------------------------------------------------------------
export type AttendanceFull = Prisma.AttendanceGetPayload<{
  include: {
    calendarEvent: { include: { team: true } }
    checkIns: {
      include: { user: { select: typeof userSelectFields } }
    }
    _count: { select: { checkIns: true } }
  }
}>

// ---------------------------------------------------------------------------
// Expense (full include from page.tsx wave 2)
// ---------------------------------------------------------------------------
export type ExpenseFull = Prisma.ExpenseGetPayload<{
  include: {
    event: { select: { id: true; name: true; slug: true } }
    team: { select: { id: true; name: true } }
    purchaseRequest: {
      select: { id: true; requesterId: true; description: true }
    }
  }
}>

// ---------------------------------------------------------------------------
// Purchase request (full include from page.tsx wave 2)
// ---------------------------------------------------------------------------
export type PurchaseRequestFull = Prisma.PurchaseRequestGetPayload<{
  include: {
    event: { select: { id: true; name: true; slug: true } }
    team: { select: { id: true; name: true } }
    expense: { select: { id: true; amount: true; date: true } }
  }
}>

// ---------------------------------------------------------------------------
// Event budget (full include from page.tsx wave 2) + computed fields
// ---------------------------------------------------------------------------
export type EventBudgetFull = Prisma.EventBudgetGetPayload<{
  include: {
    event: { select: { id: true; name: true; slug: true; division: true } }
    team: { select: { id: true; name: true } }
  }
}>

export type EventBudgetWithTotals = EventBudgetFull & {
  totalSpent: number
  totalRequested: number
  remaining: number
}

// ---------------------------------------------------------------------------
// Test (select shape from page.tsx wave 3)
// ---------------------------------------------------------------------------
export interface TestSummary {
  id: string
  name: string
  description: string | null
  status: string
  durationMinutes: number | null
  startAt: Date | null
  endAt: Date | null
  allowLateUntil: Date | null
  requireFullscreen: boolean
  allowCalculator: boolean
  calculatorType: string | null
  allowNoteSheet: boolean
  noteSheetInstructions: string | null
  releaseScoresAt: Date | null
  maxAttempts: number | null
  scoreReleaseMode: string | null
  createdAt: Date
  updatedAt: Date
  _count: { questions: number; attempts: number }
}

// ---------------------------------------------------------------------------
// InitialData — the combined data blob passed to ClubPage
// ---------------------------------------------------------------------------
export interface ClubPageInitialData {
  attendances: AttendanceFull[]
  expenses: ExpenseFull[]
  purchaseRequests: PurchaseRequestFull[]
  eventBudgets: EventBudgetWithTotals[]
  calendarEvents: CalendarEventFull[]
  announcements: AnnouncementFull[]
  tests: TestSummary[]
  mediaItems?: unknown[]
  albums?: unknown[]
  forms?: unknown[]
  todos?: unknown[]
  stats?: unknown
}

// ---------------------------------------------------------------------------
// Session user shape (matches next-auth.d.ts augmentation)
// ---------------------------------------------------------------------------
export interface SessionUser {
  id: string
  name?: string | null
  email: string
  image?: string | null
}
