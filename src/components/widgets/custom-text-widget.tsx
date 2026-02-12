'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText } from 'lucide-react'

interface CustomTextWidgetProps {
  config?: Record<string, unknown>
}

/**
 * Sanitize HTML to prevent XSS attacks.
 * Only allows safe tags and attributes.
 */
function sanitizeHtml(html: string): string {
  // Allow only safe tags
  const allowedTags = ['b', 'i', 'u', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'span', 'div', 'blockquote', 'code', 'pre', 'hr']
  
  // Remove script tags and event handlers entirely
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  
  // Remove event handler attributes (onclick, onerror, onload, etc.)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  
  // Remove javascript: protocol from href/src attributes
  sanitized = sanitized.replace(/(href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '$1=""')
  
  // Remove data: protocol from src attributes (potential XSS vector)
  sanitized = sanitized.replace(/src\s*=\s*(?:"data:[^"]*"|'data:[^']*')/gi, 'src=""')
  
  // Remove any tags not in the allowlist
  sanitized = sanitized.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tag) => {
    if (allowedTags.includes(tag.toLowerCase())) {
      return match
    }
    return '' // Strip disallowed tags
  })
  
  return sanitized
}

export function CustomTextWidget({ config }: CustomTextWidgetProps) {
  const rawContent = (config?.content as string) || 'Add custom content here...'
  const showTitle = config?.showTitle !== false
  
  const sanitizedContent = useMemo(() => sanitizeHtml(rawContent), [rawContent])

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
        <div 
          className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 dark:prose-strong:text-gray-100"
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
      </CardContent>
    </Card>
  )
}
