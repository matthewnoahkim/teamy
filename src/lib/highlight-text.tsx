import { JSX } from 'react'

/**
 * Wraps all case-insensitive matches of `searchQuery` in `text` with a
 * yellow highlight mark.  Used by every search input that renders results
 * inline (tests, finance, people, stream …).
 */
export function highlightText(
  text: string | null | undefined,
  searchQuery: string,
): string | (string | JSX.Element)[] {
  if (!text || !searchQuery) return text ?? ''
  const query = searchQuery.trim()
  if (!query) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark
        key={index}
        className="bg-yellow-200 dark:bg-yellow-900 text-foreground px-0.5 rounded"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  )
}
