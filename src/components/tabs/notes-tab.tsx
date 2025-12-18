'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { 
  BookOpen, 
  FileText, 
  Save, 
  Download,
  Printer,
  ChevronLeft,
  Clock,
  Info,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  ImageIcon,
  Table,
  Undo,
  Redo,
  Sparkles,
  X,
  Send,
  Loader2,
  FileQuestion,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PageLoading, ButtonLoading } from '@/components/ui/loading-spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ReactMarkdown from 'react-markdown'

interface NotesTabProps {
  clubId: string
  membershipId: string
  division: 'B' | 'C'
  user: {
    id: string
    name?: string | null
    email: string
    image?: string | null
  }
  isAdmin: boolean
}

interface EventNoteRules {
  name: string
  slug: string
  noteType: 'NOTE_SHEET' | 'BINDER'
  sheetCount: number // For note sheets: 1, 2, or 4. For binders: unlimited (represented as 999)
  description: string
}

interface StudyNote {
  id: string
  clubId: string
  membershipId: string
  eventSlug: string
  title: string
  content: string
  noteType: 'NOTE_SHEET' | 'BINDER'
  sheetCount: number
  createdAt: string
  updatedAt: string
}

interface RosterAssignment {
  id: string
  eventId: string
  event: {
    id: string
    name: string
    slug: string
    division: string
  }
}

// Science Olympiad 2024-2025 Note Sheet Rules by Division
const DIV_C_EVENT_RULES: EventNoteRules[] = [
  { name: 'Anatomy and Physiology', slug: 'anatomy-and-physiology', noteType: 'NOTE_SHEET', sheetCount: 1, description: 'One double-sided 8.5" x 11" note sheet' },
  { name: 'Astronomy', slug: 'astronomy', noteType: 'BINDER', sheetCount: 999, description: 'Two 3-ring binders of any size' },
  { name: 'Chemistry Lab', slug: 'chemistry-lab', noteType: 'NOTE_SHEET', sheetCount: 2, description: 'Two double-sided 8.5" x 11" note sheets' },
  { name: 'Circuit Lab', slug: 'circuit-lab', noteType: 'BINDER', sheetCount: 999, description: 'One 3-ring binder of any size' },
  { name: 'Designer Genes', slug: 'designer-genes', noteType: 'NOTE_SHEET', sheetCount: 1, description: 'One double-sided 8.5" x 11" note sheet' },
  { name: 'Disease Detectives', slug: 'disease-detectives', noteType: 'NOTE_SHEET', sheetCount: 1, description: 'One double-sided 8.5" x 11" note sheet' },
  { name: 'Entomology', slug: 'entomology', noteType: 'BINDER', sheetCount: 999, description: 'One 3-ring binder of any size' },
  { name: 'Forensics', slug: 'forensics', noteType: 'NOTE_SHEET', sheetCount: 2, description: 'Two double-sided 8.5" x 11" note sheets' },
  { name: 'Dynamic Planet', slug: 'dynamic-planet', noteType: 'BINDER', sheetCount: 999, description: 'One 3-ring binder of any size' },
  { name: 'Materials Science', slug: 'materials-science', noteType: 'NOTE_SHEET', sheetCount: 2, description: 'Two double-sided 8.5" x 11" note sheets' },
  { name: 'Microbe Mission', slug: 'microbe-mission', noteType: 'NOTE_SHEET', sheetCount: 2, description: 'Two double-sided 8.5" x 11" note sheets' },
  { name: 'Remote Sensing', slug: 'remote-sensing', noteType: 'NOTE_SHEET', sheetCount: 4, description: 'Four double-sided 8.5" x 11" note sheets' },
  { name: 'Rocks and Minerals', slug: 'rocks-and-minerals', noteType: 'BINDER', sheetCount: 999, description: 'One 3-ring binder of any size' },
  { name: 'Water Quality', slug: 'water-quality', noteType: 'NOTE_SHEET', sheetCount: 1, description: 'One double-sided 8.5" x 11" note sheet' },
  { name: 'Wind Power', slug: 'wind-power', noteType: 'NOTE_SHEET', sheetCount: 1, description: 'One double-sided 8.5" x 11" note sheet' },
  { name: 'Write It Do It', slug: 'write-it-do-it', noteType: 'NOTE_SHEET', sheetCount: 1, description: 'Notes created during event' },
]

