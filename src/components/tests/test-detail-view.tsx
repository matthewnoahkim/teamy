'use client'

import { useMemo, type ReactNode } from 'react'
import Link from 'next/link'
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
  FileText,
  Lock,
  Shuffle,
  ShieldAlert,
  Users,
} from 'lucide-react'

interface AssignmentView {
  assignedScope: 'CLUB' | 'TEAM' | 'PERSONAL'
  teamName?: string | null
}

interface OptionView {
  id: string
  label: string
  isCorrect: boolean
}

interface QuestionView {
  id: string
  type: 'MCQ_SINGLE' | 'MCQ_MULTI' | 'SHORT_TEXT' | 'LONG_TEXT' | 'NUMERIC'
  prompt: string
  explanation: string | null
  points: number
  options: OptionView[]
}

export interface TestDetailViewProps {
  clubId: string
  test: {
    id: string
    name: string
    description: string | null
    status: 'DRAFT' | 'PUBLISHED' | 'CLOSED'
    durationMinutes: number
    startAt: string | null
    endAt: string | null
    instructions: string | null
    randomizeQuestionOrder: boolean
    randomizeOptionOrder: boolean
    requireFullscreen: boolean
    releaseScoresAt: string | null
    assignments: AssignmentView[]
    questions: QuestionView[]
  }
}

const STATUS_CONFIG: Record<
  'DRAFT' | 'PUBLISHED' | 'CLOSED',
  { label: string; variant: 'secondary' | 'default' | 'destructive' }
> = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  PUBLISHED: { label: 'Published', variant: 'default' },
  CLOSED: { label: 'Closed', variant: 'destructive' },
}

export function TestDetailView({ clubId, test }: TestDetailViewProps) {
  const statusConfig = STATUS_CONFIG[test.status]

  const assignmentSummary = useMemo(() => {
    if (test.assignments.length === 0) {
      return 'Everyone on the team'
    }
    const parts = test.assignments.map((assignment) => {
      switch (assignment.assignedScope) {
        case 'CLUB':
          return 'Everyone on the team'
        case 'TEAM':
          return assignment.teamName ?? 'Team assignment'
        case 'PERSONAL':
        default:
          return 'Specific member'
      }
    })
    return Array.from(new Set(parts)).join(', ')
  }, [test.assignments])

  return (
    <div className="container mx-auto max-w-6xl space-y-8 py-8 px-4 lg:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2">
          <Link href={`/club/${clubId}?tab=tests`} className="w-fit">
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
          </div>
          {test.description && (
            <p className="text-muted-foreground">{test.description}</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
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
            </CardContent>
          </Card>

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
                label="Scores released"
                note={
                  test.releaseScoresAt
                    ? formatDateTime(test.releaseScoresAt)
                    : 'After manual release'
                }
              />
            </CardContent>
          </Card>

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
                      {renderTypeLabel(question.type)}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium leading-6">{question.prompt}</p>
                    <p className="text-sm text-muted-foreground">
                      Points: {question.points}
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

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Security notes</CardTitle>
              <CardDescription>
                Editing requires the admin password set during creation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Share the password only with admins who should manage this assessment.
                {test.status === 'DRAFT' ? (
                  <> Draft tests can be edited without a password.</>
                ) : (
                  <> Admins will be prompted for it when editing published tests.</>
                )}
              </p>
              <p>
                Lockdown events (tab changes, leaving fullscreen, dev tools) are still
                logged for proctor review. Encourage proctors to monitor attempts in
                real time for high-stakes tests.
              </p>
            </CardContent>
          </Card>
        </aside>
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

function renderTypeLabel(type: QuestionView['type']) {
  if (type === 'MCQ_SINGLE') return 'Multiple choice'
  if (type === 'MCQ_MULTI') return 'Select all'
  if (type === 'LONG_TEXT') return 'Free response'
  if (type === 'SHORT_TEXT') return 'Short response'
  if (type === 'NUMERIC') return 'Numeric'
  return type
}

