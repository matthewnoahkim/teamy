import { useMemo } from 'react'

// Helper to parse markdown table
function parseMarkdownTable(markdown: string): { headers: string[]; rows: string[][] } {
  const lines = markdown.trim().split('\n').filter(line => line.trim())
  if (lines.length < 3) return { headers: [], rows: [] }
  
  const parseRow = (line: string) => 
    line.split('|').slice(1, -1).map(cell => cell.trim())
  
  const headers = parseRow(lines[0])
  // Skip separator line (lines[1]) and parse remaining rows
  const rows = lines.slice(2).map(parseRow)
  
  return { headers, rows }
}

function parsePromptContent(content: string) {
  const parts: Array<{ type: 'text' | 'image' | 'table'; content: string; src?: string; alt?: string; tableMarkdown?: string }> = []
  
  // Create a combined regex to find both images and tables in order
  const combinedRegex = /(?:(!\[([^\]]*)\]\((data:image\/[^)]+)\)))|(?:(\|.+\|[\r\n]+\|[-:\s|]+\|[\r\n]+(?:\|.+\|(?:\r?\n(?!\r?\n))?)+))/g
  let lastIndex = 0
  let match

  while ((match = combinedRegex.exec(content)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      const text = content.substring(lastIndex, match.index).trim()
      if (text) {
        parts.push({ type: 'text', content: text })
      }
    }
    
    if (match[1]) {
      // It's an image
      parts.push({
        type: 'image',
        content: '',
        src: match[3],
        alt: match[2] || 'Image'
      })
    } else if (match[4]) {
      // It's a table
      parts.push({
        type: 'table',
        content: '',
        tableMarkdown: match[4]
      })
    }
    
    lastIndex = combinedRegex.lastIndex
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const text = content.substring(lastIndex).trim()
    if (text) {
      parts.push({ type: 'text', content: text })
    }
  }

  // If no images or tables found, return the whole content as text
  if (parts.length === 0) {
    return [{ type: 'text' as const, content: content.trim() }]
  }

  return parts
}

// Component to render markdown prompt with images and tables
export function QuestionPrompt({ promptMd, className: _className = '', imageLayout = 'stacked' }: { promptMd: string | null | undefined; className?: string; imageLayout?: 'stacked' | 'side-by-side' }) {
  // Handle null/undefined promptMd
  if (!promptMd) {
    return null
  }

  const { contextParts, promptParts } = useMemo(() => {
    // Handle context/prompt split (separated by ---)
    const parts = promptMd.split('---')
    const hasContext = parts.length === 2
    const contextContent = hasContext ? parts[0].trim() : ''
    const promptContent = hasContext ? parts[1].trim() : promptMd.trim()

    return {
      contextParts: contextContent ? parsePromptContent(contextContent) : [],
      promptParts: parsePromptContent(promptContent),
    }
  }, [promptMd])

  const renderParts = (partsToRender: typeof promptParts, className = '') => {
    // Group consecutive images for side-by-side layout
    const groupedParts: Array<{ 
      type: 'text' | 'image' | 'image-group' | 'table'; 
      content?: string; 
      images?: Array<{ src: string; alt: string }>; 
      src?: string; 
      alt?: string;
      tableMarkdown?: string;
    }> = []
    
    if (imageLayout === 'side-by-side') {
      let i = 0
      while (i < partsToRender.length) {
        if (partsToRender[i].type === 'image') {
          // Collect consecutive images
          const imageGroup: Array<{ src: string; alt: string }> = []
          while (i < partsToRender.length && partsToRender[i].type === 'image') {
            if (partsToRender[i].src) {
              imageGroup.push({ src: partsToRender[i].src!, alt: partsToRender[i].alt || 'Image' })
            }
            i++
          }
          if (imageGroup.length > 0) {
            groupedParts.push({ type: 'image-group', images: imageGroup })
          }
        } else {
          groupedParts.push(partsToRender[i])
          i++
        }
      }
    } else {
      groupedParts.push(...partsToRender)
    }

    return (
      <div className={className}>
        {groupedParts.map((part, index) => {
          if (part.type === 'table' && part.tableMarkdown) {
            const { headers, rows } = parseMarkdownTable(part.tableMarkdown)
            
            // Filter out separator rows at the beginning or end of the table
            const filteredRows = rows.filter((row, rowIdx) => {
              const isSeparator = row.every(cell => /^[-–—]+$/.test(cell.trim()))
              if (!isSeparator) return true
              
              // Skip separators at the very beginning or very end
              if (rowIdx === 0 || rowIdx === rows.length - 1) return false
              
              return true
            })
            
            return (
              <div key={index} className="my-6 overflow-x-auto">
                <table className="min-w-full border-collapse border border-input bg-background text-sm">
                  <thead>
                    <tr className="bg-muted/30">
                      {headers.map((header, i) => (
                        <td key={i} className="border border-input px-3 py-2 max-w-[200px] break-words whitespace-pre-wrap">
                          {header}
                        </td>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let visualRowIdx = 0
                      return filteredRows.map((row, rowIdx) => {
                        // Check if this is a separator row (all cells are "---" or similar)
                        const isSeparator = row.every(cell => /^[-–—]+$/.test(cell.trim()))
                        
                        if (isSeparator) {
                          return (
                            <tr key={rowIdx} className="bg-background">
                              <td colSpan={row.length} className="border-0 py-4"></td>
                            </tr>
                          )
                        }
                        
                        const currentVisualIdx = visualRowIdx
                        visualRowIdx++
                        
                        return (
                          <tr key={rowIdx} className={currentVisualIdx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                            {row.map((cell, cellIdx) => (
                              <td key={cellIdx} className="border border-input px-3 py-2 max-w-[200px] break-words whitespace-pre-wrap">
                                {cell}
                              </td>
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
          if (part.type === 'image-group' && part.images) {
            return (
              <div key={index} className="my-3 flex flex-wrap gap-2">
                {part.images.map((img, imgIndex) => (
                  <div key={imgIndex} className="flex-1 min-w-[200px] rounded-md border border-input overflow-hidden bg-muted/30">
                    <img
                      src={img.src}
                      alt={img.alt}
                      className="max-w-full max-h-96 object-contain block mx-auto"
                    />
                  </div>
                ))}
              </div>
            )
          }
          if (part.type === 'image' && part.src) {
            return (
              <div key={index} className="my-3 rounded-md border border-input overflow-hidden bg-muted/30">
                <img
                  src={part.src}
                  alt={part.alt || 'Image'}
                  className="max-w-full max-h-96 object-contain block mx-auto"
                />
              </div>
            )
          }
          return (
            <p key={index} className={`whitespace-pre-wrap ${className || 'text-lg'}`}>
              {part.content}
            </p>
          )
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