const DIV_B_EVENT_RULES: EventNoteRules[] = [
  { name: 'Anatomy and Physiology', slug: 'anatomy-and-physiology', noteType: 'NOTE_SHEET', sheetCount: 1, description: 'One double-sided 8.5" x 11" note sheet' },
  { name: 'Crime Busters', slug: 'crime-busters', noteType: 'NOTE_SHEET', sheetCount: 1, description: 'One double-sided 8.5" x 11" note sheet' },
  { name: 'Disease Detectives', slug: 'disease-detectives', noteType: 'NOTE_SHEET', sheetCount: 1, description: 'One double-sided 8.5" x 11" note sheet' },
  { name: 'Dynamic Planet', slug: 'dynamic-planet', noteType: 'BINDER', sheetCount: 999, description: 'One 3-ring binder of any size' },
  { name: 'Ecology', slug: 'ecology', noteType: 'NOTE_SHEET', sheetCount: 2, description: 'Two double-sided 8.5" x 11" note sheets' },
  { name: 'Entomology', slug: 'entomology', noteType: 'BINDER', sheetCount: 999, description: 'One 3-ring binder of any size' },
  { name: 'Fossils', slug: 'fossils', noteType: 'BINDER', sheetCount: 999, description: 'One 3-ring binder of any size' },
  { name: 'Heredity', slug: 'heredity', noteType: 'NOTE_SHEET', sheetCount: 1, description: 'One double-sided 8.5" x 11" note sheet' },
  { name: 'Meteorology', slug: 'meteorology', noteType: 'BINDER', sheetCount: 999, description: 'One 3-ring binder of any size' },
  { name: 'Microbe Mission', slug: 'microbe-mission', noteType: 'NOTE_SHEET', sheetCount: 2, description: 'Two double-sided 8.5" x 11" note sheets' },
  { name: 'Potions and Poisons', slug: 'potions-and-poisons', noteType: 'NOTE_SHEET', sheetCount: 1, description: 'One double-sided 8.5" x 11" note sheet' },
  { name: 'Reach for the Stars', slug: 'reach-for-the-stars', noteType: 'NOTE_SHEET', sheetCount: 2, description: 'Two double-sided 8.5" x 11" note sheets' },
  { name: 'Road Scholar', slug: 'road-scholar', noteType: 'NOTE_SHEET', sheetCount: 4, description: 'Four double-sided 8.5" x 11" note sheets' },
  { name: 'Water Quality', slug: 'water-quality', noteType: 'NOTE_SHEET', sheetCount: 1, description: 'One double-sided 8.5" x 11" note sheet' },
  { name: 'Wind Power', slug: 'wind-power', noteType: 'NOTE_SHEET', sheetCount: 1, description: 'Notes provided at event' },
]

// Simple text editor component
import React from 'react'

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  onSave: () => void
  maxPages: number
  noteType: 'NOTE_SHEET' | 'BINDER'
  saving: boolean
}

export interface RichTextEditorRef {
  appendContent: (html: string) => void
}

