'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  MessageSquare, 
  Calendar, 
  Users, 
  DollarSign, 
  FileText,
  Zap 
} from 'lucide-react'
import Link from 'next/link'

interface QuickActionsWidgetProps {
  clubId: string
  isAdmin: boolean
  config?: Record<string, unknown>
}

export function QuickActionsWidget({ clubId, isAdmin, config }: QuickActionsWidgetProps) {
  const showActions = (config?.showActions as string[]) || ['stream', 'calendar', 'people', 'tests']

  const allActions = [
    {
      key: 'stream',
      label: 'View Stream',
      icon: MessageSquare,
      href: `/club/${clubId}?tab=stream`,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      hoverColor: 'hover:bg-blue-200 dark:hover:bg-blue-900/50',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      key: 'calendar',
      label: 'View Calendar',
      icon: Calendar,
      href: `/club/${clubId}?tab=calendar`,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      hoverColor: 'hover:bg-purple-200 dark:hover:bg-purple-900/50',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      key: 'people',
      label: 'View Team',
      icon: Users,
      href: `/club/${clubId}?tab=people`,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      hoverColor: 'hover:bg-green-200 dark:hover:bg-green-900/50',
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      key: 'tests',
      label: 'View Tests',
      icon: FileText,
      href: `/club/${clubId}?tab=tests`,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
      hoverColor: 'hover:bg-orange-200 dark:hover:bg-orange-900/50',
      gradient: 'from-orange-500 to-red-500',
    },
    {
      key: 'finance',
      label: 'View Finance',
      icon: DollarSign,
      href: `/club/${clubId}?tab=finance`,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
      hoverColor: 'hover:bg-yellow-200 dark:hover:bg-yellow-900/50',
      gradient: 'from-yellow-500 to-amber-500',
      adminOnly: true,
    },
  ]

  const actions = allActions.filter(action => 
    showActions.includes(action.key) && (!action.adminOnly || isAdmin)
  )

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-1.5 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg">
            <Zap className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          {config?.title || 'Quick Actions'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <Link key={action.key} href={action.href} className="block">
                <Button
                  variant="outline"
                  className="w-full h-auto flex flex-col items-center gap-2.5 p-4 hover:scale-105 hover:shadow-md transition-all duration-200 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 group"
                >
                  <div className={`${action.bgColor} ${action.hoverColor} p-3 rounded-xl transition-all duration-200 group-hover:scale-110`}>
                    <Icon className={`h-6 w-6 ${action.color}`} />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                    {action.label}
                  </span>
                </Button>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
