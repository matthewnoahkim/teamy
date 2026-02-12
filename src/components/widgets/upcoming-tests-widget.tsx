'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Clock, AlertCircle, BookOpen } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

interface UpcomingTest {
  id: string
  name: string
  status: string
  startAt: string
  endAt?: string
  durationMinutes: number
}

interface UpcomingTestsWidgetProps {
  tests: UpcomingTest[]
  clubId: string
  config?: Record<string, unknown>
}

export function UpcomingTestsWidget({ 
  tests, 
  clubId,
  config 
}: UpcomingTestsWidgetProps) {
  const limit = (config?.limit as number) || 5
  
  // Filter to published tests with upcoming start dates
  const now = new Date()
  const upcomingTests = tests
    .filter(test => test.status === 'PUBLISHED' && test.startAt && new Date(test.startAt) >= now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, limit)

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-1.5 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
            <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          {(config?.title as string) || 'Upcoming Tests'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {upcomingTests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full mb-3">
              <BookOpen className="h-6 w-6 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              No upcoming tests
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Tests will appear here when published
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingTests.map((test) => {
              const startDate = new Date(test.startAt)
              const endDate = test.endAt ? new Date(test.endAt) : null
              const isStartingSoon = startDate.getTime() - now.getTime() < 24 * 60 * 60 * 1000
              const isToday = format(startDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')

              return (
                <Link
                  key={test.id}
                  href={`/club/${clubId}?tab=tests`}
                  className="group block p-3 rounded-lg hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 dark:hover:from-orange-950/30 dark:hover:to-red-950/30 transition-all duration-200 border border-gray-100 dark:border-gray-800 hover:border-orange-200 dark:hover:border-orange-800 hover:shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all group-hover:scale-110 ${
                      isStartingSoon 
                        ? 'bg-gradient-to-br from-orange-500 to-red-500 shadow-md' 
                        : 'bg-orange-100 dark:bg-orange-900/30'
                    }`}>
                      <FileText className={`h-5 w-5 ${isStartingSoon ? 'text-white' : 'text-orange-600 dark:text-orange-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm mb-1.5 flex items-center gap-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                        <span className="line-clamp-1">{test.name}</span>
                        {isStartingSoon && (
                          <AlertCircle className="h-3.5 w-3.5 text-red-500 animate-pulse flex-shrink-0" />
                        )}
                      </h4>
                      <div className="flex flex-col gap-1.5 text-xs text-gray-600 dark:text-gray-400 mb-2">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-orange-500 dark:text-orange-400" />
                          <span className="font-medium">
                            {isToday ? 'Today' : format(startDate, 'MMM d')} at {format(startDate, 'h:mm a')}
                          </span>
                        </div>
                        {endDate && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-orange-500 dark:text-orange-400" />
                            <span>
                              Ends: {format(endDate, 'MMM d, h:mm a')}
                            </span>
                          </div>
                        )}
                        <span className="text-gray-500 dark:text-gray-500">
                          Duration: {test.durationMinutes} minutes
                        </span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs border-orange-200 dark:border-orange-800">
                          {test.status}
                        </Badge>
                        {isStartingSoon && (
                          <Badge variant="destructive" className="text-xs animate-pulse">
                            Starting Soon
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
