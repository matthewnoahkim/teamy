'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Sparkles } from 'lucide-react'

interface WelcomeWidgetProps {
  clubName: string
  memberCount: number
  config?: Record<string, unknown>
}

export function WelcomeWidget({ clubName, memberCount, config }: WelcomeWidgetProps) {
  const customMessage = config?.message || `Welcome to ${clubName}!`
  const showMemberCount = config?.showMemberCount !== false

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 border-blue-200/50 dark:border-blue-800/50 shadow-lg hover:shadow-xl transition-all duration-300">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200/20 dark:bg-blue-800/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-200/20 dark:bg-purple-800/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
      
      <CardHeader className="relative z-10">
        <CardTitle className="flex items-center gap-2 text-xl">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-pulse" />
          </div>
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
            {config?.title || 'Welcome'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10">
        <p className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200 leading-relaxed">
          {customMessage}
        </p>
        {showMemberCount && (
          <div className="flex items-center gap-2 px-3 py-2 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg border border-blue-100 dark:border-blue-900/50 w-fit">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-md">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {memberCount} member{memberCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
