import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isTournamentAdmin, hasESTestAccess } from '@/lib/rbac'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Clock, Users, FileText, Shuffle, ShieldAlert, AlertCircle, Eye, Calculator as CalcIcon, Lock } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { QuestionPrompt } from '@/components/tests/question-prompt'

interface Props {
  params: Promise<{ testId: string }>
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-1">{icon}</div>
      <div className="flex-1">
        <p className="text-xs uppercase tracking-widest text-muted-foreground/70">
          {label}
        </p>
        <p className="text-sm font-medium mt-1">{value}</p>
      </div>
    </div>
  )
}

function SettingToggle({ label, enabled, note }: { label: string; enabled: boolean; note?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {note && <p className="text-xs text-muted-foreground mt-0.5">{note}</p>}
      </div>
      <Badge variant={enabled ? 'default' : 'secondary'}>
        {enabled ? 'Enabled' : 'Disabled'}
      </Badge>
    </div>
  )
}

export default async function TDTestSettingsPage({ params }: Props) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    redirect('/td')
  }

  const { testId } = await params

  // Find the ES test
  const esTest = await prisma.eSTest.findUnique({
    where: { id: testId },
    select: {
      id: true,
      name: true,
      description: true,
      instructions: true,
      status: true,
      durationMinutes: true,
      tournamentId: true,
      eventId: true,
      startAt: true,
      endAt: true,
      allowLateUntil: true,
      requireFullscreen: true,
      allowCalculator: true,
      calculatorType: true,
      allowNoteSheet: true,
      noteSheetInstructions: true,
      autoApproveNoteSheet: true,
      requireOneSitting: true,
      releaseScoresAt: true,
      scoreReleaseMode: true,
      scoresReleased: true,
      updatedAt: true,
      createdAt: true,
      event: {
        select: {
          id: true,
          name: true,
        },
      },
      questions: {
        include: {
          options: {
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!esTest) {
    notFound()
  }

  // Verify user has access to this specific test or is admin
  // TDs have full access, ES only for their assigned events
  const hasAccess = await hasESTestAccess(session.user.id, session.user.email, testId)
  const isAdmin = await isTournamentAdmin(session.user.id, esTest.tournamentId)
  
  if (!hasAccess && !isAdmin) {
    redirect('/td')
  }

  // Get tournament info
  const tournament = await prisma.tournament.findUnique({
    where: { id: esTest.tournamentId },
    select: {
      id: true,
      name: true,
      division: true,
    },
  })

  if (!tournament) {
    redirect('/td')
  }

  // Safely access new fields that might not exist yet
  const releaseScoresAt = (esTest as any).releaseScoresAt
  const scoreReleaseMode = (esTest as any).scoreReleaseMode || 'FULL_TEST'
  const scoresReleased = (esTest as any).scoresReleased || false

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <div className="container mx-auto max-w-6xl space-y-8 py-8 px-4 lg:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2">
            <Link 
              href={`/td/tournament/${tournament.id}`}
              className="w-fit"
            >
              <Button variant="ghost" size="sm" className="h-8 gap-2 px-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Tournament
              </Button>
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">{esTest.name}</h1>
              <Badge variant={esTest.status === 'PUBLISHED' ? 'default' : 'secondary'}>
                {esTest.status}
              </Badge>
              {esTest.requireFullscreen && (
                <Badge variant="outline" className="gap-1">
                  <Lock className="h-3 w-3" />
                  Lockdown
                </Badge>
              )}
              {esTest.allowCalculator && esTest.calculatorType && (
                <Badge variant="outline" className="gap-1">
                  <CalcIcon className="h-3 w-3" />
                  {esTest.calculatorType === 'FOUR_FUNCTION' ? 'Basic Calculator' : 
                   esTest.calculatorType === 'SCIENTIFIC' ? 'Scientific Calculator' : 
                   'Graphing Calculator'}
                </Badge>
              )}
            </div>
            {esTest.description && (
              <p className="text-muted-foreground">{esTest.description}</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoItem
                icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                label="Start"
                value={esTest.startAt ? formatDateTime(esTest.startAt.toISOString()) : 'Not set'}
              />
              <InfoItem
                icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                label="End"
                value={esTest.endAt ? formatDateTime(esTest.endAt.toISOString()) : 'Not set'}
              />
              <InfoItem
                icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                label="Duration"
                value={`${esTest.durationMinutes} minutes`}
              />
              {esTest.event && (
                <InfoItem
                  icon={<Users className="h-4 w-4 text-muted-foreground" />}
                  label="Event"
                  value={esTest.event.name}
                />
              )}
              <InfoItem
                icon={<Eye className="h-4 w-4 text-muted-foreground" />}
                label="Score Release Mode"
                value={
                  scoreReleaseMode === 'NONE'
                    ? 'No scores released'
                    : scoreReleaseMode === 'SCORE_ONLY'
                    ? 'Score only'
                    : scoreReleaseMode === 'SCORE_WITH_WRONG'
                    ? 'Score + wrong questions'
                    : 'Full test'
                }
              />
              <InfoItem
                icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                label="Scores Released At"
                value={releaseScoresAt ? formatDateTime(releaseScoresAt instanceof Date ? releaseScoresAt.toISOString() : releaseScoresAt) : (scoresReleased ? 'Manually released' : 'Not released')}
              />
              {esTest.updatedAt && esTest.updatedAt !== esTest.createdAt && (
                <InfoItem
                  icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                  label="Last Edited"
                  value={formatDateTime(esTest.updatedAt.toISOString())}
                />
              )}
            </CardContent>
          </Card>

          {/* Instructions */}
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
                {esTest.instructions?.trim() ? esTest.instructions : 'No special instructions provided.'}
              </div>
            </CardContent>
          </Card>

          {/* Delivery Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shuffle className="h-4 w-4 text-muted-foreground" />
                Delivery settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <SettingToggle
                label="Require fullscreen lockdown"
                enabled={esTest.requireFullscreen ?? true}
              />
              <SettingToggle
                label="Calculator allowed"
                note={
                  esTest.allowCalculator && esTest.calculatorType
                    ? esTest.calculatorType === 'FOUR_FUNCTION'
                      ? 'Four Function Calculator'
                      : esTest.calculatorType === 'SCIENTIFIC'
                      ? 'Scientific Calculator'
                      : 'Graphing Calculator'
                    : 'No calculator'
                }
                enabled={esTest.allowCalculator ?? false}
              />
              <SettingToggle
                label="Note sheet allowed"
                enabled={esTest.allowNoteSheet ?? false}
              />
              {esTest.allowNoteSheet && (
                <SettingToggle
                  label="Auto-approve note sheets"
                  enabled={esTest.autoApproveNoteSheet ?? true}
                />
              )}
              <SettingToggle
                label="Require one sitting"
                enabled={esTest.requireOneSitting ?? true}
              />
            </CardContent>
          </Card>

          {/* Questions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                Questions ({esTest.questions.length})
              </CardTitle>
              <CardDescription>
                Review prompts, answer options, and explanations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {esTest.questions.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No questions have been added yet.
                </p>
              )}

              {esTest.questions.map((question, index) => (
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
                    <QuestionPrompt promptMd={question.promptMd} />
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
        </div>
      </div>
    </div>
  )
}