const RichTextEditor = React.forwardRef<RichTextEditorRef, RichTextEditorProps>(({ 
  content, 
  onChange, 
  onSave,
  maxPages,
  noteType,
  saving
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const [showImageDialog, setShowImageDialog] = useState(false)
  const [imageUrl, setImageUrl] = useState('')

  // Expose methods to parent via ref
  React.useImperativeHandle(ref, () => ({
    appendContent: (html: string) => {
      if (editorRef.current) {
        editorRef.current.innerHTML += html
        onChange(editorRef.current.innerHTML)
      }
    }
  }))

  // Initialize content
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content || '<p>Start typing your notes here...</p>'
    }
  }, [])

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    handleInput()
  }

  const insertImage = () => {
    if (imageUrl) {
      execCommand('insertImage', imageUrl)
      setImageUrl('')
      setShowImageDialog(false)
    }
  }

  const insertTable = () => {
    const table = `
      <table style="border-collapse: collapse; width: 100%; margin: 10px 0;">
        <tr>
          <td style="border: 1px solid #ccc; padding: 8px;">&nbsp;</td>
          <td style="border: 1px solid #ccc; padding: 8px;">&nbsp;</td>
          <td style="border: 1px solid #ccc; padding: 8px;">&nbsp;</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ccc; padding: 8px;">&nbsp;</td>
          <td style="border: 1px solid #ccc; padding: 8px;">&nbsp;</td>
          <td style="border: 1px solid #ccc; padding: 8px;">&nbsp;</td>
        </tr>
      </table>
    `
    execCommand('insertHTML', table)
  }

  // Calculate approximate page count based on content
  const calculatePages = () => {
    if (!editorRef.current) return 1
    const charCount = editorRef.current.innerText.length
    // Approximate: ~3000 characters per page with size 8 font
    return Math.max(1, Math.ceil(charCount / 3000))
  }

  const currentPages = calculatePages()
  const isOverLimit = noteType === 'NOTE_SHEET' && currentPages > maxPages

  return (
    <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-950">
      {/* Toolbar */}
      <div className="border-b bg-slate-50 dark:bg-slate-900 p-2 flex flex-wrap gap-1 items-center">
        <div className="flex items-center gap-1 border-r pr-2 mr-2">
          <Button variant="ghost" size="sm" onClick={() => execCommand('undo')} title="Undo">
            <Undo className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => execCommand('redo')} title="Redo">
            <Redo className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-1 border-r pr-2 mr-2">
          <Button variant="ghost" size="sm" onClick={() => execCommand('bold')} title="Bold">
            <Bold className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => execCommand('italic')} title="Italic">
            <Italic className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => execCommand('underline')} title="Underline">
            <Underline className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 border-r pr-2 mr-2">
          <Button variant="ghost" size="sm" onClick={() => execCommand('formatBlock', 'h1')} title="Heading 1">
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => execCommand('formatBlock', 'h2')} title="Heading 2">
            <Heading2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 border-r pr-2 mr-2">
          <Button variant="ghost" size="sm" onClick={() => execCommand('insertUnorderedList')} title="Bullet List">
            <List className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => execCommand('insertOrderedList')} title="Numbered List">
            <ListOrdered className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 border-r pr-2 mr-2">
          <Button variant="ghost" size="sm" onClick={() => execCommand('justifyLeft')} title="Align Left">
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => execCommand('justifyCenter')} title="Align Center">
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => execCommand('justifyRight')} title="Align Right">
            <AlignRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 border-r pr-2 mr-2">
          <Button variant="ghost" size="sm" onClick={() => setShowImageDialog(true)} title="Insert Image">
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={insertTable} title="Insert Table">
            <Table className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <Select
            defaultValue="8"
            onValueChange={(size) => execCommand('fontSize', size === '8' ? '1' : size === '10' ? '2' : size === '12' ? '3' : '4')}
          >
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="8">8pt</SelectItem>
              <SelectItem value="10">10pt</SelectItem>
              <SelectItem value="12">12pt</SelectItem>
              <SelectItem value="14">14pt</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={onSave} disabled={saving || isOverLimit} size="sm" className="ml-2">
          {saving ? <ButtonLoading /> : <Save className="h-4 w-4 mr-1" />}
          Save
        </Button>
      </div>

      {/* Editor Area */}
      <div 
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="min-h-[600px] p-6 focus:outline-none"
        style={{
          fontFamily: 'Times New Roman, serif',
          fontSize: '8pt',
          lineHeight: '1.2',
        }}
        suppressContentEditableWarning
      />

      {/* Footer with page info */}
      <div className={`border-t p-2 flex justify-between items-center text-sm ${isOverLimit ? 'bg-red-50 dark:bg-red-950' : 'bg-slate-50 dark:bg-slate-900'}`}>
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {noteType === 'BINDER' ? 'Binder - Unlimited pages' : `Note Sheet - Max ${maxPages} page${maxPages > 1 ? 's' : ''}`}
          </span>
        </div>
        <div className={isOverLimit ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
          {isOverLimit && '⚠️ '} Estimated: ~{currentPages} page{currentPages > 1 ? 's' : ''}
        </div>
      </div>

      {/* Image Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Image</DialogTitle>
            <DialogDescription>Enter the URL of the image you want to insert.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="image-url">Image URL</Label>
            <Input
              id="image-url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.png"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImageDialog(false)}>Cancel</Button>
            <Button onClick={insertImage}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})

RichTextEditor.displayName = 'RichTextEditor'

// Simple markdown to HTML converter for notes
function markdownToHtml(markdown: string): string {
  let html = markdown
  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>')
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>')
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>')
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
  html = html.replace(/__(.*?)__/gim, '<strong>$1</strong>')
  // Italic
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>')
  html = html.replace(/_(.*?)_/gim, '<em>$1</em>')
  // Lists - process line by line
  const lines = html.split('\n')
  let inList = false
  const processedLines = lines.map(line => {
    const listMatch = line.match(/^\s*[-*]\s+(.*)$/)
    if (listMatch) {
      const prefix = !inList ? '<ul>' : ''
      inList = true
      return prefix + '<li>' + listMatch[1] + '</li>'
    } else if (inList && line.trim() === '') {
      inList = false
      return '</ul>' + line
    }
    return line
  })
  if (inList) processedLines.push('</ul>')
  html = processedLines.join('\n')
  // Line breaks (but not inside tags)
  html = html.replace(/\n/gim, '<br>')
  // Clean up <br> after block elements
  html = html.replace(/<\/(h[1-6]|ul|ol|li|p)><br>/gi, '</$1>')
  html = html.replace(/<br><(h[1-6]|ul|ol)/gi, '<$1')
  return html
}

// AI Chat Assistant
function AIChatAssistant({ 
  eventName, 
  onAddToNotes 
}: { 
  eventName: string
  onAddToNotes: (text: string) => void 
}) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const response = await fetch('/api/ai/study-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage,
          eventName,
          context: messages.slice(-4)
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to get AI response. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddToNotes = (content: string) => {
    // Convert markdown to HTML for the notes editor
    const htmlContent = markdownToHtml(content)
    onAddToNotes(htmlContent)
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          AI Study Assistant
        </CardTitle>
        <CardDescription className="text-xs">
          Ask questions about {eventName} or get help with your notes
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        <ScrollArea className="flex-1 pr-2 mb-2">
          <div className="space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Ask me anything about {eventName}!</p>
                <p className="text-xs mt-1">I can help fact-check, explain concepts, or suggest content.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown
                        components={{
                          // Style headings
                          h1: ({ children }) => <h1 className="text-base font-bold mt-2 mb-1">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-sm font-bold mt-2 mb-1">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-semibold mt-1 mb-1">{children}</h3>,
                          // Style lists
                          ul: ({ children }) => <ul className="list-disc list-inside my-1 space-y-0.5">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside my-1 space-y-0.5">{children}</ol>,
                          li: ({ children }) => <li className="text-sm">{children}</li>,
                          // Style paragraphs
                          p: ({ children }) => <p className="my-1">{children}</p>,
                          // Style code
                          code: ({ children }) => (
                            <code className="bg-background/50 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
                          ),
                          // Style bold/italic
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          em: ({ children }) => <em className="italic">{children}</em>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                  {msg.role === 'assistant' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs mt-2 w-full border border-border/50"
                      onClick={() => handleAddToNotes(msg.content)}
                    >
                      Add to notes
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            disabled={loading}
          />
          <Button size="sm" onClick={sendMessage} disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function NotesTab({ clubId, membershipId, division, user, isAdmin }: NotesTabProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [assignedEvents, setAssignedEvents] = useState<RosterAssignment[]>([])
  const [notes, setNotes] = useState<StudyNote[]>([])
  const [selectedEvent, setSelectedEvent] = useState<EventNoteRules | null>(null)
  const [currentNote, setCurrentNote] = useState<StudyNote | null>(null)
  const [editorContent, setEditorContent] = useState('')
  const [showAIChat, setShowAIChat] = useState(false)
  const editorRef = useRef<RichTextEditorRef>(null)

  const eventRules = division === 'C' ? DIV_C_EVENT_RULES : DIV_B_EVENT_RULES

  // Normalize event name for matching (lowercase, remove special chars)
  const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

  // Get events that allow notes/binders - match by normalized name
  const getAssignedNoteEvents = useCallback(() => {
    // Create a map of normalized names to assigned events
    const assignedNormalizedNames = new Set(
      assignedEvents.map(a => normalizeName(a.event.name))
    )
    
    // Filter event rules by matching normalized names
    return eventRules.filter(rule => 
      assignedNormalizedNames.has(normalizeName(rule.name))
    )
  }, [assignedEvents, eventRules])

  const fetchData = useCallback(async () => {
    try {
      // Fetch roster assignments for this user
      const [assignmentsRes, notesRes] = await Promise.all([
        fetch(`/api/roster-assignments?clubId=${clubId}&membershipId=${membershipId}`),
        fetch(`/api/study-notes?clubId=${clubId}&membershipId=${membershipId}`),
      ])

      if (assignmentsRes.ok) {
        const data = await assignmentsRes.json()
        setAssignedEvents(data.assignments || [])
      }

      if (notesRes.ok) {
        const data = await notesRes.json()
        setNotes(data.notes || [])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load notes data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [clubId, membershipId, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const selectEvent = (eventRule: EventNoteRules) => {
    setSelectedEvent(eventRule)
    const existingNote = notes.find(n => n.eventSlug === eventRule.slug)
    if (existingNote) {
      setCurrentNote(existingNote)
      setEditorContent(existingNote.content)
    } else {
      setCurrentNote(null)
      setEditorContent('')
    }
  }

  const saveNote = async () => {
    if (!selectedEvent) return

    setSaving(true)
    try {
      const response = await fetch('/api/study-notes', {
        method: currentNote ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentNote?.id,
          clubId,
          membershipId,
          eventSlug: selectedEvent.slug,
          title: `${selectedEvent.name} Notes`,
          content: editorContent,
          noteType: selectedEvent.noteType,
          sheetCount: selectedEvent.sheetCount,
        }),
      })

      if (!response.ok) throw new Error('Failed to save note')

      const data = await response.json()
      
      if (currentNote) {
        setNotes(prev => prev.map(n => n.id === data.note.id ? data.note : n))
      } else {
        setNotes(prev => [...prev, data.note])
      }
      setCurrentNote(data.note)

      toast({
        title: 'Saved',
        description: 'Your notes have been saved successfully.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save notes. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const addToNotes = (htmlContent: string) => {
    // Content may already be HTML (from markdown conversion) or plain text
    const wrappedContent = htmlContent.startsWith('<') ? htmlContent : `<p>${htmlContent}</p>`
    if (editorRef.current) {
      editorRef.current.appendContent(wrappedContent)
    } else {
      // Fallback if ref not available
      setEditorContent(prev => prev + wrappedContent)
    }
    toast({
      title: 'Added to notes',
      description: 'The content has been added to your notes.',
    })
  }

  const printNote = () => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${selectedEvent?.name} Notes</title>
            <style>
              body { 
                font-family: 'Times New Roman', serif; 
                font-size: 8pt; 
                line-height: 1.2; 
                margin: 0.5in;
              }
              table { border-collapse: collapse; width: 100%; }
              td { border: 1px solid #ccc; padding: 4px; }
              img { max-width: 100%; }
            </style>
          </head>
          <body>${editorContent}</body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  if (loading) {
    return (
      <PageLoading
        title="Loading notes"
        description="Fetching your study materials..."
        variant="orbit"
      />
    )
  }

  const availableEvents = getAssignedNoteEvents()

  // If editing a note
  if (selectedEvent) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedEvent(null)}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div>
              <h2 className="text-xl font-bold">{selectedEvent.name}</h2>
              <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={printNote}>
              <Printer className="h-4 w-4 mr-1" />
              Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAIChat(!showAIChat)}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              AI Assistant
            </Button>
          </div>
        </div>

        {/* Editor and AI Chat */}
        <div className="flex gap-4">
          <div className={showAIChat ? 'flex-1' : 'w-full'}>
            <RichTextEditor
              ref={editorRef}
              content={editorContent}
              onChange={setEditorContent}
              onSave={saveNote}
              maxPages={selectedEvent.sheetCount}
              noteType={selectedEvent.noteType}
              saving={saving}
            />
          </div>
          {showAIChat && (
            <div className="w-80 flex-shrink-0">
              <AIChatAssistant
                eventName={selectedEvent.name}
                onAddToNotes={addToNotes}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  // Event selection view
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Study Notes</h2>
          <p className="text-muted-foreground">
            Create and manage note sheets for your assigned events
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          Division {division}
        </Badge>
      </div>

      {availableEvents.length === 0 && assignedEvents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileQuestion className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Events Assigned</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              You need to be assigned to events to create study materials.
              Ask your club admin to assign you to events in the People tab.
            </p>
          </CardContent>
        </Card>
      ) : availableEvents.length === 0 && assignedEvents.length > 0 ? (
        /* User has assigned events but none match note sheet rules - show all their events */
        <div className="space-y-4">
          <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
            <CardContent className="py-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                You are assigned to {assignedEvents.length} event{assignedEvents.length !== 1 ? 's' : ''}, 
                but none have specific note sheet rules. You can still create study notes for any of your assigned events below.
              </p>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {assignedEvents.map((assignment) => {
              const existingNote = notes.find(n => n.eventSlug === assignment.event.slug)
              const hasNote = !!existingNote
              
              // Create a generic rule for this event
              const genericRule: EventNoteRules = {
                name: assignment.event.name,
                slug: assignment.event.slug,
                noteType: 'BINDER',
                sheetCount: 999,
                description: 'Study notes for this event (no specific restrictions)'
              }
              
              return (
                <Card 
                  key={assignment.id}
                  className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
                  onClick={() => selectEvent(genericRule)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{assignment.event.name}</CardTitle>
                      <Badge variant="secondary">Notes</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">Study notes (unlimited)</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        {hasNote ? (
                          <>
                            <FileText className="h-4 w-4 text-green-500" />
                            <span className="text-green-600 dark:text-green-400">Notes created</span>
                          </>
                        ) : (
                          <>
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">No notes yet</span>
                          </>
                        )}
                      </div>
                      {hasNote && existingNote && (
                        <span className="text-xs text-muted-foreground">
                          Updated {new Date(existingNote.updatedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {availableEvents.map((eventRule) => {
              const existingNote = notes.find(n => n.eventSlug === eventRule.slug)
              const hasNote = !!existingNote
              
              return (
                <Card 
                  key={eventRule.slug}
                  className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
                  onClick={() => selectEvent(eventRule)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{eventRule.name}</CardTitle>
                      <Badge variant={eventRule.noteType === 'BINDER' ? 'default' : 'secondary'}>
                        {eventRule.noteType === 'BINDER' ? 'Binder' : `${eventRule.sheetCount} Sheet${eventRule.sheetCount > 1 ? 's' : ''}`}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">{eventRule.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        {hasNote ? (
                          <>
                            <FileText className="h-4 w-4 text-green-500" />
                            <span className="text-green-600 dark:text-green-400">Notes created</span>
                          </>
                        ) : (
                          <>
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">No notes yet</span>
                          </>
                        )}
                      </div>
                      {hasNote && existingNote && (
                        <span className="text-xs text-muted-foreground">
                          Updated {new Date(existingNote.updatedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default NotesTab

