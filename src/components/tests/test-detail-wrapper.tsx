'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TestAttemptsView } from './test-attempts-view'
import { Clock, Users, FileText, Lock, AlertCircle, Key, Shuffle } from 'lucide-react'

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
  test,
  overviewContent,
  instructionsContent,
  deliverySettingsContent,
  assignmentContent,
}: TestDetailWrapperProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  
  // Initialize activeView from URL query parameter, default to 'test'
  const viewParam = searchParams.get('view')
  const [activeView, setActiveView] = useState<'test' | 'attempts'>(
    (viewParam === 'attempts' || viewParam === 'test') ? viewParam : 'test'
  )

  // Sync state with URL params when they change (e.g., browser back/forward)
  useEffect(() => {
    const currentViewParam = searchParams.get('view')
    const newView = (currentViewParam === 'attempts' || currentViewParam === 'test') 
      ? currentViewParam 
      : 'test'
    setActiveView(newView)
  }, [searchParams])

  // Update URL when view changes
  const handleViewChange = (view: 'test' | 'attempts') => {
    setActiveView(view)
    const params = new URLSearchParams(searchParams.toString())
    if (view === 'test') {
      params.delete('view')
    } else {
      params.set('view', view)
    }
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
    router.push(newUrl, { scroll: false })
  }

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex gap-2 border-b border-border pb-4">
        <Button
          variant={activeView === 'test' ? 'default' : 'outline'}
          onClick={() => handleViewChange('test')}
        >
          Test Overview
        </Button>
        <Button
          variant={activeView === 'attempts' ? 'default' : 'outline'}
          onClick={() => handleViewChange('attempts')}
        >
          Responses
        </Button>
      </div>

      {activeView === 'test' ? (
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

