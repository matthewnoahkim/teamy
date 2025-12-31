import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDateTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  Lock,
  Users,
  Shuffle,
  ShieldAlert,
  FileText,
  Key,
  Eye,
  Calculator as CalcIcon,
} from 'lucide-react'
import { PasswordCopyButton } from '@/components/tests/password-copy-button'
import { EditTestSchedule } from '@/components/tests/edit-test-schedule'
import { DuplicateTestButton } from '@/components/tests/duplicate-test-button'
import { TestDetailWrapper } from '@/components/tests/test-detail-wrapper'
import { NewTestBuilder } from '@/components/tests/new-test-builder'
import { NoteSheetReviewButton } from '@/components/tests/note-sheet-review-button'

const STATUS_CONFIG: Record<
  'DRAFT' | 'PUBLISHED' | 'CLOSED',
  { label: string; variant: 'secondary' | 'default' | 'destructive' }
> = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  PUBLISHED: { label: 'Published', variant: 'default' },
  CLOSED: { label: 'Closed', variant: 'destructive' },
}

export default async function TeamTestDetailPage({
  params,
}: {
  params: { clubId: string; testId: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/login')
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_clubId: {
        userId: session.user.id,
        clubId: params.clubId,
      },
    },
    select: {
      id: true,
      role: true,
    },
  })

  if (!membership) {
    redirect('/teams')
  }

  // Only admins can view the authoring dashboard
  if (String(membership.role) !== 'ADMIN') {
    redirect(`/club/${params.clubId}?tab=tests`)
  }

  const test = await prisma.test.findFirst({
    where: {
      id: params.testId,
      clubId: params.clubId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      instructions: true,
      status: true,
      durationMinutes: true,
      maxAttempts: true,
      scoreReleaseMode: true,
      startAt: true,
      endAt: true,
      allowLateUntil: true,
      randomizeQuestionOrder: true,
      randomizeOptionOrder: true,
      requireFullscreen: true,
      allowCalculator: true,
      calculatorType: true,
      allowNoteSheet: true,
      noteSheetInstructions: true,
      releaseScoresAt: true,
      testPasswordHash: true,
      testPasswordPlaintext: true,
      createdAt: true,
      updatedAt: true,
      assignments: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
            },
          },
          event: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
      questions: {
        orderBy: { order: 'asc' },
        include: {
          options: {
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  })

  if (!test) {
    notFound()
  }

  // Check if this test is linked to a tournament
  const tournamentTest = await prisma.tournamentTest.findFirst({
    where: {
      testId: test.id,
    },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          division: true,
        },
      },
    },
  })

  // If the test is a draft, show the builder/editor interface
  if (test.status === 'DRAFT') {
    const club = await prisma.club.findUnique({
      where: { id: params.clubId },
      select: {
        id: true,
        name: true,
        division: true,
        teams: {
          select: {
            id: true,
            name: true,
          },
          orderBy: {
            name: 'asc',
          },
        },
      },
    })

    if (!club) {
      redirect('/dashboard/club')
    }

    // Transform the test data to match NewTestBuilder's expected format
    const transformedTest = {
      id: test.id,
      name: test.name,
      description: test.description,
      instructions: test.instructions,
      durationMinutes: test.durationMinutes,
      maxAttempts: test.maxAttempts,
      scoreReleaseMode: test.scoreReleaseMode,
      randomizeQuestionOrder: test.randomizeQuestionOrder,
      randomizeOptionOrder: test.randomizeOptionOrder,
      requireFullscreen: test.requireFullscreen,
      allowCalculator: test.allowCalculator,
      calculatorType: test.calculatorType,
      allowNoteSheet: test.allowNoteSheet,
      noteSheetInstructions: test.noteSheetInstructions,
      status: test.status,
      assignments: test.assignments,
      questions: test.questions.map(q => ({
        id: q.id,
        type: q.type,
        promptMd: q.promptMd,
        explanation: q.explanation,
        points: Number(q.points),
        shuffleOptions: q.shuffleOptions,
        options: q.options.map(o => ({
          id: o.id,
          label: o.label,
          isCorrect: o.isCorrect,
          order: o.order,
        })),
      })),
    }

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 grid-pattern">
        <div className="px-4 py-8 lg:px-8">
          {tournamentTest && (
            <div className="mb-6">
              <Link href={`/tournaments/${tournamentTest.tournament.id}/tests`} className="w-fit">
                <Button variant="ghost" size="sm" className="h-8 gap-2 px-2 mb-4">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Tests
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground">
                Editing test for <span className="font-semibold">{tournamentTest.tournament.name}</span>
              </p>
            </div>
          )}
          <NewTestBuilder 
            clubId={club.id} 
            clubName={club.name}
            clubDivision={club.division}
            teams={club.teams}
            test={transformedTest}
            tournamentId={tournamentTest?.tournament.id}
            tournamentName={tournamentTest?.tournament.name}
            tournamentDivision={tournamentTest?.tournament.division}
          />
        </div>
      </div>
    )
  }

  // Otherwise, show the detail view for published tests
  const statusConfig = STATUS_CONFIG[test.status]

  // Build assignment summary with proper details
  const assignmentSummary = (() => {
    if (test.assignments.length === 0) {
      return 'Everyone on the team'
    }

    const parts: string[] = []
    const seenTeams = new Set<string>()
    const seenEvents = new Set<string>()
    let hasClub = false
    let hasPersonal = false

    for (const assignment of test.assignments) {
      if (assignment.assignedScope === 'CLUB') {
        hasClub = true
      } else if (assignment.assignedScope === 'TEAM') {
        // TEAM scope can mean:
        // 1. Specific team (has teamId)
        // 2. Event-based assignment (has eventId)
        if (assignment.teamId && assignment.team) {
          if (!seenTeams.has(assignment.teamId)) {
            parts.push(assignment.team.name)
            seenTeams.add(assignment.teamId)
          }
        } else if (assignment.eventId && assignment.event) {
          if (!seenEvents.has(assignment.eventId)) {
            parts.push(`Event: ${assignment.event.name}`)
            seenEvents.add(assignment.eventId)
          }
        }
      } else if (assignment.assignedScope === 'PERSONAL') {
        hasPersonal = true
      }
    }

    // Build final summary
    if (hasClub && parts.length === 0 && !hasPersonal) {
      // Only club assignment
      return 'Everyone on the team'
    } else if (hasClub) {
      // Club + other assignments
      parts.unshift('Everyone on the team')
    }
    
    if (hasPersonal) {
      parts.push('Specific member(s)')
    }

    return parts.length > 0 ? parts.join(', ') : 'Not assigned'
  })()

  // Serialize test object with date fields as ISO strings
  const serializedTest = {
    id: test.id,
    name: test.name,
    description: test.description,
    status: test.status,
    durationMinutes: test.durationMinutes,
    startAt: test.startAt ? test.startAt.toISOString() : null,
    endAt: test.endAt ? test.endAt.toISOString() : null,
    allowLateUntil: test.allowLateUntil ? test.allowLateUntil.toISOString() : null,
    maxAttempts: test.maxAttempts,
    instructions: test.instructions,
    randomizeQuestionOrder: test.randomizeQuestionOrder,
    randomizeOptionOrder: test.randomizeOptionOrder,
    requireFullscreen: test.requireFullscreen,
    allowCalculator: test.allowCalculator,
    calculatorType: test.calculatorType,
    releaseScoresAt: test.releaseScoresAt ? test.releaseScoresAt.toISOString() : null,
    testPasswordPlaintext: test.testPasswordPlaintext,
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 grid-pattern">
      <div className="container mx-auto max-w-6xl space-y-8 py-8 px-4 lg:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2">
          <Link 
            href={tournamentTest ? `/tournaments/${tournamentTest.tournament.id}/tests` : `/club/${params.clubId}?tab=tests`} 
            className="w-fit"
          >
            <Button variant="ghost" size="sm" className="h-8 gap-2 px-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Tests
            </Button>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{test.name}</h1>
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            {test.requireFullscreen && (
              <Badge variant="outline" className="gap-1">
                <Lock className="h-3 w-3" />
                Lockdown
              </Badge>
            )}
            {test.allowCalculator && test.calculatorType && (
              <Badge variant="outline" className="gap-1">
                <CalcIcon className="h-3 w-3" />
                {test.calculatorType === 'FOUR_FUNCTION' ? 'Basic Calculator' : 
                 test.calculatorType === 'SCIENTIFIC' ? 'Scientific Calculator' : 
                 'Graphing Calculator'}
              </Badge>
            )}
          </div>
          {test.description && (
            <p className="text-muted-foreground">{test.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          {test.startAt && test.allowNoteSheet && (
            <NoteSheetReviewButton testId={test.id} testName={test.name} />
          )}
          <DuplicateTestButton
            testId={test.id}
            testName={test.name}
            clubId={params.clubId}
          />
        </div>
      </div>

      <TestDetailWrapper
        testId={test.id}
        testName={test.name}
        test={serializedTest}
        assignmentSummary={assignmentSummary}
        overviewContent={
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  Overview
                </CardTitle>
                {test.status === 'PUBLISHED' && (
                  <EditTestSchedule
                    testId={test.id}
                    currentStartAt={test.startAt ? new Date(test.startAt) : null}
                    currentEndAt={test.endAt ? new Date(test.endAt) : null}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoItem
                icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                label="Start"
                value={test.startAt ? formatDateTime(test.startAt) : 'Not set'}
              />
              <InfoItem
                icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                label="End"
                value={test.endAt ? formatDateTime(test.endAt) : 'Not set'}
              />
              <InfoItem
                icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                label="Duration"
                value={`${test.durationMinutes} minutes`}
              />
              <InfoItem
                icon={<Users className="h-4 w-4 text-muted-foreground" />}
                label="Assigned to"
                value={assignmentSummary}
              />
              {test.maxAttempts && (
                <InfoItem
                  icon={<AlertCircle className="h-4 w-4 text-muted-foreground" />}
                  label="Max Attempts"
                  value={`${test.maxAttempts} per user`}
                />
              )}
              <InfoItem
                icon={<Eye className="h-4 w-4 text-muted-foreground" />}
                label="Score Release Mode"
                value={
                  test.scoreReleaseMode === 'NONE'
                    ? 'No scores released'
                    : test.scoreReleaseMode === 'SCORE_ONLY'
                    ? 'Score only'
                    : test.scoreReleaseMode === 'SCORE_WITH_WRONG'
                    ? 'Score + wrong questions'
                    : 'Full test'
                }
              />
              <InfoItem
                icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                label="Scores Released At"
                value={test.releaseScoresAt ? formatDateTime(test.releaseScoresAt) : 'After manual release'}
              />
              {test.status === 'PUBLISHED' && test.testPasswordHash && (
                <div className="flex gap-3 sm:col-span-2">
                  <div className="mt-1">
                    <Key className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground/70">
                      Test Password
                    </p>
                    {test.testPasswordPlaintext ? (
                      <div className="flex items-center gap-2 mt-1">
                        <code className="flex-1 px-3 py-2 bg-muted border border-border rounded-md text-sm font-mono">
                          {test.testPasswordPlaintext}
                        </code>
                        <PasswordCopyButton password={test.testPasswordPlaintext} />
                      </div>
                    ) : (
                      <div className="mt-1 space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          Password is set, but original password is not available. This test was likely published before password viewing was enabled.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          To view the password, you can update it in the test settings or republish the test with a new password.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        }
        instructionsContent={
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Instructions
              </CardTitle>
              <CardDescription>
                Shown to students before they start the assessment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
                {test.instructions?.trim() ? test.instructions : 'No special instructions provided.'}
              </div>
            </CardContent>
          </Card>
        }
        deliverySettingsContent={
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shuffle className="h-4 w-4 text-muted-foreground" />
                Delivery settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <SettingToggle
                label="Randomize question order"
                enabled={test.randomizeQuestionOrder}
              />
              <SettingToggle
                label="Randomize choice order"
                enabled={test.randomizeOptionOrder}
              />
              <SettingToggle
                label="Require fullscreen lockdown"
                enabled={test.requireFullscreen}
              />
              <SettingToggle
                label="Calculator allowed"
                note={
                  test.allowCalculator && test.calculatorType
                    ? test.calculatorType === 'FOUR_FUNCTION'
                      ? 'Four Function Calculator'
                      : test.calculatorType === 'SCIENTIFIC'
                      ? 'Scientific Calculator'
                      : 'Graphing Calculator'
                    : 'No calculator'
                }
                enabled={test.allowCalculator}
              />
              <SettingToggle
                label="Scores released"
                note={
                  test.releaseScoresAt
                    ? formatDateTime(test.releaseScoresAt)
                    : 'After manual release'
                }
              />
              <SettingToggle
                label="Score release mode"
                note={
                  String(test.scoreReleaseMode) === 'NONE'
                    ? 'No scores released'
                    : String(test.scoreReleaseMode) === 'SCORE_ONLY'
                    ? 'Score only'
                    : String(test.scoreReleaseMode) === 'SCORE_WITH_WRONG'
                    ? 'Score + wrong questions'
                    : 'Full test'
                }
              />
            </CardContent>
          </Card>
        }
        assignmentContent={
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                Questions ({test.questions.length})
              </CardTitle>
              <CardDescription>
                Review prompts, answer options, and explanations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {test.questions.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No questions have been added yet.
                </p>
              )}

              {test.questions.map((question, index) => (
                <div key={question.id} className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Question {index + 1}
                    </p>
                    <Badge variant="outline" className="uppercase">
                      {question.type.replace('MCQ_', '').replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium leading-6">{question.promptMd}</p>
                    <p className="text-sm text-muted-foreground">
                      Points: {Number(question.points)}
                    </p>
                  </div>

                  {question.options.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        Answers
                      </p>
                      <ul className="space-y-2">
                        {question.options.map((option) => (
                          <li
                            key={option.id}
                            className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/20 p-3"
                          >
                            <Badge variant={option.isCorrect ? 'default' : 'secondary'}>
                              {option.isCorrect ? 'Correct' : 'Option'}
                            </Badge>
                            <span>{option.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {question.explanation && (
                    <div className="rounded-md bg-muted/20 p-3 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Explanation</p>
                      <p className="mt-1 whitespace-pre-wrap">{question.explanation}</p>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        }
      />
    </div>
    </div>
  )
}

function InfoItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-1">{icon}</div>
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground/70">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}

function SettingToggle({
  label,
  enabled,
  note,
}: {
  label: string
  enabled?: boolean
  note?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 p-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      {enabled !== undefined && (
        <Badge variant={enabled ? 'default' : 'secondary'}>
          {enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      )}
    </div>
  )
}


