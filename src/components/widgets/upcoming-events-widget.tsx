'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, MapPin, Clock, CalendarDays } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

export interface CalendarEvent {
  id: string
  title: string
  startUTC: string
  location?: string
  scope?: string
}

interface UpcomingEventsWidgetProps {
  events: CalendarEvent[]
  clubId: string
  config?: Record<string, unknown>
}

export function UpcomingEventsWidget({ 
  events, 
  clubId,
  config 
}: UpcomingEventsWidgetProps) {
  const limit = (config?.limit as number) || 5
  const daysAhead = (config?.daysAhead as number) || 30
  
  // Filter to upcoming events within the next X days
  const now = new Date()
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + daysAhead)
  
  const upcomingEvents = events
    .filter(event => {
      const eventDate = new Date(event.startUTC)
      return eventDate >= now && eventDate <= futureDate
    })
    .sort((a, b) => new Date(a.startUTC).getTime() - new Date(b.startUTC).getTime())
    .slice(0, limit)

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-1.5 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
            <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          {(config?.title as string) || 'Upcoming Events'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {upcomingEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full mb-3">
              <CalendarDays className="h-6 w-6 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              No upcoming events
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Events will appear here when scheduled
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingEvents.map((event) => {
              const eventDate = new Date(event.startUTC)
              const isToday = format(eventDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')
              const isTomorrow = format(eventDate, 'yyyy-MM-dd') === format(new Date(now.getTime() + 86400000), 'yyyy-MM-dd')
              
              return (
                <Link
                  key={event.id}
                  href={`/club/${clubId}?tab=calendar&eventId=${event.id}`}
                  className="group block p-3 rounded-lg hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-950/30 dark:hover:to-pink-950/30 transition-all duration-200 border border-gray-100 dark:border-gray-800 hover:border-purple-200 dark:hover:border-purple-800 hover:shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-14 h-14 rounded-lg flex flex-col items-center justify-center font-semibold transition-all group-hover:scale-105 ${
                      isToday 
                        ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-md' 
                        : 'bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/50 dark:to-pink-900/50'
                    }`}>
                      <span className={`text-xs font-bold ${isToday ? 'text-white' : 'text-purple-600 dark:text-purple-400'}`}>
                        {format(eventDate, 'MMM')}
                      </span>
                      <span className={`text-xl font-bold leading-none ${isToday ? 'text-white' : 'text-purple-700 dark:text-purple-300'}`}>
                        {format(eventDate, 'd')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h4 className="font-semibold text-sm group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-1">
                          {event.title}
                        </h4>
                        {(isToday || isTomorrow) && (
                          <Badge 
                            variant={isToday ? "default" : "secondary"} 
                            className="text-xs px-2 py-0 flex-shrink-0"
                          >
                            {isToday ? 'Today' : 'Tomorrow'}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
                          <span className="font-medium">
                            {format(eventDate, 'h:mm a')}
                          </span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        )}
                      </div>
                      {event.scope && (
                        <Badge variant="outline" className="mt-2 text-xs border-purple-200 dark:border-purple-800">
                          {event.scope}
                        </Badge>
                      )}
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
