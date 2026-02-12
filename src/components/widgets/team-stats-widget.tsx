'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Calendar, MessageSquare, FileText, TrendingUp } from 'lucide-react'

interface TeamStatsWidgetProps {
  stats: {
    memberCount: number
    announcementCount: number
    eventCount: number
    testCount: number
  }
  config?: Record<string, unknown>
}

export function TeamStatsWidget({ stats, config }: TeamStatsWidgetProps) {
  const showStats = (config?.showStats as string[]) || ['members', 'announcements', 'events', 'tests']

  const statItems = [
    {
      key: 'members',
      label: 'Members',
      value: stats.memberCount,
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      key: 'announcements',
      label: 'Announcements',
      value: stats.announcementCount,
      icon: MessageSquare,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      key: 'events',
      label: 'Events',
      value: stats.eventCount,
      icon: Calendar,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      key: 'tests',
      label: 'Tests',
      value: stats.testCount,
      icon: FileText,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
      gradient: 'from-orange-500 to-red-500',
    },
  ].filter(item => showStats.includes(item.key))

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
            <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          {(config?.title as string) || 'Team Stats'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {statItems.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.key}
                className="group relative flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-900/50 border border-gray-200/50 dark:border-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 hover:shadow-md"
              >
                <div className={`${stat.bgColor} p-2.5 rounded-lg group-hover:scale-110 transition-transform duration-200`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-2xl font-bold bg-gradient-to-r bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300">
                    {stat.value}
                  </p>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-0.5">
                    {stat.label}
                  </p>
                </div>
                {/* Decorative gradient accent */}
                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-b-xl`} />
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
