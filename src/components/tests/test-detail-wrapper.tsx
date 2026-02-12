'use client'

import { useSearchParams } from 'next/navigation'
import { TestAttemptsView } from './test-attempts-view'

interface TestDetailWrapperProps {
  testId: string
  testName: string
  test: {
    id: string
    name: string
    description: string | null
    status: 'DRAFT' | 'PUBLISHED' | 'CLOSED'
    durationMinutes: number
    startAt: string | null
    endAt: string | null
    allowLateUntil: string | null
    maxAttempts: number | null
    instructions: string | null
    randomizeQuestionOrder: boolean
    randomizeOptionOrder: boolean
    requireFullscreen: boolean
    releaseScoresAt: string | null
    testPasswordPlaintext: string | null
  }
  assignmentSummary: string
  overviewContent: React.ReactNode
  instructionsContent: React.ReactNode
  deliverySettingsContent: React.ReactNode
  assignmentContent: React.ReactNode
}

export function TestDetailWrapper({
  testId,
  testName,
  test: _test,
  overviewContent,
  instructionsContent,
  deliverySettingsContent,
  assignmentContent,
}: TestDetailWrapperProps) {
  const searchParams = useSearchParams()
  
  // Determine which view to show based on URL query parameter
  // If view=test, show settings. Otherwise, show responses (default)
  const viewParam = searchParams.get('view')
  const showSettings = viewParam === 'test'

  return (
    <div className="space-y-6">
      {showSettings ? (
        <div className="space-y-6">
          {overviewContent}
          {instructionsContent}
          {deliverySettingsContent}
          {assignmentContent}
        </div>
      ) : (
        <TestAttemptsView testId={testId} testName={testName} />
      )}
    </div>
  )
}

