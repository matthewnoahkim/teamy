'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText } from 'lucide-react'
import { MarkdownRenderer } from '@/components/markdown-renderer'

interface CustomTextWidgetProps {
  config?: Record<string, unknown>
}

export function CustomTextWidget({ config }: CustomTextWidgetProps) {
  const rawContent = (config?.content as string) || 'Add custom content here...'
  const showTitle = config?.showTitle !== false

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
      {showTitle && (
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>
            {(config?.title as string) || 'Custom Widget'}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={showTitle ? '' : 'pt-6'}>
        <MarkdownRenderer content={rawContent} />
      </CardContent>
    </Card>
  )
}
