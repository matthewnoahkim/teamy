'use client'

import { useMemo } from 'react'
import katex from 'katex'

// Renders inline math and auto-detects common patterns within a single line of text.
// Supported:
//   $...$       — explicit inline math (any LaTeX)
//   $$...$$     — handled by the parent (MathText) before reaching here
//   2^2, x^n    — auto superscript (alphanumeric ^ alphanumeric)
//   H_2, CO_2   — auto subscript  (letters _ digits)
function renderInline(line: string): React.ReactNode[] {
  const segments: React.ReactNode[] = []
  // Matches in priority order:
  //   1. $...$            explicit inline LaTeX
  //   2. word^word        e.g. 2^2, x^n, 10^6
  //   3. letters_digits   e.g. H_2, CO_2, x_1
  const pattern = /\$([^$\n]+?)\$|([A-Za-z0-9]+)\^([A-Za-z0-9]+)|([A-Za-z]+)_([0-9]+)/g
  let last = 0
  let key = 0
  let m: RegExpExecArray | null

  while ((m = pattern.exec(line)) !== null) {
    if (m.index > last) segments.push(line.slice(last, m.index))

    let latex: string
    if (m[1] !== undefined) {
      latex = m[1]                       // $...$
    } else if (m[2] !== undefined) {
      latex = `${m[2]}^{${m[3]}}`        // base^exp  →  base^{exp}
    } else {
      latex = `\\text{${m[4]}}_{${m[5]}}` // letters_digits  →  \text{H}_{2}
    }

    try {
      const html = katex.renderToString(latex, { throwOnError: false, displayMode: false })
      segments.push(<span key={key++} dangerouslySetInnerHTML={{ __html: html }} />)
    } catch {
      segments.push(<span key={key++}>{m[0]}</span>)
    }

    last = pattern.lastIndex
  }

  if (last < line.length) segments.push(line.slice(last))
  return segments
}

// Renders a text block that may contain:
//   - $$...$$ display-mode math (possibly spanning multiple lines)
//   - inline math / auto-patterns (handled by renderInline)
//   - plain text (whitespace-pre-wrap preserved)
function MathText({ content, className }: { content: string; className?: string }) {
  const nodes = useMemo(() => {
    const result: React.ReactNode[] = []
    let key = 0

    // Split on $$...$$ blocks first (multiline OK)
    const blockSplit = content.split(/(\$\$[\s\S]+?\$\$)/)

    for (const chunk of blockSplit) {
      if (chunk.startsWith('$$') && chunk.endsWith('$$') && chunk.length > 4) {
        // Display-mode block math
        const latex = chunk.slice(2, -2).trim()
        try {
          const html = katex.renderToString(latex, { throwOnError: false, displayMode: true })
          result.push(
            <div
              key={key++}
              className="my-3 overflow-x-auto text-center"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )
        } catch {
          result.push(<span key={key++}>{chunk}</span>)
        }
        continue
      }

      // Inline chunk — split into lines to preserve newlines
      const lines = chunk.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) result.push('\n')
        const inlineNodes = renderInline(lines[i])
        for (const n of inlineNodes) result.push(n)
      }
    }

    return result
  }, [content])

  return (
    <p className={`whitespace-pre-wrap ${className || 'text-lg'}`}>
      {nodes}
    </p>
  )
}

// ─── Table helpers ────────────────────────────────────────────────────────────

function parseMarkdownTable(markdown: string): { headers: string[]; rows: string[][] } {
  const lines = markdown.trim().split('\n').filter(line => line.trim())
  if (lines.length < 3) return { headers: [], rows: [] }

  const parseRow = (line: string) =>
    line.split('|').slice(1, -1).map(cell => cell.trim())

  const headers = parseRow(lines[0])
  const rows = lines.slice(2).map(parseRow)
  return { headers, rows }
}

function parsePromptContent(content: string) {
  const parts: Array<{
    type: 'text' | 'image' | 'table'
    content: string
    src?: string
    alt?: string
    tableMarkdown?: string
  }> = []

  const combinedRegex =
    /(?:(!\[([^\]]*)\]\((data:image\/[^)]+)\)))|(?:(\|.+\|[\r\n]+\|[-:\s|]+\|[\r\n]+(?:\|.+\|(?:\r?\n(?!\r?\n))?)+))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = combinedRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.substring(lastIndex, match.index).trim()
      if (text) parts.push({ type: 'text', content: text })
    }

    if (match[1]) {
      parts.push({ type: 'image', content: '', src: match[3], alt: match[2] || 'Image' })
    } else if (match[4]) {
      parts.push({ type: 'table', content: '', tableMarkdown: match[4] })
    }

    lastIndex = combinedRegex.lastIndex
  }

  if (lastIndex < content.length) {
    const text = content.substring(lastIndex).trim()
    if (text) parts.push({ type: 'text', content: text })
  }

  if (parts.length === 0) {
    return [{ type: 'text' as const, content: content.trim() }]
  }

  return parts
}

