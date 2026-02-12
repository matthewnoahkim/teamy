'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Link as LinkIcon, ExternalLink, Link2 } from 'lucide-react'

interface ImportantLinksWidgetProps {
  config?: Record<string, unknown>
}

interface LinkItem {
  title: string
  url: string
  description?: string
}

export function ImportantLinksWidget({ config }: ImportantLinksWidgetProps) {
  const links: LinkItem[] = (config?.links as LinkItem[]) || []

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
            <LinkIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          {config?.title || 'Important Links'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full mb-3">
              <Link2 className="h-6 w-6 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              No links configured
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Add links in widget settings
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {links.map((link, index) => (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block p-3 rounded-lg hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 dark:hover:from-indigo-950/30 dark:hover:to-blue-950/30 transition-all duration-200 border border-gray-100 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                      {link.title}
                    </h4>
                    {link.description && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                        {link.description}
                      </p>
                    )}
                  </div>
                  <ExternalLink className="h-4 w-4 text-gray-400 dark:text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex-shrink-0 transition-colors group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
