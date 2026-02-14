'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MessageSquare, Star, Inbox } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'

export interface Announcement {
  id: string
  title: string
  content: string
  important: boolean
  createdAt: string
  author?: {
    user?: {
      name?: string
      image?: string
    }
  }
}

interface RecentAnnouncementsWidgetProps {
  announcements: Announcement[]
  clubId: string
  config?: Record<string, unknown>
}

export function RecentAnnouncementsWidget({ 
  announcements, 
  clubId,
  config 
}: RecentAnnouncementsWidgetProps) {
  const limit = (config?.limit as number) || 5
  const showImportantOnly = config?.showImportantOnly || false
  
  const filteredAnnouncements = showImportantOnly
    ? announcements.filter(a => a.important)
    : announcements
  
  const displayAnnouncements = filteredAnnouncements.slice(0, limit)

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          {(config?.title as string) || 'Recent Announcements'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {displayAnnouncements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full mb-3">
              <Inbox className="h-6 w-6 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              No announcements yet
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Check back later for updates
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayAnnouncements.map((announcement) => (
              <Link
                key={announcement.id}
                href={`/club/${clubId}?tab=stream`}
                className="group block p-3 rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-950/30 dark:hover:to-indigo-950/30 transition-all duration-200 border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-9 w-9 ring-2 ring-gray-200 dark:ring-gray-700 group-hover:ring-blue-300 dark:group-hover:ring-blue-700 transition-all">
                    <AvatarImage src={announcement.author?.user?.image || ''} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-cyan-600 text-white text-xs font-semibold">
                      {announcement.author?.user?.name?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h4 className="font-semibold text-sm flex items-center gap-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {announcement.important && (
                          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 animate-pulse" />
                        )}
                        <span className="line-clamp-1">{announcement.title}</span>
                      </h4>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2 leading-relaxed">
                      {announcement.content}
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {formatDateTime(announcement.createdAt)}
                      </p>
                      {announcement.important && (
                        <Badge variant="secondary" className="text-xs px-2 py-0 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800">
                          Important
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