// ─── Main exported component ──────────────────────────────────────────────────

export function QuestionPrompt({
  promptMd,
  className: _className = '',
  imageLayout = 'stacked',
}: {
  promptMd: string | null | undefined
  className?: string
  imageLayout?: 'stacked' | 'side-by-side'
}) {
  if (!promptMd) return null

  const { contextParts, promptParts } = useMemo(() => {
    const parts = promptMd.split('---')
    const hasContext = parts.length === 2
    const contextContent = hasContext ? parts[0].trim() : ''
    const promptContent = hasContext ? parts[1].trim() : promptMd.trim()
    return {
      contextParts: contextContent ? parsePromptContent(contextContent) : [],
      promptParts: parsePromptContent(promptContent),
    }
  }, [promptMd])

  const renderParts = (partsToRender: ReturnType<typeof parsePromptContent>, className = '') => {
    // Group consecutive images for side-by-side layout
    type Grouped =
      | { type: 'text'; content: string }
      | { type: 'image'; src: string; alt: string }
      | { type: 'image-group'; images: Array<{ src: string; alt: string }> }
      | { type: 'table'; tableMarkdown: string }

    const grouped: Grouped[] = []

    if (imageLayout === 'side-by-side') {
      let i = 0
      while (i < partsToRender.length) {
        if (partsToRender[i].type === 'image') {
          const imgs: Array<{ src: string; alt: string }> = []
          while (i < partsToRender.length && partsToRender[i].type === 'image') {
            if (partsToRender[i].src) imgs.push({ src: partsToRender[i].src!, alt: partsToRender[i].alt || 'Image' })
            i++
          }
          if (imgs.length) grouped.push({ type: 'image-group', images: imgs })
        } else {
          const p = partsToRender[i++]
          if (p.type === 'text') grouped.push({ type: 'text', content: p.content })
          else if (p.type === 'table' && p.tableMarkdown) grouped.push({ type: 'table', tableMarkdown: p.tableMarkdown })
        }
      }
    } else {
      for (const p of partsToRender) {
        if (p.type === 'text') grouped.push({ type: 'text', content: p.content })
        else if (p.type === 'image' && p.src) grouped.push({ type: 'image', src: p.src, alt: p.alt || 'Image' })
        else if (p.type === 'table' && p.tableMarkdown) grouped.push({ type: 'table', tableMarkdown: p.tableMarkdown })
      }
    }

    return (
      <div className={className}>
        {grouped.map((part, index) => {
          if (part.type === 'table') {
            const { headers, rows } = parseMarkdownTable(part.tableMarkdown)
            const filteredRows = rows.filter((row, rowIdx) => {
              const isSep = row.every(cell => /^[-–—]+$/.test(cell.trim()))
              if (!isSep) return true
              return rowIdx !== 0 && rowIdx !== rows.length - 1
            })

            return (
              <div key={index} className="my-6 overflow-x-auto">
                <table className="min-w-full border-collapse border border-input bg-background text-sm">
                  <thead>
                    <tr className="bg-muted/30">
                      {headers.map((h, i) => (
                        <td key={i} className="border border-input px-3 py-2 max-w-[200px] break-words whitespace-pre-wrap">{h}</td>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let vi = 0
                      return filteredRows.map((row, ri) => {
                        const isSep = row.every(cell => /^[-–—]+$/.test(cell.trim()))
                        if (isSep) return <tr key={ri} className="bg-background"><td colSpan={row.length} className="border-0 py-4" /></tr>
                        const ci = vi++
                        return (
                          <tr key={ri} className={ci % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                            {row.map((cell, cellIdx) => (
                              <td key={cellIdx} className="border border-input px-3 py-2 max-w-[200px] break-words whitespace-pre-wrap">{cell}</td>
                            ))}
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            )
          }

          if (part.type === 'image-group') {
            return (
              <div key={index} className="my-3 flex flex-wrap gap-2">
                {part.images.map((img, ii) => (
                  <div key={ii} className="flex-1 min-w-[200px] rounded-md border border-input overflow-hidden bg-muted/30">
                    <img src={img.src} alt={img.alt} className="max-w-full max-h-96 object-contain block mx-auto" />
                  </div>
                ))}
              </div>
            )
          }

          if (part.type === 'image') {
            return (
              <div key={index} className="my-3 rounded-md border border-input overflow-hidden bg-muted/30">
                <img src={part.src} alt={part.alt} className="max-w-full max-h-96 object-contain block mx-auto" />
              </div>
            )
          }

          // Text part — rendered with math support
          return <MathText key={index} content={part.content} className={className || 'text-lg'} />
        })}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {contextParts.length > 0 && (
        <div className="space-y-3 pb-3 border-b border-border">
          {renderParts(contextParts)}
        </div>
      )}
      {renderParts(promptParts)}
    </div>
  )
}
