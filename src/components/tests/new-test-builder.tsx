'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { nanoid } from 'nanoid'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  Image as ImageIcon,
  Lock,
  Play,
  Plus,
  ShieldAlert,
  Trash2,
  Users,
  Send,
  ArrowUp,
  ArrowDown,
  GripVertical,
  LayoutGrid,
  LayoutList,
  Upload,
  Sparkles,
  Table as TableIcon,
} from 'lucide-react'
import { DuplicateTestButton } from '@/components/tests/duplicate-test-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { QuestionPrompt } from '@/components/tests/question-prompt'
import { ImportedQuestion, ImportedQuestionType } from '@/lib/import-types'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type QuestionType = 'MCQ_SINGLE' | 'MCQ_MULTI' | 'LONG_TEXT' | 'FILL_BLANK' | 'TEXT_BLOCK' | 'TRUE_FALSE'

interface TeamInfo {
  id: string
  name: string
}

interface OptionDraft {
  id: string
  label: string
  isCorrect: boolean
}

interface FRQPart {
  id: string
  label: string // e.g., 'a', 'b', 'c', 'd'
  prompt: string
  points: number
}

interface TableData {
  id: string
  markdown: string
}

interface QuestionDraft {
  id: string
  type: QuestionType
  prompt: string
  context: string
  explanation: string
  points: number
  options: OptionDraft[]
  shuffleOptions: boolean
  frqParts?: FRQPart[] // For multi-part FRQ questions
  contextTables?: TableData[] // Tables for context field
  promptTables?: TableData[] // Tables for prompt field
  blankAnswers?: string[] // Correct answers for each blank in fill-in-the-blank questions
  blankPoints?: (number | null)[] // Optional points allocation for each blank
}

interface NewTestBuilderProps {
  clubId?: string
  clubName?: string
  clubDivision?: 'B' | 'C'
  teams?: TeamInfo[]
  tournamentId?: string
  tournamentName?: string
  tournamentDivision?: 'B' | 'C'
  // ES (Event Supervisor) mode props
  esMode?: boolean
  staffMembershipId?: string
  eventId?: string
  eventName?: string
  test?: {
    id: string
    name: string
    description: string | null
    instructions: string | null
    durationMinutes: number
    maxAttempts: number | null
    scoreReleaseMode: 'NONE' | 'SCORE_ONLY' | 'SCORE_WITH_WRONG' | 'FULL_TEST'
    randomizeQuestionOrder: boolean
    randomizeOptionOrder: boolean
    requireFullscreen: boolean
    allowCalculator: boolean
    calculatorType: 'FOUR_FUNCTION' | 'SCIENTIFIC' | 'GRAPHING' | null
    allowNoteSheet: boolean
    noteSheetInstructions: string | null
    status: 'DRAFT' | 'PUBLISHED' | 'CLOSED'
    assignments: Array<{
      assignedScope: 'CLUB' | 'TEAM' | 'PERSONAL'
      teamId: string | null
      team: { id: string; name: string } | null
    }>
    questions: Array<{
      id: string
      type: string
      promptMd: string
      explanation: string | null
      points: number
      shuffleOptions: boolean
      options: Array<{
        id: string
        label: string
        isCorrect: boolean
        order: number
      }>
    }>
  }
}

const MAX_IMAGE_SIZE = 2 * 1024 * 1024 // 2MB

// Helper function to normalize blank markers (number unnumbered [blank] markers)
function normalizeBlankMarkers(text: string): string {
  const blankMatches = text.match(/\[blank\d*\]/g) || []
  if (blankMatches.length === 0) return text
  
  // Use a temporary placeholder approach to preserve positions
  const placeholders: string[] = []
  let tempCounter = 0
  let normalized = text.replace(/\[blank\d*\]/g, () => {
    placeholders.push(`__BLANK_PLACEHOLDER_${tempCounter++}__`)
    return placeholders[placeholders.length - 1]
  })
  
  // Replace placeholders with numbered blanks sequentially
  placeholders.forEach((placeholder, index) => {
    normalized = normalized.replace(placeholder, `[blank${index + 1}]`)
  })
  
  return normalized
}

// Parse promptMd to extract context, prompt, tables, and FRQ parts
function parsePromptMd(promptMd: string): { 
  context: string; 
  prompt: string; 
  frqParts?: FRQPart[];
  contextTables?: TableData[];
  promptTables?: TableData[];
} {
  // Check for FRQ parts
  const frqPartsMatch = promptMd.match(/---FRQ_PARTS---\n\n([\s\S]+)$/)
  let mainContent = promptMd
  let frqParts: FRQPart[] | undefined = undefined
  
  if (frqPartsMatch) {
    mainContent = promptMd.substring(0, frqPartsMatch.index).trim()
    const partsText = frqPartsMatch[1]
    
    // Parse individual parts
    const partRegex = /\[PART:([a-z]):(\d+(?:\.\d+)?)\]\n([\s\S]*?)(?=\n\n\[PART:|$)/g
    const parsedParts: FRQPart[] = []
    let match
    
    while ((match = partRegex.exec(partsText)) !== null) {
      parsedParts.push({
        id: nanoid(),
        label: match[1], // This is preserved from saved data but will be overridden by dynamic label in UI
        points: parseFloat(match[2]),
        prompt: match[3].trim(),
      })
    }
    
    if (parsedParts.length > 0) {
      frqParts = parsedParts
    }
  }
  
  // Helper to extract tables from a section
  const extractTablesFromSection = (section: string): { text: string; tables: TableData[] } => {
    const tablesMatch = section.match(/---TABLES---\n\n([\s\S]+)$/)
    if (tablesMatch) {
      const textContent = section.substring(0, tablesMatch.index).trim()
      const tablesContent = tablesMatch[1]
      const tables = extractTables(tablesContent)
      return { text: textContent, tables }
    }
    return { text: section.trim(), tables: [] }
  }
  
  // Parse context and prompt
  const parts = mainContent.split('---').map(p => p.trim()).filter(p => p)
  
  if (parts.length === 2) {
    const contextData = extractTablesFromSection(parts[0])
    const promptData = extractTablesFromSection(parts[1])
    
    return { 
      context: contextData.text, 
      prompt: promptData.text, 
      frqParts,
      contextTables: contextData.tables.length > 0 ? contextData.tables : undefined,
      promptTables: promptData.tables.length > 0 ? promptData.tables : undefined,
    }
  } else if (parts.length === 1) {
    const promptData = extractTablesFromSection(parts[0])
    return { 
      context: '', 
      prompt: promptData.text, 
      frqParts,
      promptTables: promptData.tables.length > 0 ? promptData.tables : undefined,
    }
  }
  
  return { context: '', prompt: mainContent.trim(), frqParts }
}

// Extract images from markdown content
function extractImages(content: string): Array<{ alt: string; src: string }> {
  const imageRegex = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g
  const images: Array<{ alt: string; src: string }> = []
  let match
  while ((match = imageRegex.exec(content)) !== null) {
    images.push({ alt: match[1] || 'Image', src: match[2] })
  }
  return images
}

// Extract tables from markdown content
function extractTables(content: string): Array<{ id: string; markdown: string }> {
  const tableRegex = /(\|.+\|[\r\n]+\|[-:\s|]+\|[\r\n]+(?:\|.+\|[\r\n]*)+)/g
  const tables: Array<{ id: string; markdown: string }> = []
  let match
  while ((match = tableRegex.exec(content)) !== null) {
    tables.push({ id: nanoid(), markdown: match[1].trim() })
  }
  return tables
}

// Convert markdown table to structured data for editing
function markdownTableToData(markdown: string): { headers: string[]; rows: string[][] } {
  const lines = markdown.trim().split('\n').filter(line => line.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  
  const parseRow = (line: string) => 
    line.split('|').slice(1, -1).map(cell => cell.trim())
  
  const headers = parseRow(lines[0])
  const rows = lines.slice(2).map(parseRow) // Skip separator line
  
  return { headers, rows }
}

// Convert structured data back to markdown table
function dataToMarkdownTable(headers: string[], rows: string[][]): string {
  const headerLine = '| ' + headers.join(' | ') + ' |'
  const separatorLine = '| ' + headers.map(() => '---').join(' | ') + ' |'
  const bodyLines = rows.map(row => '| ' + row.join(' | ') + ' |').join('\n')
  return `${headerLine}\n${separatorLine}\n${bodyLines}`
}

// Remove image markdown from content for textarea display
function removeImageMarkdown(content: string): string {
  // Don't trim - preserve all spaces including leading/trailing
  return content.replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, '')
}

// Remove table markdown from content for textarea display
function removeTableMarkdown(content: string): string {
  return content.replace(/(\|.+\|[\r\n]+\|[-:\s|]+\|[\r\n]+(?:\|.+\|[\r\n]*)+)/g, '').trim()
}

// Reconstruct markdown with images (tables are stored separately now)
function reconstructMarkdown(
  text: string, 
  images: Array<{ alt: string; src: string }>
): string {
  // Don't trim - preserve all spaces including leading/trailing
  const textPart = text
  const imageParts = images.map(img => `![${img.alt}](${img.src})`).join('\n\n')
  
  if (textPart && imageParts) {
    return `${textPart}\n\n${imageParts}`
  }
  return textPart || imageParts
}

// Generate a markdown table with empty cells
function generateMarkdownTable(rows: number, cols: number): string {
  const header = '| ' + Array(cols).fill('').join(' | ') + ' |'
  const separator = '| ' + Array(cols).fill('---').join(' | ') + ' |'
  const body = Array(rows - 1).fill(0).map((_, rowIdx) => 
    '| ' + Array(cols).fill('').join(' | ') + ' |'
  ).join('\n')
  return `${header}\n${separator}\n${body}`
}

export function NewTestBuilder({ 
  clubId, 
  clubName, 
  clubDivision, 
  teams, 
  tournamentId, 
  tournamentName, 
  tournamentDivision, 
  esMode,
  staffMembershipId,
  eventId: initialEventId,
  eventName,
  test 
}: NewTestBuilderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  
  // Check if we're in TD portal (pathname starts with /td/)
  const isInTDPortal = pathname?.startsWith('/td/') ?? false
  const [saving, setSaving] = useState(false)
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [calendarModalOpen, setCalendarModalOpen] = useState(false)
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [addToCalendar, setAddToCalendar] = useState(false)
  const [events, setEvents] = useState<Array<{ id: string; name: string }>>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importStartTime, setImportStartTime] = useState<number | null>(null)
  const [estimatedTimeSeconds, setEstimatedTimeSeconds] = useState<number>(30)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)
  // Helper to format date for datetime-local input (YYYY-MM-DDTHH:mm)
  const formatDateTimeLocal = (date: Date | string | null | undefined): string => {
    if (!date) return ''
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''
    // Get local date/time string in format YYYY-MM-DDTHH:mm
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const [publishFormData, setPublishFormData] = useState({
    startAt: test?.startAt ? formatDateTimeLocal(test.startAt) : '',
    endAt: test?.endAt ? formatDateTimeLocal(test.endAt) : '',
    testPassword: '',
    testPasswordConfirm: '',
    releaseScoresAt: '',
    maxAttempts: test?.maxAttempts?.toString() || '',
    scoreReleaseMode: (test?.scoreReleaseMode || 'FULL_TEST') as 'NONE' | 'SCORE_ONLY' | 'SCORE_WITH_WRONG' | 'FULL_TEST',
    requireFullscreen: test?.requireFullscreen !== undefined ? test.requireFullscreen : true,
  })
  const [hasFixedWindow, setHasFixedWindow] = useState(test?.startAt !== null && test?.startAt !== undefined && test?.endAt !== null && test?.endAt !== undefined)
  const [dateTimeErrors, setDateTimeErrors] = useState<{ startAt?: string; endAt?: string }>({})

  const isEditMode = !!test

  const [assignmentMode, setAssignmentMode] = useState<'CLUB' | 'TEAM' | 'EVENT'>(() => {
    if (test) {
      const hasTeamAssignments = test.assignments.some(a => a.assignedScope === 'TEAM')
      return hasTeamAssignments ? 'TEAM' : 'CLUB'
    }
    return 'CLUB'
  })
  
  const [selectedTeams, setSelectedTeams] = useState<string[]>(() => {
    if (test) {
      return test.assignments
        .filter(a => a.assignedScope === 'TEAM' && a.teamId)
        .map(a => a.teamId!)
    }
    return []
  })

  const [selectedEventId, setSelectedEventId] = useState<string>('')

  const [details, setDetails] = useState({
    name: test?.name || '',
    description: test?.description || '',
    instructions: test?.instructions || '',
    durationMinutes: test?.durationMinutes || 60,
    randomizeQuestionOrder: test?.randomizeQuestionOrder || false,
    randomizeOptionOrder: test?.randomizeOptionOrder || false,
    allowCalculator: test?.allowCalculator || false,
    calculatorType: test?.calculatorType || null,
    allowNoteSheet: test?.allowNoteSheet || false,
    noteSheetInstructions: test?.noteSheetInstructions || '',
    autoApproveNoteSheet: (test as any)?.autoApproveNoteSheet ?? true,
    requireOneSitting: (test as any)?.requireOneSitting ?? true,
  })

  const [questions, setQuestions] = useState<QuestionDraft[]>(() => {
    if (test?.questions) {
      return test.questions.map((q) => {
        const { context, prompt, frqParts, contextTables, promptTables } = parsePromptMd(q.promptMd)
        // Map backend types to frontend types
        let type: QuestionType = 'MCQ_SINGLE'
        if (q.type === 'MCQ_SINGLE' || q.type === 'MCQ_MULTI' || q.type === 'LONG_TEXT') {
          type = q.type as QuestionType
          // Check if MCQ_SINGLE with exactly 2 options "True" and "False" -> TRUE_FALSE
          if (q.type === 'MCQ_SINGLE' && q.options.length === 2) {
            const optionLabels = q.options.map(opt => opt.label.trim().toLowerCase())
            if (optionLabels.includes('true') && optionLabels.includes('false')) {
              type = 'TRUE_FALSE'
            }
          }
        } else if (q.type === 'SHORT_TEXT') {
          // Check if it's a text block (0 points) or fill in the blank
          if (Number(q.points) === 0) {
            type = 'TEXT_BLOCK'
          } else {
            type = 'FILL_BLANK'
          }
        }
        
        // For fill-in-the-blank questions, parse blankAnswers and blankPoints from explanation
        let blankAnswers: string[] | undefined = undefined
        let blankPoints: (number | null)[] | undefined = undefined
        if (type === 'FILL_BLANK' && q.explanation) {
          try {
            const parsed = JSON.parse(q.explanation)
            // Check if it's new format with answers and points
            if (parsed && typeof parsed === 'object' && 'answers' in parsed) {
              blankAnswers = parsed.answers || []
              // Convert number[] back to (number | null)[] by mapping to match answers length
              const savedPoints: number[] = parsed.points || []
              const answerCount = (blankAnswers || []).length
              blankPoints = Array(answerCount).fill(null).map((_, i) => savedPoints[i] ?? null)
            } else if (Array.isArray(parsed)) {
              // Old format: just array of answers
              blankAnswers = parsed
              blankPoints = []
            }
          } catch {
            // If not JSON, treat as empty (old format)
            blankAnswers = []
            blankPoints = []
          }
        }
        
        // For fill-in-the-blank questions, normalize blank markers in the prompt
        let normalizedPrompt = prompt
        if (type === 'FILL_BLANK') {
          normalizedPrompt = normalizeBlankMarkers(prompt)
        }
        
        return {
          id: q.id,
          type,
          prompt: normalizedPrompt,
          context,
          explanation: type === 'FILL_BLANK' ? '' : (q.explanation || ''),
          points: Number(q.points),
          options: q.options.map((opt) => ({
            id: opt.id,
            label: opt.label,
            isCorrect: opt.isCorrect,
          })),
          shuffleOptions: q.shuffleOptions,
          frqParts,
          contextTables,
          promptTables,
          blankAnswers,
          blankPoints,
        }
      })
    }
    return []
  })

  const addQuestion = (type: QuestionType) => {
    let baseOptions: OptionDraft[] = []
    let defaultPoints = 1
    
    if (type === 'TRUE_FALSE') {
      // Pre-populate with True and False options
      baseOptions = [
        { id: nanoid(), label: 'True', isCorrect: true },
        { id: nanoid(), label: 'False', isCorrect: false },
      ]
    } else if (type === 'TEXT_BLOCK') {
      // Text blocks are display-only, no options, 0 points
      baseOptions = []
      defaultPoints = 0
    } else if (type === 'LONG_TEXT' || type === 'FILL_BLANK') {
      // These types don't have options
      baseOptions = []
    } else {
      // MCQ types get 4 empty options
      baseOptions = [
        { id: nanoid(), label: '', isCorrect: false },
        { id: nanoid(), label: '', isCorrect: false },
        { id: nanoid(), label: '', isCorrect: false },
        { id: nanoid(), label: '', isCorrect: false },
      ]
    }

    const newQuestion: QuestionDraft = {
      id: nanoid(),
      type,
      prompt: '',
      context: '',
      explanation: '',
      points: defaultPoints,
      options: baseOptions,
      shuffleOptions: type !== 'TRUE_FALSE' && type !== 'TEXT_BLOCK' && type !== 'LONG_TEXT' && type !== 'FILL_BLANK',
      blankAnswers: type === 'FILL_BLANK' ? [] : undefined,
    }

    setQuestions((prev) => [...prev, newQuestion])
  }

  const addRecommendedOptions = (questionId: string) => {
    updateQuestion(questionId, (prev) => {
      if (prev.options.length >= 4) return prev
      const needed = 4 - prev.options.length
      const newOptions = Array.from({ length: needed }, () => ({
        id: nanoid(),
        label: '',
        isCorrect: false,
      }))
      return {
        ...prev,
        options: [...prev.options, ...newOptions],
      }
    })
  }

  const updateQuestion = (id: string, updater: (question: QuestionDraft) => QuestionDraft) => {
    setQuestions((prev) =>
      prev.map((question) => (question.id === id ? updater(question) : question))
    )
  }

  const removeQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((question) => question.id !== id))
  }

  const moveQuestion = (id: string, direction: -1 | 1) => {
    setQuestions((prev) => {
      const index = prev.findIndex((q) => q.id === id)
      if (index === -1) return prev
      const newIndex = index + direction
      if (newIndex < 0 || newIndex >= prev.length) return prev
      const newQuestions = [...prev]
      const [question] = newQuestions.splice(index, 1)
      newQuestions.splice(newIndex, 0, question)
      return newQuestions
    })
  }

  const moveQuestionToPosition = (id: string, targetPosition: number) => {
    // targetPosition is 1-indexed
    if (targetPosition < 1 || targetPosition > questions.length) return
    
    setQuestions((prev) => {
      const currentIndex = prev.findIndex((q) => q.id === id)
      if (currentIndex === -1) return prev
      
      // Convert to 0-indexed
      const targetIndex = targetPosition - 1
      
      // If already at the target position, do nothing
      if (currentIndex === targetIndex) return prev
      
      const newQuestions = [...prev]
      const [question] = newQuestions.splice(currentIndex, 1)
      newQuestions.splice(targetIndex, 0, question)
      return newQuestions
    })
  }


  const handleImportFromDocx = async () => {
    // Create a file input element
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      setImporting(true)
      setImportStartTime(Date.now())
      
      // Estimate time based on file size and AI processing
      // Use tiered estimation for better accuracy with larger files (up to 50MB)
      const fileSizeMB = file.size / (1024 * 1024)
      const baseTime = 60 // Base upload and parsing time
      
      let additionalTime = 0
      if (fileSizeMB < 1) {
        additionalTime = 30 // Small files: ~1.5 min total
      } else if (fileSizeMB < 5) {
        additionalTime = 90 // Medium files (1-5MB): ~2.5 min total
      } else if (fileSizeMB < 20) {
        additionalTime = 180 // Large files (5-20MB): ~4 min total
      } else {
        additionalTime = 300 // Very large files (20-50MB): ~6 min total
      }
      
      const estimatedSeconds = baseTime + additionalTime
      setEstimatedTimeSeconds(estimatedSeconds)
      
      try {
        // Upload file to API
        const formData = new FormData()
        formData.append('file', file)
        
        const response = await fetch('/api/tests/import-docx', {
          method: 'POST',
          body: formData,
        })
        
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to import questions')
        }
        
        const { questions: importedQuestions } = await response.json() as { questions: ImportedQuestion[] }
        
        // Map ImportedQuestion to QuestionDraft
        const mappedQuestions: QuestionDraft[] = importedQuestions.map((iq) => {
          let type: QuestionType
          let options: OptionDraft[]
          let frqParts: FRQPart[] | undefined
          let blankAnswers: string[] | undefined = undefined
          
          if (iq.type === 'true_false') {
            type = 'TRUE_FALSE'
            // True/False questions should have exactly 2 options: True and False
            if (iq.choices.length === 2) {
              options = iq.choices.map((choice) => ({
                id: nanoid(),
                label: choice.text,
                isCorrect: choice.correct,
              }))
            } else {
              // Default True/False options if not provided
              options = [
                { id: nanoid(), label: 'True', isCorrect: iq.choices.find(c => c.text.toLowerCase().includes('true') || c.correct)?.correct ?? true },
                { id: nanoid(), label: 'False', isCorrect: iq.choices.find(c => c.text.toLowerCase().includes('false') || !c.correct)?.correct ?? false },
              ]
            }
          } else if (iq.type === 'fill_blank') {
            type = 'FILL_BLANK'
            options = []
            // Extract blank answers if they exist in the prompt or need to be set
            // The AI should identify blanks, but we'll initialize empty array
            blankAnswers = []
          } else if (iq.type === 'text_block') {
            type = 'TEXT_BLOCK'
            options = []
            // Text blocks are display-only, 0 points
          } else if (iq.type === 'free_response') {
            type = 'LONG_TEXT'
            options = []
            
            // Map FRQ parts if they exist
            if (iq.frqParts && iq.frqParts.length > 0) {
              frqParts = iq.frqParts.map((part) => ({
                id: nanoid(),
                label: part.label,
                prompt: part.prompt,
                points: part.points || 1,
              }))
            }
          } else if (iq.type === 'multiple_choice') {
            type = 'MCQ_SINGLE'
            options = iq.choices.map((choice) => ({
              id: nanoid(),
              label: choice.text,
              isCorrect: choice.correct,
            }))
          } else if (iq.type === 'select_all') {
            type = 'MCQ_MULTI'
            options = iq.choices.map((choice) => ({
              id: nanoid(),
              label: choice.text,
              isCorrect: choice.correct,
            }))
          } else {
            // Default to free response for unknown types
            type = 'LONG_TEXT'
            options = []
          }
          
          return {
            id: nanoid(),
            type,
            prompt: iq.prompt || '',
            context: iq.context || '',
            explanation: '',
            points: iq.type === 'text_block' ? 0 : (iq.points || 1),
            options,
            shuffleOptions: type !== 'TRUE_FALSE' && type !== 'TEXT_BLOCK' && type !== 'LONG_TEXT' && type !== 'FILL_BLANK',
            frqParts,
            blankAnswers,
          }
        })
        
        // Add imported questions to the end of the question list
        setQuestions((prev) => [...prev, ...mappedQuestions])
        
        toast({
          title: 'Questions imported successfully!',
          description: `Imported ${mappedQuestions.length} question${mappedQuestions.length === 1 ? '' : 's'} from ${file.name}. Please review and check for any mistakes or formatting issues before publishing.`,
        })
      } catch (error: any) {
        console.error('Error importing docx:', error)
        toast({
          title: 'Import failed',
          description: error.message || 'Failed to import questions from docx',
          variant: 'destructive',
        })
      } finally {
        setImporting(false)
        setImportStartTime(null)
      }
    }
    
    input.click()
  }

  const handleImageEmbed = (questionId: string, field: 'context' | 'prompt', file: File, cursorPosition: number | null = null) => {
    if (file.size > MAX_IMAGE_SIZE) {
      toast({
        title: 'Image too large',
        description: 'Please choose an image under 2MB.',
        variant: 'destructive',
      })
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      updateQuestion(questionId, (question) => {
        const existing = question[field]
        const imageMarkdown = `![${file.name}](${dataUrl})`
        
        // Get existing images BEFORE we modify anything
        const existingImages = extractImages(existing)
        const textWithoutImages = removeImageMarkdown(existing)
        
        // Always append new images to the bottom of the stack (end of the list)
        const allImages = [...existingImages, { alt: file.name, src: dataUrl }]
        const reconstructed = reconstructMarkdown(textWithoutImages, allImages)
        return {
          ...question,
          [field]: reconstructed,
        }
      })
      toast({
        title: 'Image embedded',
        description: 'The image was added to the bottom of the stack.',
      })
    }
    reader.readAsDataURL(file)
  }

  const toggleTeam = (teamId: string) => {
    setSelectedTeams((prev) =>
      prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId]
    )
  }

  // Fetch events when publish dialog opens
  useEffect(() => {
    if (publishDialogOpen && clubDivision && events.length === 0 && !loadingEvents) {
      setLoadingEvents(true)
      fetch(`/api/events?division=${clubDivision}`)
        .then(res => res.json())
        .then(data => {
          if (data.events) {
            setEvents(data.events)
          }
        })
        .catch(error => {
          console.error('Failed to fetch events:', error)
          toast({
            title: 'Failed to load events',
            description: 'Could not load Science Olympiad events',
            variant: 'destructive',
          })
        })
        .finally(() => setLoadingEvents(false))
    }
  }, [publishDialogOpen, clubDivision, events.length, loadingEvents, toast])

  // Track elapsed time during import
  useEffect(() => {
    if (!importing || !importStartTime) {
      setElapsedSeconds(0)
      return
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - importStartTime) / 1000)
      setElapsedSeconds(elapsed)
    }, 1000)

    return () => clearInterval(interval)
  }, [importing, importStartTime])

  // Draft validation - basic requirements for saving (no assignment validation)
  const draftValidation = useMemo(() => {
    const errors: string[] = []

    if (!details.name.trim()) {
      errors.push('Test name is required.')
    }

    if (!details.durationMinutes || details.durationMinutes < 1 || details.durationMinutes > 720) {
      errors.push('Duration must be between 1 and 720 minutes.')
    }
    
    // Validate fill-in-the-blank questions: sum of blank points shouldn't exceed question points
    questions.forEach((question, index) => {
      if (question.type === 'FILL_BLANK' && question.blankPoints) {
        const specifiedPointsSum = question.blankPoints.reduce((sum: number, p) => {
          if (p !== null && p !== undefined) {
            return sum + Number(p)
          }
          return sum
        }, 0)
        
        if (specifiedPointsSum > question.points) {
          errors.push(`Question ${index + 1}: Sum of blank points (${specifiedPointsSum}) exceeds question points (${question.points}).`)
        }
      }
    })

    if (questions.length === 0) {
      errors.push('Add at least one question before saving.')
    }

    questions.forEach((question, index) => {
      const prompt = question.prompt.trim()
      if (!prompt) {
        errors.push(`Question ${index + 1} needs a prompt.`)
      }

      // TEXT_BLOCK can have 0 points (it's display-only)
      if (question.type !== 'TEXT_BLOCK' && question.points < 0.5) {
        errors.push(`Question ${index + 1} must be worth at least 0.5 points.`)
      }

      // TEXT_BLOCK and LONG_TEXT don't need answer validation (display-only or free response)
      if (question.type !== 'LONG_TEXT' && question.type !== 'FILL_BLANK' && question.type !== 'TEXT_BLOCK') {
        // Filter out empty options for validation
        const filledOptions = question.options.filter((option) => option.label.trim())
        
        if (filledOptions.length < 1) {
          errors.push(`Question ${index + 1} needs at least one filled answer choice.`)
        }

        const correctCount = filledOptions.filter((option) => option.isCorrect).length
        if (correctCount === 0) {
          errors.push(`Question ${index + 1} needs at least one correct answer.`)
        }
        if ((question.type === 'MCQ_SINGLE' || question.type === 'TRUE_FALSE') && correctCount !== 1) {
          errors.push(`Question ${index + 1} must have exactly one correct answer.`)
        }
      }
      
      // TEXT_BLOCK can have 0 points (it's display-only)
      if (question.type === 'TEXT_BLOCK' && question.points < 0) {
        errors.push(`Question ${index + 1} (text block) cannot have negative points.`)
      }
    })

    return {
      errors,
    }
  }, [details, questions])

  // Publish validation - includes assignment requirements
  const publishValidation = useMemo(() => {
    const errors: string[] = [...draftValidation.errors]

    // Skip assignment validation for tournament tests (they're assigned via tournament system)
    if (!tournamentId) {
      if (assignmentMode === 'TEAM' && selectedTeams.length === 0) {
        errors.push('Select at least one team or assign to the entire club.')
      }

      if (assignmentMode === 'EVENT' && !selectedEventId) {
        errors.push('Select an event or choose a different assignment option.')
      }
    }

    return {
      errors,
    }
  }, [draftValidation.errors, assignmentMode, selectedTeams, selectedEventId])

  // Use publish validation for backward compatibility with existing code that references validationSummary
  const validationSummary = publishValidation

  const composePrompt = (question: QuestionDraft) => {
    const context = question.context.trim()
    const prompt = question.prompt.trim()
    
    // Add tables to context and prompt
    const contextWithTables = question.contextTables && question.contextTables.length > 0
      ? `${context}\n\n---TABLES---\n\n${question.contextTables.map(t => t.markdown).join('\n\n')}`
      : context
    
    const promptWithTables = question.promptTables && question.promptTables.length > 0
      ? `${prompt}\n\n---TABLES---\n\n${question.promptTables.map(t => t.markdown).join('\n\n')}`
      : prompt
    
    // Compose main prompt
    let mainPrompt = ''
    if (contextWithTables && promptWithTables) {
      mainPrompt = `${contextWithTables}\n\n---\n\n${promptWithTables}`
    } else if (contextWithTables) {
      mainPrompt = contextWithTables
    } else {
      mainPrompt = promptWithTables
    }
    
    // Add FRQ parts if they exist (using dynamic labels based on index)
    if (question.type === 'LONG_TEXT' && question.frqParts && question.frqParts.length > 0) {
      const partsSection = question.frqParts
        .map((part, index) => {
          const dynamicLabel = String.fromCharCode(97 + index) // a, b, c, d, etc.
          return `[PART:${dynamicLabel}:${part.points}]\n${part.prompt}`
        })
        .join('\n\n')
      mainPrompt = `${mainPrompt}\n\n---FRQ_PARTS---\n\n${partsSection}`
    }
    
    return mainPrompt
  }

  const handleSave = async (andPublish: boolean = false) => {
    // Use draft validation when just saving, publish validation when publishing
    const validation = andPublish ? publishValidation : draftValidation
    
    if (validation.errors.length > 0) {
      toast({
        title: 'Please fix the highlighted issues',
        description: validation.errors.join('\n'),
        variant: 'destructive',
      })
      return
    }

    // For tournament tests, don't create assignments (they're assigned via tournament system)
    const assignments = tournamentId
      ? []
      : assignmentMode === 'CLUB'
        ? [{ assignedScope: 'CLUB' as const }]
        : selectedTeams.map((teamId) => ({
            assignedScope: 'TEAM' as const,
            teamId,
          }))

    const payload = {
      ...(clubId && !tournamentId ? { clubId } : {}),
      name: details.name.trim(),
      description: details.description.trim() || undefined,
      instructions: details.instructions.trim() || undefined,
      durationMinutes: details.durationMinutes,
      randomizeQuestionOrder: details.randomizeQuestionOrder,
      randomizeOptionOrder: details.randomizeOptionOrder,
      allowCalculator: details.allowCalculator,
      calculatorType: details.allowCalculator ? details.calculatorType : null,
      allowNoteSheet: details.allowNoteSheet,
      noteSheetInstructions: details.allowNoteSheet ? details.noteSheetInstructions.trim() || undefined : undefined,
      autoApproveNoteSheet: details.allowNoteSheet ? (details.autoApproveNoteSheet ?? true) : undefined,
      requireOneSitting: details.requireOneSitting ?? true,
      assignments,
      questions: questions.map((question, index) => {
        // Map frontend types to backend types
        let backendType: 'MCQ_SINGLE' | 'MCQ_MULTI' | 'LONG_TEXT' | 'SHORT_TEXT' | 'NUMERIC' = question.type as any
        if (question.type === 'TRUE_FALSE') {
          backendType = 'MCQ_SINGLE'
        } else if (question.type === 'FILL_BLANK' || question.type === 'TEXT_BLOCK') {
          backendType = 'SHORT_TEXT'
        }
        
        // For fill-in-the-blank, store blankAnswers and blankPoints in explanation field as JSON
        let explanationValue: string | undefined = undefined
        if (question.type === 'FILL_BLANK') {
          // Store blankAnswers and blankPoints as JSON object in explanation field
          if (question.blankAnswers && question.blankAnswers.length > 0) {
            const data: { answers: string[], points?: number[] } = {
              answers: question.blankAnswers,
            }
            if (question.blankPoints && question.blankPoints.some(p => p !== null && p !== undefined)) {
              // Filter out null values and convert to number[]
              data.points = question.blankPoints.filter((p): p is number => p !== null && p !== undefined)
            }
            explanationValue = JSON.stringify(data)
          } else {
            explanationValue = undefined
          }
        } else {
          explanationValue = question.explanation.trim() || undefined
        }
        
        return {
          type: backendType,
          promptMd: composePrompt(question),
          explanation: explanationValue,
          points: question.points,
          order: index,
          shuffleOptions: (question.type === 'LONG_TEXT' || question.type === 'FILL_BLANK' || question.type === 'TEXT_BLOCK') ? false : question.shuffleOptions,
          options:
            (question.type === 'LONG_TEXT' || question.type === 'FILL_BLANK' || question.type === 'TEXT_BLOCK')
              ? undefined
              : question.options
                  .filter((option) => option.label.trim()) // Filter out empty options
                  .map((option, optIndex) => ({
                    label: option.label.trim(),
                    isCorrect: option.isCorrect,
                    order: optIndex,
                  })),
        }
      }),
    }

    setSaving(true)
    try {
      if (isEditMode && test) {
        // Update existing test
        // Use ES API if in ES mode, otherwise use regular test API
        let updateUrl: string
        let updateMethod: string
        let updatePayload: any
        
        if (esMode && staffMembershipId) {
          // ES Mode - use ES API with PUT method
          updateUrl = '/api/es/tests'
          updateMethod = 'PUT'
          
          // Get existing question IDs
          const existingQuestionIds = new Set(test.questions.map(q => q.id))
          
          // Build questions array for ES API
          // Include startAt/endAt if they exist in publishFormData (when publishing) or test data (when updating)
          const testWithDates = test as any
          const publishFormDataWithDates = publishFormData as any
          const startAtISO = andPublish && publishFormData.startAt 
            ? new Date(publishFormData.startAt).toISOString() 
            : (testWithDates.startAt ? new Date(testWithDates.startAt).toISOString() : undefined)
          const endAtISO = andPublish && publishFormData.endAt 
            ? new Date(publishFormData.endAt).toISOString() 
            : (testWithDates.endAt ? new Date(testWithDates.endAt).toISOString() : undefined)
          const allowLateUntilISO = andPublish && publishFormDataWithDates.allowLateUntil && publishFormDataWithDates.allowLateUntil.trim()
            ? new Date(publishFormDataWithDates.allowLateUntil).toISOString()
            : (testWithDates.allowLateUntil ? new Date(testWithDates.allowLateUntil).toISOString() : undefined)

          updatePayload = {
            testId: test.id,
            name: payload.name,
            description: payload.description,
            instructions: payload.instructions,
            durationMinutes: payload.durationMinutes,
            status: andPublish ? 'PUBLISHED' : test.status,
            eventId: initialEventId || undefined,
            startAt: startAtISO,
            endAt: endAtISO,
            allowLateUntil: allowLateUntilISO,
            requireFullscreen: publishFormData.requireFullscreen,
            allowCalculator: payload.allowCalculator,
            calculatorType: payload.allowCalculator ? payload.calculatorType : undefined,
            allowNoteSheet: payload.allowNoteSheet,
            noteSheetInstructions: payload.allowNoteSheet ? payload.noteSheetInstructions : undefined,
            autoApproveNoteSheet: payload.allowNoteSheet ? ((payload as any).autoApproveNoteSheet ?? true) : undefined,
            requireOneSitting: (payload as any).requireOneSitting ?? true,
            questions: questions.map((question, index) => {
              // For fill-in-the-blank, store blankAnswers and blankPoints in explanation field as JSON
              let explanationValue: string | undefined = undefined
              if (question.type === 'FILL_BLANK') {
                if (question.blankAnswers && question.blankAnswers.length > 0) {
                  const data: { answers: string[], points?: number[] } = {
                    answers: question.blankAnswers,
                  }
                  if (question.blankPoints && question.blankPoints.some(p => p !== null && p !== undefined)) {
                    data.points = question.blankPoints.filter((p): p is number => p !== null && p !== undefined)
                  }
                  explanationValue = JSON.stringify(data)
                }
              } else {
                explanationValue = question.explanation.trim() || undefined
              }
              
              const questionPayload: any = {
                ...(existingQuestionIds.has(question.id) ? { id: question.id } : {}),
                type: question.type === 'TRUE_FALSE' ? 'MCQ_SINGLE' : 
                      question.type === 'FILL_BLANK' || question.type === 'TEXT_BLOCK' ? 'SHORT_TEXT' : 
                      question.type,
                promptMd: composePrompt(question),
                explanation: explanationValue,
                points: question.points,
                order: index,
                shuffleOptions: question.type === 'LONG_TEXT' ? false : question.shuffleOptions,
              }
              
              // Only include options for MCQ question types
              if ((question.type === 'MCQ_SINGLE' || question.type === 'MCQ_MULTI' || question.type === 'TRUE_FALSE') && question.options && Array.isArray(question.options)) {
                questionPayload.options = question.options
                  .filter((option) => option.label.trim())
                  .map((option, optIndex) => ({
                    ...(option.id ? { id: option.id } : {}),
                    label: option.label.trim(),
                    isCorrect: option.isCorrect,
                    order: optIndex,
                  }))
              }
              return questionPayload
            }),
          }
        } else {
          // Regular club/tournament mode
          updateUrl = `/api/tests/${test.id}`
          updateMethod = 'PATCH'
          updatePayload = {
            name: payload.name,
            description: payload.description,
            instructions: payload.instructions,
            durationMinutes: payload.durationMinutes,
            randomizeQuestionOrder: payload.randomizeQuestionOrder,
            randomizeOptionOrder: payload.randomizeOptionOrder,
            allowCalculator: payload.allowCalculator,
            calculatorType: payload.calculatorType,
            allowNoteSheet: payload.allowNoteSheet,
            noteSheetInstructions: payload.noteSheetInstructions,
          }
        }

        const response = await fetch(updateUrl, {
          method: updateMethod,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to update test')
        }
        
        // For ES mode, questions are updated in the PUT request above, so skip the individual question updates
        if (esMode) {
          if (andPublish && test.status === 'DRAFT') {
            // Open the publish dialog
            setPublishDialogOpen(true)
          } else {
            toast({
              title: 'Test Updated',
              description: 'Your changes have been saved',
            })
            if (isInTDPortal && tournamentId) {
              // Set events tab in localStorage and redirect to TD tournament manage page
              const storageKey = `td-tournament-tab-${tournamentId}`
              localStorage.setItem(storageKey, 'events')
              router.push(`/td/tournament/${tournamentId}`)
            } else if (tournamentId) {
              router.push(`/es?tournament=${tournamentId}`)
            } else {
              router.push('/es')
            }
            router.refresh()
          }
          return
        }

        // Update assignments
        await fetch(`/api/tests/${test.id}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignments }),
        })

        // Get existing question IDs
        const existingQuestionIds = new Set(test.questions.map(q => q.id))
        const currentQuestionIds = new Set(questions.map(q => q.id))
        
        // Delete questions that were removed
        const questionsToDelete = test.questions.filter(q => !currentQuestionIds.has(q.id))
        for (const q of questionsToDelete) {
          await fetch(`/api/tests/${test.id}/questions/${q.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Update or create questions
        for (let i = 0; i < questions.length; i++) {
          const question = questions[i]
          
          // For fill-in-the-blank, store blankAnswers and blankPoints in explanation field as JSON
          let explanationValue: string | undefined = undefined
          if (question.type === 'FILL_BLANK') {
            if (question.blankAnswers && question.blankAnswers.length > 0) {
              const data: { answers: string[], points?: number[] } = {
                answers: question.blankAnswers,
              }
              if (question.blankPoints && question.blankPoints.some(p => p !== null && p !== undefined)) {
                // Filter out null values and convert to number[]
                data.points = question.blankPoints.filter((p): p is number => p !== null && p !== undefined)
              }
              explanationValue = JSON.stringify(data)
            } else {
              explanationValue = undefined
            }
          } else {
            explanationValue = question.explanation.trim() || undefined
          }
          
          const questionPayload = {
            type: question.type,
            promptMd: composePrompt(question),
            explanation: explanationValue,
            points: question.points,
            order: i,
            shuffleOptions: question.type === 'LONG_TEXT' ? false : question.shuffleOptions,
            options:
              question.type === 'LONG_TEXT'
                ? undefined
                : question.options
                    .filter((option) => option.label.trim())
                    .map((option, optIndex) => ({
                      label: option.label.trim(),
                      isCorrect: option.isCorrect,
                      order: optIndex,
                    })),
          }

          // Check if this question existed in the original test
          const questionExistedBefore = existingQuestionIds.has(question.id)
          
          if (!questionExistedBefore) {
            // Create new question
            await fetch(`/api/tests/${test.id}/questions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(questionPayload),
            })
          } else {
            // Update existing question
            await fetch(`/api/tests/${test.id}/questions/${question.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(questionPayload),
            })
          }
        }

        if (andPublish && test.status === 'DRAFT') {
          // Open the publish dialog
          setPublishDialogOpen(true)
        } else {
          toast({
            title: 'Test Updated',
            description: 'Your changes have been saved',
          })
          if (isInTDPortal && tournamentId) {
            // Set events tab in localStorage and redirect to TD tournament manage page
            const storageKey = `td-tournament-tab-${tournamentId}`
            localStorage.setItem(storageKey, 'events')
            router.push(`/td/tournament/${tournamentId}`)
          } else if (esMode && tournamentId) {
            router.push(`/es?tournament=${tournamentId}`)
          } else if (esMode) {
            router.push('/es')
          } else {
            const savedTournamentId = sessionStorage.getItem('tournamentId')
            if (savedTournamentId) {
              router.push(`/tournaments/${savedTournamentId}/tests`)
              sessionStorage.removeItem('tournamentId')
            } else if (clubId) {
              router.push(`/club/${clubId}?tab=tests`)
            }
          }
          router.refresh()
        }
      } else {
        // Create new test - use appropriate API based on mode
        let apiUrl: string
        let createPayload: any

        if (esMode && staffMembershipId && tournamentId) {
          // ES Mode - use ES API
          apiUrl = '/api/es/tests'
          createPayload = {
            staffId: staffMembershipId,
            tournamentId,
            eventId: initialEventId || undefined,
            eventName: !initialEventId && eventName ? eventName : undefined, // Include eventName for trial events
            name: payload.name,
            description: payload.description,
            instructions: payload.instructions,
            durationMinutes: payload.durationMinutes,
            requireFullscreen: publishFormData.requireFullscreen,
            allowCalculator: payload.allowCalculator,
            calculatorType: payload.allowCalculator ? payload.calculatorType : undefined,
            allowNoteSheet: payload.allowNoteSheet,
            noteSheetInstructions: payload.allowNoteSheet ? payload.noteSheetInstructions : undefined,
            autoApproveNoteSheet: payload.allowNoteSheet ? ((payload as any).autoApproveNoteSheet ?? true) : undefined,
            requireOneSitting: (payload as any).requireOneSitting ?? true,
            questions: payload.questions.map((q: any) => {
              const questionPayload: any = {
                type: q.type,
                promptMd: q.promptMd,
                explanation: q.explanation,
                points: q.points,
                order: q.order,
                shuffleOptions: q.shuffleOptions || false,
              }
              // Only include options for MCQ question types
              if ((q.type === 'MCQ_SINGLE' || q.type === 'MCQ_MULTI') && q.options && Array.isArray(q.options)) {
                questionPayload.options = q.options
              }
              return questionPayload
            }),
          }
        } else if (tournamentId) {
          // Tournament mode
          apiUrl = `/api/tournaments/${tournamentId}/tests/create`
          createPayload = { ...payload, clubId: undefined }
        } else {
          // Club mode
          apiUrl = '/api/tests'
          createPayload = payload
        }

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createPayload),
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to create test')
        }

        const data = await response.json()
        const testId = data.test?.id

        if (!testId) {
          throw new Error('Test ID not found in response')
        }

        if (andPublish) {
          // Open the publish dialog
          setPublishDialogOpen(true)
          // Store the testId for publishing
          sessionStorage.setItem('newTestId', testId)
          if (tournamentId) {
            sessionStorage.setItem('tournamentId', tournamentId)
          }
          if (esMode) {
            sessionStorage.setItem('esMode', 'true')
          }
        } else {
          toast({
            title: 'Test saved',
            description: esMode 
              ? 'Your test draft has been created.'
              : tournamentId 
                ? 'Your test draft has been created and added to the tournament.'
                : 'Your test draft has been created successfully.',
          })
          if (isInTDPortal && tournamentId) {
            // Set events tab in localStorage and redirect to TD tournament manage page
            const storageKey = `td-tournament-tab-${tournamentId}`
            localStorage.setItem(storageKey, 'events')
            router.push(`/td/tournament/${tournamentId}`)
          } else if (esMode && tournamentId) {
            router.push(`/es?tournament=${tournamentId}`)
          } else if (esMode) {
            router.push('/es')
          } else if (tournamentId) {
            router.push(`/tournaments/${tournamentId}/tests`)
          } else {
            router.push(`/club/${clubId}?tab=tests`)
          }
          router.refresh()
        }
      }
    } catch (error: any) {
      toast({
        title: isEditMode ? 'Failed to update test' : 'Failed to save test',
        description: error.message || 'Something went wrong while saving the test.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handlePublishTest = async () => {
    const testId = isEditMode && test ? test.id : sessionStorage.getItem('newTestId')
    
    if (!testId) {
      toast({
        title: 'Error',
        description: 'Test ID not found. Please save the test first.',
        variant: 'destructive',
      })
      return
    }

    // Validate start/end times if fixed window is enabled
    if (hasFixedWindow) {
      if (!publishFormData.startAt || !publishFormData.endAt) {
        toast({
          title: 'Error',
          description: 'Start and end times are required when test has a fixed window',
          variant: 'destructive',
        })
        return
      }
      const start = new Date(publishFormData.startAt)
      const end = new Date(publishFormData.endAt)
      if (end <= start) {
        toast({
          title: 'Error',
          description: 'End date/time must be after start date/time',
          variant: 'destructive',
        })
        setDateTimeErrors({ endAt: 'End date/time must be after start date/time' })
        return
      }
    }

    // Skip password validation for ES tests (ESTest doesn't support passwords)
    if (!esMode && publishFormData.testPassword) {
      if (publishFormData.testPassword.length < 6) {
        toast({
          title: 'Error',
          description: 'Test password must be at least 6 characters',
          variant: 'destructive',
        })
        return
      }

      if (!publishFormData.testPasswordConfirm) {
        toast({
          title: 'Error',
          description: 'Please confirm the password',
          variant: 'destructive',
        })
        return
      }

      if (publishFormData.testPassword !== publishFormData.testPasswordConfirm) {
        toast({
          title: 'Error',
          description: 'Passwords do not match',
          variant: 'destructive',
        })
        return 
      }
    }

    setPublishing(true)
    try {
      // For ES mode (ESTest), use the PUT endpoint to update status to PUBLISHED
      if (esMode) {
        const publishFormDataWithDates = publishFormData as any
        const startAtISO = publishFormData.startAt ? new Date(publishFormData.startAt).toISOString() : undefined
        const endAtISO = publishFormData.endAt ? new Date(publishFormData.endAt).toISOString() : undefined
        const allowLateUntilISO = publishFormDataWithDates.allowLateUntil && publishFormDataWithDates.allowLateUntil.trim()
          ? new Date(publishFormDataWithDates.allowLateUntil).toISOString()
          : undefined

        const response = await fetch('/api/es/tests', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            testId,
            status: 'PUBLISHED',
            durationMinutes: details.durationMinutes,
            startAt: startAtISO,
            endAt: endAtISO,
            allowLateUntil: allowLateUntilISO,
            requireFullscreen: publishFormData.requireFullscreen,
            allowCalculator: details.allowCalculator,
            calculatorType: details.allowCalculator ? details.calculatorType : undefined,
            allowNoteSheet: details.allowNoteSheet,
            noteSheetInstructions: details.allowNoteSheet ? details.noteSheetInstructions : undefined,
            autoApproveNoteSheet: details.allowNoteSheet ? (details.autoApproveNoteSheet ?? true) : undefined,
            requireOneSitting: details.requireOneSitting ?? true,
          }),
        })

        let data: any = null
        try {
          const text = await response.text()
          data = text ? JSON.parse(text) : {}
        } catch (parseError) {
          console.error('Failed to parse response:', parseError)
          throw new Error(`Server error (${response.status}): Unable to parse response. Please check server logs.`)
        }

        if (!response.ok) {
          const errorMsg = data.error || data.details || 'Failed to publish test'
          throw new Error(errorMsg)
        }

        const savedTournamentId = sessionStorage.getItem('tournamentId') || tournamentId

        toast({
          title: 'Test Published',
          description: 'The test is now published.',
        })

        if (!isEditMode) {
          sessionStorage.removeItem('newTestId')
        }
        setPublishDialogOpen(false)
        setAddToCalendar(false)
        if (isInTDPortal && tournamentId) {
          // Set events tab in localStorage and redirect to TD tournament manage page
          const storageKey = `td-tournament-tab-${tournamentId}`
          localStorage.setItem(storageKey, 'events')
          router.push(`/td/tournament/${tournamentId}`)
        } else if (esMode && tournamentId) {
          router.push(`/es?tournament=${tournamentId}`)
        } else if (esMode) {
          router.push('/es')
        }
        router.refresh()
        return
      }

      // Regular test publish flow
      const startAtISO = hasFixedWindow && publishFormData.startAt ? new Date(publishFormData.startAt).toISOString() : null
      const endAtISO = hasFixedWindow && publishFormData.endAt ? new Date(publishFormData.endAt).toISOString() : null
      const releaseScoresAtISO = publishFormData.releaseScoresAt && publishFormData.releaseScoresAt.trim() 
        ? new Date(publishFormData.releaseScoresAt).toISOString() 
        : undefined

      const response = await fetch(`/api/tests/${testId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startAt: startAtISO,
          endAt: endAtISO,
          testPassword: publishFormData.testPassword || undefined,
          releaseScoresAt: releaseScoresAtISO,
          durationMinutes: details.durationMinutes,
          maxAttempts: publishFormData.maxAttempts ? parseInt(publishFormData.maxAttempts, 10) : null,
          scoreReleaseMode: publishFormData.scoreReleaseMode,
          requireFullscreen: publishFormData.requireFullscreen,
          ...(!tournamentId && {
            assignmentMode,
            selectedTeams: assignmentMode === 'TEAM' ? selectedTeams : undefined,
            selectedEventId: assignmentMode === 'EVENT' ? selectedEventId : undefined,
          }),
          addToCalendar: addToCalendar,
        }),
      })

      let data: any = null
      try {
        const text = await response.text()
        data = text ? JSON.parse(text) : {}
      } catch (parseError) {
        console.error('Failed to parse response:', parseError)
        throw new Error(`Server error (${response.status}): Unable to parse response. Please check server logs.`)
      }

      if (!response.ok) {
        const errorMsg = data.message 
          ? `${data.error}: ${data.message}` 
          : data.error || data.details || 'Failed to publish test'
        throw new Error(errorMsg)
      }

      const savedTournamentId = sessionStorage.getItem('tournamentId') || tournamentId

      toast({
        title: 'Test Published',
        description: addToCalendar 
          ? 'The test is now visible to assigned members and has been added to the calendar'
          : 'The test is now visible to assigned members',
      })

      if (!isEditMode) {
        sessionStorage.removeItem('newTestId')
      }
      setPublishDialogOpen(false)
      setAddToCalendar(false)
      if (isInTDPortal && tournamentId) {
        // Set events tab in localStorage and redirect to TD tournament manage page
        const storageKey = `td-tournament-tab-${tournamentId}`
        localStorage.setItem(storageKey, 'events')
        router.push(`/td/tournament/${tournamentId}`)
      } else if (esMode && tournamentId) {
        router.push(`/es?tournament=${tournamentId}`)
      } else if (esMode) {
        router.push('/es')
      } else if (savedTournamentId) {
        if (!isEditMode) {
          sessionStorage.removeItem('tournamentId')
        }
        router.push(`/tournaments/${savedTournamentId}/tests`)
      } else if (clubId) {
        router.push(`/club/${clubId}?tab=tests`)
      }
      router.refresh()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to publish test',
        variant: 'destructive',
      })
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {tournamentId ? `Tournament • ${tournamentName || 'Tournament'}` : `Team • ${clubName || 'Team'}`}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {isEditMode ? 'Edit Test' : 'Create a Test'}
          </h1>
          <p className="text-muted-foreground">
            Build your assessment just like a Google Form. Configure timing, assignments, and
            lockdown before sharing with students.
          </p>
        </div>
        <TooltipProvider delayDuration={200}>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (isInTDPortal && tournamentId) {
                  router.push(`/td/tournament/${tournamentId}`)
                } else if (esMode && tournamentId) {
                  router.push(`/es?tournament=${tournamentId}`)
                } else if (esMode) {
                  router.push('/es')
                } else if (clubId) {
                  router.push(`/club/${clubId}?tab=tests`)
                } else {
                  router.back()
                }
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            {isEditMode && test && clubId && (
              <DuplicateTestButton
                testId={test.id}
                testName={test.name}
                clubId={clubId}
              />
            )}
            {!saving && draftValidation.errors.length > 0 ? (
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <div className="inline-block cursor-not-allowed">
                    <Button onClick={() => handleSave(false)} disabled={true} variant="outline">
                      {isEditMode ? 'Save Changes' : 'Save as Draft'}
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm">
                  <div className="space-y-1">
                    <p className="font-semibold">Requirements to save:</p>
                    <ul className="list-disc list-inside text-xs space-y-0.5">
                      {draftValidation.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button onClick={() => handleSave(false)} disabled={saving} variant="outline">
                {saving ? 'Saving…' : isEditMode ? 'Save Changes' : 'Save as Draft'}
              </Button>
            )}
            {!saving && publishValidation.errors.length > 0 ? (
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <div className="inline-block cursor-not-allowed">
                    <Button 
                      onClick={() => handleSave(true)} 
                      disabled={true}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Save & Publish
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm">
                  <div className="space-y-1">
                    <p className="font-semibold">Requirements to publish:</p>
                    <ul className="list-disc list-inside text-xs space-y-0.5">
                      {publishValidation.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button 
                onClick={() => handleSave(true)} 
                disabled={saving}
              >
                <Send className="h-4 w-4 mr-2" />
                {saving ? 'Saving…' : 'Save & Publish'}
              </Button>
            )}
          </div>
        </TooltipProvider>
      </div>

      <div className="space-y-6">
        <Card className="border-primary/10">
            <CardHeader>
              <CardTitle>Test Overview</CardTitle>
              <CardDescription>
                Add the essential information your students will see before they begin.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="test-name">Test title *</Label>
                <Input
                  id="test-name"
                  value={details.name}
                  onChange={(event) =>
                    setDetails((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Forensic Science Practice Test"
                  required
                />
              </div>
              <div>
                <Label htmlFor="test-description">Short description</Label>
                <Input
                  id="test-description"
                  value={details.description}
                  onChange={(event) =>
                    setDetails((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="Share a one-line summary for admins and competitors."
                />
              </div>
              <div>
                <Label htmlFor="test-instructions">Instructions (Markdown supported)</Label>
                <textarea
                  id="test-instructions"
                  className="w-full min-h-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={details.instructions}
                  onChange={(event) =>
                    setDetails((prev) => ({ ...prev, instructions: event.target.value }))
                  }
                  placeholder="Let students know what resources are allowed, how to submit work, and any other expectations."
                />
              </div>
              <div>
                <Label htmlFor="test-duration">Duration (minutes) *</Label>
                <Input
                  id="test-duration"
                  type="number"
                  min="1"
                  max="720"
                  value={details.durationMinutes}
                  onChange={(event) =>
                    setDetails((prev) => ({
                      ...prev,
                      durationMinutes: parseInt(event.target.value, 10) || 60,
                    }))
                  }
                  placeholder="60"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Time allowed to complete the test (1-720 minutes)
                </p>
                {/* Require One Sitting - For both club tests and ES tests (tournament tests) */}
                {(clubId || esMode || tournamentId) && (
                  <>
                    <div className="flex items-center gap-2 mt-4">
                      <Checkbox
                        id="require-one-sitting"
                        checked={details.requireOneSitting}
                        onCheckedChange={(checked) =>
                          setDetails((prev) => ({
                            ...prev,
                            requireOneSitting: checked as boolean,
                          }))
                        }
                      />
                      <Label htmlFor="require-one-sitting" className="cursor-pointer font-normal">
                        Require test to be completed in one sitting
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-6">
                      {details.requireOneSitting
                        ? 'Students must complete the test in one session. The "Save & Exit" button will be hidden.'
                        : 'Students can save their progress and return to complete the test later.'}
                    </p>
                  </>
                )}
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div>
                  <Label className="text-base font-semibold">Calculator</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Allow students to use a calculator during the test
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="allow-calculator"
                    checked={details.allowCalculator}
                    onCheckedChange={(checked) =>
                      setDetails((prev) => ({
                        ...prev,
                        allowCalculator: checked as boolean,
                        calculatorType: checked ? 'FOUR_FUNCTION' : null,
                      }))
                    }
                  />
                  <Label htmlFor="allow-calculator" className="cursor-pointer font-normal">
                    Allow calculator
                  </Label>
                </div>

                {details.allowCalculator && (
                  <div>
                    <Label htmlFor="calculator-type">Calculator Type</Label>
                    <select
                      id="calculator-type"
                      value={details.calculatorType || 'FOUR_FUNCTION'}
                      onChange={(e) =>
                        setDetails((prev) => ({
                          ...prev,
                          calculatorType: e.target.value as 'FOUR_FUNCTION' | 'SCIENTIFIC' | 'GRAPHING',
                        }))
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
                    >
                      <option value="FOUR_FUNCTION">Four Function (Basic)</option>
                      <option value="SCIENTIFIC">Scientific Calculator</option>
                      <option value="GRAPHING">Graphing Calculator</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Students will have access to this calculator during the test
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div>
                  <Label className="text-base font-semibold">Note Sheets</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Allow students to create or upload note sheets for this test
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="allow-note-sheet"
                    checked={details.allowNoteSheet}
                    onCheckedChange={(checked) =>
                      setDetails((prev) => ({
                        ...prev,
                        allowNoteSheet: checked as boolean,
                        noteSheetInstructions: checked ? prev.noteSheetInstructions : '',
                      }))
                    }
                  />
                  <Label htmlFor="allow-note-sheet" className="cursor-pointer font-normal">
                    Allow note sheets
                  </Label>
                </div>

                {details.allowNoteSheet && (
                  <>
                    <div>
                      <Label htmlFor="note-sheet-instructions">Note Sheet Instructions</Label>
                      <textarea
                        id="note-sheet-instructions"
                        className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
                        value={details.noteSheetInstructions}
                        onChange={(e) =>
                          setDetails((prev) => ({
                            ...prev,
                            noteSheetInstructions: e.target.value,
                          }))
                        }
                        placeholder="Provide instructions for students about note sheet requirements, size limits, content guidelines, etc."
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        These instructions will be shown to students when they create or upload their note sheet
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Checkbox
                        id="auto-approve-note-sheet"
                        checked={details.autoApproveNoteSheet}
                        onCheckedChange={(checked) =>
                          setDetails((prev) => ({
                            ...prev,
                            autoApproveNoteSheet: checked as boolean,
                          }))
                        }
                      />
                      <Label htmlFor="auto-approve-note-sheet" className="cursor-pointer font-normal">
                        Automatically approve note sheets
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-6">
                      {details.autoApproveNoteSheet 
                        ? 'Note sheets will be automatically accepted. Tournament admins can still review and reject them if needed.'
                        : 'All note sheets must be approved by tournament admins before students can take the test.'}
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/10">
            <CardHeader className="sticky top-0 z-10 bg-gradient-card-light/95 dark:bg-gradient-card-dark/95 backdrop-blur-sm supports-[backdrop-filter]:bg-gradient-card-light/80 dark:supports-[backdrop-filter]:bg-gradient-card-dark/80 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b">
              <div>
                <CardTitle>Questions</CardTitle>
                <CardDescription>
                  Add prompts, images, and answer options.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addQuestion('LONG_TEXT')}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Free Response
                </Button>
                <Button size="sm" variant="outline" onClick={() => addQuestion('MCQ_SINGLE')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Multiple Choice
                </Button>
                <Button size="sm" variant="outline" onClick={() => addQuestion('MCQ_MULTI')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Select All That Apply
                </Button>
                <Button size="sm" variant="outline" onClick={() => addQuestion('TRUE_FALSE')}>
                  <Plus className="mr-2 h-4 w-4" />
                  True or False
                </Button>
                <Button size="sm" variant="outline" onClick={() => addQuestion('FILL_BLANK')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Fill in the Blank
                </Button>
                <Button size="sm" variant="outline" onClick={() => addQuestion('TEXT_BLOCK')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Text Block
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleImportFromDocx}
                  disabled={importing}
                  className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 border-purple-500/30 hover:border-purple-500/50 transition-all duration-200"
                >
                  <Sparkles className="mr-2 h-4 w-4 text-purple-500" />
                  {importing 
                    ? `Importing with AI... ${elapsedSeconds}s / ~${estimatedTimeSeconds}s` 
                    : 'Automatically Import Test from .docx with AI'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6 pb-6">
              {questions.length === 0 && (
                <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/10 p-8 text-center text-sm text-muted-foreground">
                  Start by adding a question type. You can include context blocks, embed images, and
                  mark correct answers for automatic grading.
                </div>
              )}
          {questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              index={index}
              total={questions.length}
              question={question}
              onChange={(updater) => updateQuestion(question.id, updater)}
              onRemove={() => removeQuestion(question.id)}
              onMoveUp={() => moveQuestion(question.id, -1)}
              onMoveDown={() => moveQuestion(question.id, 1)}
              onMoveToPosition={(position) => moveQuestionToPosition(question.id, position)}
              onImageUpload={(field, file, cursorPosition) => handleImageEmbed(question.id, field, file, cursorPosition)}
              onAddRecommendedOptions={() => addRecommendedOptions(question.id)}
            />
          ))}
            </CardContent>
          </Card>
        </div>

      {/* Publish Dialog */}
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Publish Test</DialogTitle>
            <DialogDescription>
              Configure test schedule, security settings, and password. Students will need the password to take the test.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 pb-4">
            {!tournamentId && (
              <div className="space-y-3">
                <div>
                  <Label className="text-base font-semibold">Assignments</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Choose who should receive the test. Admins can always preview drafts.
                  </p>
                </div>

                <RadioGroup value={assignmentMode} onValueChange={(value) => setAssignmentMode(value as 'CLUB' | 'TEAM' | 'EVENT')}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="CLUB" id="assign-club" />
                  <Label htmlFor="assign-club" className="cursor-pointer font-normal">
                    Entire club
                  </Label>
                </div>

                <div className="flex items-start gap-2">
                  <RadioGroupItem value="TEAM" id="assign-teams" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="assign-teams" className="cursor-pointer font-normal">
                      Specific teams
                    </Label>
                  {assignmentMode === 'TEAM' && (
                    <div className="mt-2 space-y-2 rounded-md border border-input bg-muted/30 p-3 max-h-32 overflow-y-auto">
                      {(!teams || teams.length === 0) && (
                        <p className="text-sm text-muted-foreground">
                          No teams yet—everyone will receive this test.
                        </p>
                      )}
                      {teams?.map((team) => (
                        <div
                          key={team.id}
                          className={cn(
                            'flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1 text-sm transition',
                            selectedTeams.includes(team.id)
                              ? 'bg-primary/10 border-primary/40'
                              : 'hover:bg-muted'
                          )}
                        >
                          <Checkbox
                            id={`team-${team.id}`}
                            checked={selectedTeams.includes(team.id)}
                            onCheckedChange={() => toggleTeam(team.id)}
                          />
                          <Label htmlFor={`team-${team.id}`} className="cursor-pointer font-normal flex-1">
                            {team.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </div>

                <div className="flex items-start gap-2">
                  <RadioGroupItem value="EVENT" id="assign-event" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="assign-event" className="cursor-pointer font-normal">
                      Users assigned to a specific event
                    </Label>
                  {assignmentMode === 'EVENT' && (
                    <div className="mt-2">
                      <select
                        value={selectedEventId}
                        onChange={(e) => setSelectedEventId(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        disabled={loadingEvents}
                      >
                        <option value="">
                          {loadingEvents ? 'Loading events...' : 'Select an event'}
                        </option>
                        {events.map((event) => (
                          <option key={event.id} value={event.id}>
                            {event.name}
                          </option>
                        ))}
                      </select>
                      {!loadingEvents && events.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          No events found for your division.
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Test will be assigned to all members with a roster assignment for this event.
                      </p>
                    </div>
                  )}
                </div>
                </div>
              </RadioGroup>
            </div>
            )}

            <div>
              <Label htmlFor="testPassword">Test Password (optional)</Label>
              <Input
                id="testPassword"
                type="password"
                value={publishFormData.testPassword}
                onChange={(e) => setPublishFormData((prev) => ({ ...prev, testPassword: e.target.value }))}
                placeholder="Students need this to take the test"
              />
              <p className="text-xs text-muted-foreground mt-1">
                If set, students will need to enter this password to start the test.
              </p>
            </div>

            {publishFormData.testPassword && (
              <div>
                <Label htmlFor="testPasswordConfirm">Confirm Password</Label>
                <Input
                  id="testPasswordConfirm"
                  type="password"
                  value={publishFormData.testPasswordConfirm}
                  onChange={(e) => setPublishFormData((prev) => ({ ...prev, testPasswordConfirm: e.target.value }))}
                  placeholder="Confirm password"
                />
              </div>
            )}

            <div>
              <Label htmlFor="maxAttempts">Max attempts per user (optional)</Label>
              <Input
                id="maxAttempts"
                type="number"
                min="1"
                value={publishFormData.maxAttempts}
                onChange={(e) => setPublishFormData((prev) => ({ ...prev, maxAttempts: e.target.value }))}
                placeholder="Unlimited if not set"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave blank for unlimited attempts
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="hasFixedWindow"
                  checked={hasFixedWindow}
                  onCheckedChange={(checked) => {
                    const isChecked = checked === true
                    setHasFixedWindow(isChecked)
                    if (!isChecked) {
                      // Clear date fields when unchecking
                      setPublishFormData((prev) => ({ ...prev, startAt: '', endAt: '' }))
                      setDateTimeErrors({})
                    }
                  }}
                />
                <Label htmlFor="hasFixedWindow" className="cursor-pointer text-sm font-medium">
                  Fixed Test Taking Window
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                If unchecked, the test will be available as long as attempts remain
              </p>
            </div>

            {hasFixedWindow && (
              <>
                <div>
                  <Label htmlFor="startAt">Start Date/Time *</Label>
                  <Input
                    id="startAt"
                    type="datetime-local"
                    value={publishFormData.startAt}
                    onChange={(e) => {
                      const newStartAt = e.target.value
                      setPublishFormData((prev) => ({ ...prev, startAt: newStartAt }))
                      // Validate immediately
                      if (newStartAt && publishFormData.endAt) {
                        const start = new Date(newStartAt)
                        const end = new Date(publishFormData.endAt)
                        if (end <= start) {
                          setDateTimeErrors((prev) => ({ ...prev, endAt: 'End date/time must be after start date/time' }))
                        } else {
                          setDateTimeErrors((prev) => ({ ...prev, endAt: undefined }))
                        }
                      } else {
                        setDateTimeErrors((prev) => ({ ...prev, endAt: undefined }))
                      }
                    }}
                    required
                  />
                  {dateTimeErrors.startAt && (
                    <p className="text-sm text-destructive mt-1">{dateTimeErrors.startAt}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="endAt">End Date/Time *</Label>
                  <Input
                    id="endAt"
                    type="datetime-local"
                    value={publishFormData.endAt}
                    onChange={(e) => {
                      const newEndAt = e.target.value
                      setPublishFormData((prev) => ({ ...prev, endAt: newEndAt }))
                      // Validate immediately
                      if (publishFormData.startAt && newEndAt) {
                        const start = new Date(publishFormData.startAt)
                        const end = new Date(newEndAt)
                        if (end <= start) {
                          setDateTimeErrors((prev) => ({ ...prev, endAt: 'End date/time must be after start date/time' }))
                        } else {
                          setDateTimeErrors((prev) => ({ ...prev, endAt: undefined }))
                        }
                      } else {
                        setDateTimeErrors((prev) => ({ ...prev, endAt: undefined }))
                      }
                    }}
                    required
                    min={publishFormData.startAt || undefined}
                  />
                  {dateTimeErrors.endAt && (
                    <p className="text-sm text-destructive mt-1">{dateTimeErrors.endAt}</p>
                  )}
                </div>
              </>
            )}

            <div>
              <Label htmlFor="scoreReleaseMode">Score release mode</Label>
              <Select
                value={publishFormData.scoreReleaseMode}
                onValueChange={(value) => setPublishFormData((prev) => ({ ...prev, scoreReleaseMode: value as 'NONE' | 'SCORE_ONLY' | 'SCORE_WITH_WRONG' | 'FULL_TEST' }))}
              >
                <SelectTrigger id="scoreReleaseMode">
                  <SelectValue placeholder="Select release mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL_TEST">Full test (answers, correctness, feedback)</SelectItem>
                  <SelectItem value="SCORE_WITH_WRONG">Score + wrong questions</SelectItem>
                  <SelectItem value="SCORE_ONLY">Score only</SelectItem>
                  <SelectItem value="NONE">No scores released</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Controls what students see after submission
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="require-fullscreen"
                  checked={publishFormData.requireFullscreen}
                  onCheckedChange={(checked) => {
                    const value = checked === true
                    setPublishFormData((prev) => ({ ...prev, requireFullscreen: value }))
                  }}
                />
                <Label htmlFor="require-fullscreen" className="cursor-pointer text-sm font-medium">
                  Require fullscreen lockdown
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                Lockdown is best-effort. Students will be prompted to stay in fullscreen mode.
              </p>
            </div>

            <div>
              <Label htmlFor="releaseScoresAt">Release Scores (optional)</Label>
              <Input
                id="releaseScoresAt"
                type="datetime-local"
                value={publishFormData.releaseScoresAt}
                onChange={(e) => setPublishFormData((prev) => ({ ...prev, releaseScoresAt: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                When to automatically release scores to students. Leave empty for manual release.
              </p>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishDialogOpen(false)} disabled={publishing}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setPublishDialogOpen(false)
                if (tournamentId) {
                  // Skip calendar modal for tournament tests
                  setAddToCalendar(false)
                  setConfirmPublishOpen(true)
                } else {
                  setCalendarModalOpen(true)
                }
              }}
              disabled={publishing || (hasFixedWindow && (!!dateTimeErrors.startAt || !!dateTimeErrors.endAt))}
            >
              {publishing ? 'Publishing...' : 'Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Calendar Modal */}
      <Dialog open={calendarModalOpen} onOpenChange={setCalendarModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Test to Calendar?</DialogTitle>
            <DialogDescription>
              Would you like to add this test to the calendar for the people assigned to it?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              If you choose Yes, a calendar event will be created and shown to:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground mb-4">
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>All club members (if assigned to entire club)</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>Members of specific teams (if assigned to teams)</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>Users assigned to specific events (if assigned to events)</span>
              </li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddToCalendar(false)
              setCalendarModalOpen(false)
              setConfirmPublishOpen(true)
            }} disabled={publishing}>
              No
            </Button>
            <Button
              onClick={() => {
                setAddToCalendar(true)
                setCalendarModalOpen(false)
                setConfirmPublishOpen(true)
              }}
              disabled={publishing}
            >
              Yes, Add to Calendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmPublishOpen} onOpenChange={setConfirmPublishOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Publication</DialogTitle>
            <DialogDescription>
              Tests cannot be edited after they are published. You will only be able to update the test schedule and password.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to publish this test? Once published:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-destructive">•</span>
                <span>Questions and answers cannot be modified</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive">•</span>
                <span>Test settings (duration, attempts, lockdown) cannot be changed</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive">•</span>
                <span>Assignments cannot be modified</span>
              </li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setConfirmPublishOpen(false)
              setAddToCalendar(false)
            }} disabled={publishing}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmPublishOpen(false)
                handlePublishTest()
              }}
              disabled={publishing}
              className="bg-primary"
            >
              {publishing ? 'Publishing...' : 'Yes, Publish Test'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface QuestionCardProps {
  question: QuestionDraft
  index: number
  total: number
  onChange: (updater: (question: QuestionDraft) => QuestionDraft) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onMoveToPosition: (position: number) => void
  onImageUpload: (field: 'context' | 'prompt', file: File, cursorPosition?: number | null) => void
  onAddRecommendedOptions: () => void
}

function QuestionCard({
  question,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onMoveToPosition,
  onImageUpload,
  onAddRecommendedOptions,
}: QuestionCardProps) {
  const { toast } = useToast()
  const contextInputRef = useRef<HTMLInputElement>(null)
  const promptInputRef = useRef<HTMLInputElement>(null)
  const contextTextareaRef = useRef<HTMLTextAreaElement>(null)
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [cursorPositions, setCursorPositions] = useState<{ context: number | null; prompt: number | null }>({
    context: null,
    prompt: null,
  })
  const [imageLayout, setImageLayout] = useState<{ context: 'stacked' | 'side-by-side'; prompt: 'stacked' | 'side-by-side' }>({
    context: 'stacked',
    prompt: 'stacked',
  })
  
  // Note: Blank marker normalization happens in handlePromptTextChange during typing
  // and when loading questions (in the initial state). No useEffect needed here.
  const [showPreview, setShowPreview] = useState(false)
  const [showTableDialog, setShowTableDialog] = useState(false)
  const [tableConfig, setTableConfig] = useState<{ field: 'context' | 'prompt' | null; rows: number; cols: number }>({
    field: null,
    rows: 3,
    cols: 3,
  })

  const handleOptionUpdate = (optionId: string, updater: (option: OptionDraft) => OptionDraft) => {
    onChange((prev) => ({
      ...prev,
      options: prev.options.map((option) =>
        option.id === optionId ? updater(option) : option
      ),
    }))
  }

  const addOption = () => {
    onChange((prev) => ({
      ...prev,
      options: [...prev.options, { id: nanoid(), label: '', isCorrect: false }],
    }))
  }

  const removeOption = (optionId: string) => {
    onChange((prev) => ({
      ...prev,
      options: prev.options.filter((option) => option.id !== optionId),
    }))
  }

  const handleImageChange = (field: 'context' | 'prompt', fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const file = fileList[0]
    
    // Get cursor position from the appropriate textarea
    const textareaRef = field === 'context' ? contextTextareaRef : promptTextareaRef
    const cursorPos = textareaRef.current?.selectionStart ?? null
    
    // Store cursor position - we'll insert the image markdown at this position in the text
    // The image will be inserted into the text-only content, then we'll reconstruct
    setCursorPositions(prev => ({ ...prev, [field]: cursorPos }))
    
    // Pass the cursor position relative to text-only content
    // The parent will handle inserting at the right position
    onImageUpload(field, file, cursorPos)
  }

  const handleTextareaClick = (field: 'context' | 'prompt') => {
    const textareaRef = field === 'context' ? contextTextareaRef : promptTextareaRef
    // Update cursor position when user clicks in textarea
    setTimeout(() => {
      if (textareaRef.current) {
        const pos = textareaRef.current.selectionStart
        setCursorPositions(prev => ({ ...prev, [field]: pos }))
      }
    }, 0)
  }

  const handleTextareaKeyUp = (field: 'context' | 'prompt') => {
    const textareaRef = field === 'context' ? contextTextareaRef : promptTextareaRef
    // Update cursor position when user types or moves cursor
    if (textareaRef.current) {
      const pos = textareaRef.current.selectionStart
      setCursorPositions(prev => ({ ...prev, [field]: pos }))
    }
  }

  const handleAddTable = (field: 'context' | 'prompt') => {
    setTableConfig({ field, rows: 3, cols: 3 })
    setShowTableDialog(true)
  }

  const insertTable = () => {
    if (!tableConfig.field) return
    
    const table = generateMarkdownTable(tableConfig.rows, tableConfig.cols)
    const field = tableConfig.field
    
    // Add new table to the appropriate tables array
    const newTable = { id: nanoid(), markdown: table }
    
    if (field === 'context') {
      onChange((prev) => ({
        ...prev,
        contextTables: [...(prev.contextTables || []), newTable]
      }))
    } else {
      onChange((prev) => ({
        ...prev,
        promptTables: [...(prev.promptTables || []), newTable]
      }))
    }
    
    setShowTableDialog(false)
    toast({
      title: 'Table added',
      description: `A ${tableConfig.rows}x${tableConfig.cols} table was inserted.`,
    })
  }

  // FRQ Parts handlers
  const addFRQPart = () => {
    const existingParts = question.frqParts || []
    const newPart: FRQPart = {
      id: nanoid(),
      label: '', // Will be set dynamically based on index
      prompt: '',
      points: 1,
    }
    onChange((prev) => ({
      ...prev,
      frqParts: [...(prev.frqParts || []), newPart],
    }))
  }

  const updateFRQPart = (partId: string, updater: (part: FRQPart) => FRQPart) => {
    onChange((prev) => ({
      ...prev,
      frqParts: (prev.frqParts || []).map((part) =>
        part.id === partId ? updater(part) : part
      ),
    }))
  }

  const removeFRQPart = (partId: string) => {
    onChange((prev) => ({
      ...prev,
      frqParts: (prev.frqParts || []).filter((part) => part.id !== partId),
    }))
  }

  // Get dynamic label for FRQ part based on index
  const getFRQPartLabel = (index: number): string => {
    return String.fromCharCode(97 + index) // a, b, c, d, etc.
  }


  const contextImages = extractImages(question.context)
  const promptImages = extractImages(question.prompt)
  const contextTables = question.contextTables || []
  const promptTables = question.promptTables || []
  
  // Remove only images from text (tables are stored separately now)
  let contextText = removeImageMarkdown(question.context)
  let promptText = removeImageMarkdown(question.prompt)
  
  // Don't normalize here - it causes re-renders that interfere with typing
  // Normalization happens in handlePromptTextChange when user types

  const handleContextTextChange = (newText: string) => {
    const newImages = extractImages(question.context)
    const reconstructed = reconstructMarkdown(newText, newImages)
    onChange((prev) => ({ ...prev, context: reconstructed }))
  }

  const handlePromptTextChange = (newText: string) => {
    const newImages = extractImages(question.prompt)
    let reconstructed = reconstructMarkdown(newText, newImages)
    
    // For fill-in-the-blank questions, automatically number any unnumbered [blank] markers
    if (question.type === 'FILL_BLANK') {
      reconstructed = normalizeBlankMarkers(reconstructed)
      
      // Count blanks
      const newBlankCount = (reconstructed.match(/\[blank\d+\]/g) || []).length
      const currentBlankAnswers = question.blankAnswers || []
      const currentBlankPoints = question.blankPoints || []
      
      // Adjust blankAnswers array to match new blank count
      let newBlankAnswers: string[]
      if (newBlankCount > currentBlankAnswers.length) {
        // Added blanks - pad with empty strings
        newBlankAnswers = [...currentBlankAnswers, ...Array(newBlankCount - currentBlankAnswers.length).fill('')]
      } else if (newBlankCount < currentBlankAnswers.length) {
        // Removed blanks - truncate array
        newBlankAnswers = currentBlankAnswers.slice(0, newBlankCount)
      } else {
        // Same count - keep existing
        newBlankAnswers = currentBlankAnswers
      }
      
      // Adjust blankPoints array to match new blank count
      let newBlankPoints: (number | null)[]
      if (newBlankCount > currentBlankPoints.length) {
        // Added blanks - pad with null
        newBlankPoints = [...currentBlankPoints, ...Array(newBlankCount - currentBlankPoints.length).fill(null)]
      } else if (newBlankCount < currentBlankPoints.length) {
        // Removed blanks - truncate array
        newBlankPoints = currentBlankPoints.slice(0, newBlankCount)
      } else {
        // Same count - keep existing
        newBlankPoints = currentBlankPoints
      }
      
      onChange((prev) => ({ ...prev, prompt: reconstructed, blankAnswers: newBlankAnswers, blankPoints: newBlankPoints }))
    } else {
      onChange((prev) => ({ ...prev, prompt: reconstructed }))
    }
  }

  const handleInsertBlank = () => {
    if (!promptTextareaRef.current) return
    const textarea = promptTextareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    
    // Use promptText which already has images removed
    const currentText = promptText
    
    // Count existing blanks (both [blank] and [blank1], [blank2], etc.)
    const blankMatches = currentText.match(/\[blank\d*\]/g) || []
    const blankCount = blankMatches.length
    
    // Create numbered blank marker
    const blankMarker = `[blank${blankCount + 1}]`
    
    // Insert blank marker at cursor position
    const newText = currentText.substring(0, start) + blankMarker + currentText.substring(end)
    
    // Update the text using handlePromptTextChange which handles image reconstruction
    handlePromptTextChange(newText)
    
    // Set cursor position after the inserted blank marker
    setTimeout(() => {
      if (promptTextareaRef.current) {
        const newPosition = start + blankMarker.length
        promptTextareaRef.current.setSelectionRange(newPosition, newPosition)
        promptTextareaRef.current.focus()
      }
    }, 0)
  }

  const removeImage = (field: 'context' | 'prompt', imageSrc: string) => {
    const currentContent = question[field]
    const images = extractImages(currentContent)
    const remainingImages = images.filter(img => img.src !== imageSrc)
    const text = removeImageMarkdown(currentContent)
    const reconstructed = reconstructMarkdown(text, remainingImages)
    onChange((prev) => ({ ...prev, [field]: reconstructed }))
  }

  const removeTable = (field: 'context' | 'prompt', tableId: string) => {
    if (field === 'context') {
      onChange((prev) => ({
        ...prev,
        contextTables: (prev.contextTables || []).filter(t => t.id !== tableId)
      }))
    } else {
      onChange((prev) => ({
        ...prev,
        promptTables: (prev.promptTables || []).filter(t => t.id !== tableId)
      }))
    }
    
    toast({
      title: 'Table removed',
      description: 'The table has been deleted.',
    })
  }

  const handleDragEnd = (field: 'context' | 'prompt', event: DragEndEvent, type: 'image' | 'table') => {
    const { active, over } = event
    
    if (!over || active.id === over.id) return
    
    if (type === 'image') {
      const currentContent = question[field]
      const images = extractImages(currentContent)
      
      const oldIndex = images.findIndex(img => img.src === active.id)
      const newIndex = images.findIndex(img => img.src === over.id)
      
      if (oldIndex === -1 || newIndex === -1) return
      
      const newImages = arrayMove(images, oldIndex, newIndex)
      const text = removeImageMarkdown(currentContent)
      const reconstructed = reconstructMarkdown(text, newImages)
      onChange((prev) => ({ ...prev, [field]: reconstructed }))
    } else {
      const tables = field === 'context' ? question.contextTables || [] : question.promptTables || []
      
      const oldIndex = tables.findIndex(t => t.id === active.id)
      const newIndex = tables.findIndex(t => t.id === over.id)
      
      if (oldIndex === -1 || newIndex === -1) return
      
      const newTables = arrayMove(tables, oldIndex, newIndex)
      
      if (field === 'context') {
        onChange((prev) => ({ ...prev, contextTables: newTables }))
      } else {
        onChange((prev) => ({ ...prev, promptTables: newTables }))
      }
    }
  }

  const moveImage = (field: 'context' | 'prompt', imageSrc: string, direction: 'up' | 'down') => {
    const currentContent = question[field]
    const images = extractImages(currentContent)
    const imageIndex = images.findIndex(img => img.src === imageSrc)
    
    if (imageIndex === -1) return
    if (direction === 'up' && imageIndex === 0) return
    if (direction === 'down' && imageIndex === images.length - 1) return
    
    const newImages = [...images]
    const targetIndex = direction === 'up' ? imageIndex - 1 : imageIndex + 1
    ;[newImages[imageIndex], newImages[targetIndex]] = [newImages[targetIndex], newImages[imageIndex]]
    
    const text = removeImageMarkdown(currentContent)
    const reconstructed = reconstructMarkdown(text, newImages)
    onChange((prev) => ({ ...prev, [field]: reconstructed }))
  }

  const moveTable = (field: 'context' | 'prompt', tableId: string, direction: 'up' | 'down') => {
    const tables = field === 'context' ? question.contextTables || [] : question.promptTables || []
    const tableIndex = tables.findIndex(t => t.id === tableId)
    
    if (tableIndex === -1) return
    if (direction === 'up' && tableIndex === 0) return
    if (direction === 'down' && tableIndex === tables.length - 1) return
    
    const newTables = [...tables]
    const targetIndex = direction === 'up' ? tableIndex - 1 : tableIndex + 1
    ;[newTables[tableIndex], newTables[targetIndex]] = [newTables[targetIndex], newTables[tableIndex]]
    
    if (field === 'context') {
      onChange((prev) => ({ ...prev, contextTables: newTables }))
    } else {
      onChange((prev) => ({ ...prev, promptTables: newTables }))
    }
  }

  const editTable = (field: 'context' | 'prompt', tableId: string, newMarkdown: string) => {
    const tables = field === 'context' ? question.contextTables || [] : question.promptTables || []
    
    const updatedTables = tables.map(t => 
      t.id === tableId ? { ...t, markdown: newMarkdown } : t
    )
    
    if (field === 'context') {
      onChange((prev) => ({ ...prev, contextTables: updatedTables }))
    } else {
      onChange((prev) => ({ ...prev, promptTables: updatedTables }))
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const [positionInput, setPositionInput] = useState<string>((index + 1).toString())

  // Update position input when index changes
  useEffect(() => {
    setPositionInput((index + 1).toString())
  }, [index])

  const handlePositionChange = (value: string) => {
    setPositionInput(value)
  }

  const handlePositionBlur = () => {
    const numValue = parseInt(positionInput, 10)
    if (!isNaN(numValue) && numValue >= 1 && numValue <= total) {
      onMoveToPosition(numValue)
    } else {
      // Reset to current position if invalid
      setPositionInput((index + 1).toString())
    }
  }

  const handlePositionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-2 border-b border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-muted-foreground">
            Question{' '}
            <span className="font-normal text-muted-foreground/80">
              • {renderTypeLabel(question.type)}
            </span>
          </p>
          <Input
            type="number"
            min={1}
            max={total}
            value={positionInput}
            onChange={(e) => handlePositionChange(e.target.value)}
            onBlur={handlePositionBlur}
            onKeyDown={handlePositionKeyDown}
            className="w-16 h-7 text-center text-xs"
          />
          <span className="text-xs text-muted-foreground">of {total}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowPreview(true)}
          >
            <Eye className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Preview Question</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onMoveUp}
            disabled={index === 0}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onMoveDown}
            disabled={index === total - 1}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onRemove}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="space-y-6 p-4">
        {question.type !== 'TEXT_BLOCK' && (
        <div>
          <div className="flex items-center justify-between text-sm font-medium mb-2">
            <Label htmlFor={`context-label-${index}`}>Context / stimulus (optional)</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleAddTable('context')
                }}
              >
                <TableIcon className="mr-2 h-4 w-4" />
                Add Table
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  contextInputRef.current?.click()
                }}
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Add Image
              </Button>
            </div>
            <input
              ref={contextInputRef}
              id={`context-input-${index}`}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files && event.target.files.length > 0) {
                  Array.from(event.target.files).forEach(file => {
                    // Create a DataTransfer object to simulate FileList
                    const dataTransfer = new DataTransfer()
                    dataTransfer.items.add(file)
                    handleImageChange('context', dataTransfer.files)
                  })
                }
                event.target.value = ''
              }}
            />
          </div>
          {contextImages.length > 0 && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Images ({contextImages.length}) - Drag to reorder</Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant={imageLayout.context === 'stacked' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setImageLayout(prev => ({ ...prev, context: 'stacked' }))}
                    title="Stacked layout"
                  >
                    <LayoutList className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant={imageLayout.context === 'side-by-side' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setImageLayout(prev => ({ ...prev, context: 'side-by-side' }))}
                    title="Side-by-side layout"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => handleDragEnd('context', e, 'image')}
              >
                <SortableContext items={contextImages.map(img => img.src)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {contextImages.map((img, imgIndex) => (
                      <SortableImageItem
                        key={img.src}
                        id={img.src}
                        img={img}
                        index={imgIndex}
                        total={contextImages.length}
                        onRemove={() => removeImage('context', img.src)}
                        onMoveUp={() => moveImage('context', img.src, 'up')}
                        onMoveDown={() => moveImage('context', img.src, 'down')}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
          {contextTables.length > 0 && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Tables ({contextTables.length}) - Drag to reorder</Label>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => handleDragEnd('context', e, 'table')}
              >
                <SortableContext items={contextTables.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-4">
                    {contextTables.map((table, tableIndex) => (
                      <SortableTableItem
                        key={table.id}
                        id={table.id}
                        table={table}
                        index={tableIndex}
                        total={contextTables.length}
                        onRemove={() => removeTable('context', table.id)}
                        onMoveUp={() => moveTable('context', table.id, 'up')}
                        onMoveDown={() => moveTable('context', table.id, 'down')}
                        onEdit={(newMarkdown) => editTable('context', table.id, newMarkdown)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
          <div className="mt-2">
            <Label className="text-xs text-muted-foreground mb-1 block">Editor</Label>
            <textarea
              ref={contextTextareaRef}
              className="w-full min-h-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={contextText}
              onChange={(event) => handleContextTextChange(event.target.value)}
              onClick={() => handleTextareaClick('context')}
              onKeyUp={() => handleTextareaKeyUp('context')}
              onSelect={() => handleTextareaKeyUp('context')}
              placeholder="Type your text here. Click where you want to insert an image, then click 'Add Image'."
            />
          </div>
        </div>
        )}

        <div>
          <div className="flex items-center justify-between text-sm font-medium mb-2">
            <Label htmlFor={`prompt-label-${index}`}>
              {question.type === 'TEXT_BLOCK' ? 'Content *' : 'Prompt *'}
            </Label>
            <div className="flex gap-2">
              {question.type === 'FILL_BLANK' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleInsertBlank()
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Insert Blank
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleAddTable('prompt')
                }}
              >
                <TableIcon className="mr-2 h-4 w-4" />
                Add Table
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  promptInputRef.current?.click()
                }}
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Add Image
              </Button>
            </div>
            <input
              ref={promptInputRef}
              id={`prompt-input-${index}`}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files && event.target.files.length > 0) {
                  Array.from(event.target.files).forEach(file => {
                    // Create a DataTransfer object to simulate FileList
                    const dataTransfer = new DataTransfer()
                    dataTransfer.items.add(file)
                    handleImageChange('prompt', dataTransfer.files)
                  })
                }
                event.target.value = ''
              }}
            />
          </div>
          {promptImages.length > 0 && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Images ({promptImages.length})</Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant={imageLayout.prompt === 'stacked' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setImageLayout(prev => ({ ...prev, prompt: 'stacked' }))}
                    title="Stacked layout"
                  >
                    <LayoutList className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant={imageLayout.prompt === 'side-by-side' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setImageLayout(prev => ({ ...prev, prompt: 'side-by-side' }))}
                    title="Side-by-side layout"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => handleDragEnd('prompt', e, 'image')}
              >
                <SortableContext items={promptImages.map(img => img.src)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {promptImages.map((img, imgIndex) => (
                      <SortableImageItem
                        key={img.src}
                        id={img.src}
                        img={img}
                        index={imgIndex}
                        total={promptImages.length}
                        onRemove={() => removeImage('prompt', img.src)}
                        onMoveUp={() => moveImage('prompt', img.src, 'up')}
                        onMoveDown={() => moveImage('prompt', img.src, 'down')}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
          {promptTables.length > 0 && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Tables ({promptTables.length}) - Drag to reorder</Label>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => handleDragEnd('prompt', e, 'table')}
              >
                <SortableContext items={promptTables.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-4">
                    {promptTables.map((table, tableIndex) => (
                      <SortableTableItem
                        key={table.id}
                        id={table.id}
                        table={table}
                        index={tableIndex}
                        total={promptTables.length}
                        onRemove={() => removeTable('prompt', table.id)}
                        onMoveUp={() => moveTable('prompt', table.id, 'up')}
                        onMoveDown={() => moveTable('prompt', table.id, 'down')}
                        onEdit={(newMarkdown) => editTable('prompt', table.id, newMarkdown)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
          <div className="mt-2">
            <Label className="text-xs text-muted-foreground mb-1 block">Editor</Label>
            <textarea
              ref={promptTextareaRef}
              className="w-full min-h-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={promptText}
              onChange={(event) => handlePromptTextChange(event.target.value)}
              onClick={() => handleTextareaClick('prompt')}
              onKeyUp={() => handleTextareaKeyUp('prompt')}
              onSelect={() => handleTextareaKeyUp('prompt')}
              placeholder={
                question.type === 'FILL_BLANK' 
                  ? "Type your text here. Click where you want a blank, then click 'Insert Blank' to add numbered blank markers."
                  : question.type === 'TEXT_BLOCK'
                  ? "Type your text content here. Click where you want to insert an image, then click 'Add Image'."
                  : "Type your question here. Click where you want to insert an image, then click 'Add Image'."
              }
              required
            />
          </div>
        </div>

        {question.type === 'LONG_TEXT' && (
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">FRQ Parts</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Break down this question into multiple parts (a, b, c, d, etc.)
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addFRQPart}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Part
              </Button>
            </div>
            
            {question.frqParts && question.frqParts.length > 0 && (
              <div className="space-y-3">
                {question.frqParts.map((part, partIndex) => {
                  const dynamicLabel = getFRQPartLabel(partIndex)
                  return (
                    <div
                      key={part.id}
                      className="rounded-md border border-input bg-muted/30 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Part {dynamicLabel}</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFRQPart(part.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div>
                        <Label htmlFor={`part-prompt-${part.id}`}>Part {dynamicLabel} Prompt *</Label>
                        <textarea
                          id={`part-prompt-${part.id}`}
                          className="mt-2 w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={part.prompt}
                          onChange={(e) =>
                            updateFRQPart(part.id, (prev) => ({
                              ...prev,
                              prompt: e.target.value,
                            }))
                          }
                          placeholder={`Enter the question for part ${dynamicLabel}...`}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor={`part-points-${part.id}`}>Points for Part {dynamicLabel} *</Label>
                        <Input
                          id={`part-points-${part.id}`}
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={part.points}
                          onChange={(e) =>
                            updateFRQPart(part.id, (prev) => ({
                              ...prev,
                              points: Number(e.target.value) || 0.5,
                            }))
                          }
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            
            {(!question.frqParts || question.frqParts.length === 0) && (
              <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
                This is a single-part FRQ. Click &quot;Add Part&quot; to break it into multiple parts (a, b, c, d, etc.)
              </div>
            )}
          </div>
        )}

        {question.type !== 'LONG_TEXT' && question.type !== 'FILL_BLANK' && question.type !== 'TEXT_BLOCK' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Answer choices *</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {question.type === 'TRUE_FALSE' 
                    ? 'Select which option is correct (True or False).'
                    : 'At least one filled choice required. 4 recommended for multiple choice.'}
                </p>
              </div>
              <div className="flex gap-2">
                {question.type !== 'TRUE_FALSE' && question.options.length < 4 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onAddRecommendedOptions}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add to 4
                  </Button>
                )}
                {question.type !== 'TRUE_FALSE' && (
                  <Button type="button" size="sm" variant="outline" onClick={addOption}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add choice
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {(question.type === 'MCQ_SINGLE' || question.type === 'TRUE_FALSE') ? (
                <RadioGroup
                  value={question.options.find((opt) => opt.isCorrect)?.id || ''}
                  onValueChange={(value) => {
                    onChange((prev) => ({
                      ...prev,
                      options: prev.options.map((opt) => ({
                        ...opt,
                        isCorrect: opt.id === value,
                      })),
                    }))
                  }}
                  className="space-y-2"
                >
                  {question.options.map((option, optionIndex) => (
                    <div
                      key={option.id}
                      className="flex flex-col gap-2 rounded-md border border-input bg-background p-3 sm:flex-row sm:items-center"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value={option.id} id={`correct-${question.id}-${option.id}`} />
                        <Label htmlFor={`correct-${question.id}-${option.id}`} className="cursor-pointer font-normal text-sm">
                          Correct option
                        </Label>
                      </div>
                      <Input
                        value={option.label}
                        onChange={(event) =>
                          handleOptionUpdate(option.id, (prev) => ({
                            ...prev,
                            label: event.target.value,
                          }))
                        }
                        placeholder={`Option ${optionIndex + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(option.id)}
                        disabled={question.options.length <= 1 || question.type === 'TRUE_FALSE'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                question.options.map((option, optionIndex) => (
                  <div
                    key={option.id}
                    className="flex flex-col gap-2 rounded-md border border-input bg-background p-3 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`correct-${question.id}-${option.id}`}
                        checked={option.isCorrect}
                        onCheckedChange={(checked) => {
                          handleOptionUpdate(option.id, (prev) => ({
                            ...prev,
                            isCorrect: checked as boolean,
                          }))
                        }}
                      />
                      <Label htmlFor={`correct-${question.id}-${option.id}`} className="cursor-pointer font-normal text-sm">
                        Correct
                      </Label>
                    </div>
                    <Input
                      value={option.label}
                      onChange={(event) =>
                        handleOptionUpdate(option.id, (prev) => ({
                          ...prev,
                          label: event.target.value,
                        }))
                      }
                      placeholder={`Option ${optionIndex + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(option.id)}
                      disabled={question.options.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
            {question.type !== 'TRUE_FALSE' && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`shuffle-${question.id}`}
                  checked={question.shuffleOptions}
                  onCheckedChange={(checked) =>
                    onChange((prev) => ({
                      ...prev,
                      shuffleOptions: checked as boolean,
                    }))
                  }
                />
                <Label htmlFor={`shuffle-${question.id}`} className="cursor-pointer font-normal text-sm">
                  Shuffle choices per student
                </Label>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={`points-${question.id}`}>
              Points {question.type === 'TEXT_BLOCK' ? '(optional)' : '*'}
            </Label>
            <Input
              id={`points-${question.id}`}
              type="number"
              min={question.type === 'TEXT_BLOCK' ? "0" : "0.5"}
              step="0.5"
              value={question.points}
              onChange={(event) =>
                onChange((prev) => ({
                  ...prev,
                  points: Number.isFinite(Number(event.target.value))
                    ? Number(event.target.value)
                    : prev.points,
                }))
              }
            />
            {question.type === 'TEXT_BLOCK' && (
              <p className="text-xs text-muted-foreground mt-1">
                Text blocks are display-only and typically have 0 points.
              </p>
            )}
          </div>
          <div>
            {question.type === 'FILL_BLANK' ? (() => {
              // Count the number of blank markers in the prompt (supports both [blank] and [blank1], [blank2], etc.)
              const blankCount = (question.prompt.match(/\[blank\d*\]/g) || []).length
              const blankAnswers = question.blankAnswers || Array(blankCount).fill('')
              const blankPoints = question.blankPoints || Array(blankCount).fill(null)
              
              return (
                <div>
                  <Label>
                    Correct Answers for Each Blank *
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">
                    Enter the correct answer for each blank. Answers will be auto-graded (case-insensitive).
                  </p>
                  {blankCount === 0 ? (
                    <div className="text-sm text-muted-foreground p-3 border border-dashed rounded-md">
                      Add [blank] markers to your prompt to set correct answers.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {Array.from({ length: blankCount }).map((_, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Label htmlFor={`blank-answer-${question.id}-${index}`} className="w-20 text-sm">
                            Blank {index + 1}:
                          </Label>
                          <Input
                            id={`blank-answer-${question.id}-${index}`}
                            type="text"
                            value={blankAnswers[index] || ''}
                            onChange={(e) => {
                              const newBlankAnswers = [...blankAnswers]
                              newBlankAnswers[index] = e.target.value
                              onChange((prev) => ({
                                ...prev,
                                blankAnswers: newBlankAnswers,
                              }))
                            }}
                            placeholder={`Correct answer for blank ${index + 1}`}
                            className="flex-1"
                          />
                          <Label htmlFor={`blank-points-${question.id}-${index}`} className="w-16 text-xs text-muted-foreground">
                            Points (optional):
                          </Label>
                          <Input
                            id={`blank-points-${question.id}-${index}`}
                            type="number"
                            min="0"
                            step="0.5"
                            max={question.points}
                            value={blankPoints[index] !== null && blankPoints[index] !== undefined ? blankPoints[index] : ''}
                            onChange={(e) => {
                              const newBlankPoints = [...blankPoints]
                              const value = e.target.value
                              const numValue = value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null)
                              
                              // Calculate sum of all blank points (excluding the current one being edited)
                              const otherPointsSum = newBlankPoints.reduce((sum, p, i) => {
                                if (i !== index && p !== null && p !== undefined) {
                                  return sum + Number(p)
                                }
                                return sum
                              }, 0)
                              
                              // Check if adding this value would exceed total points
                              const newValue = numValue !== null ? Number(numValue) : 0
                              const totalSum = otherPointsSum + newValue
                              
                              if (numValue !== null && totalSum > question.points) {
                                // Don't update if it would exceed total points
                                return
                              }
                              
                              newBlankPoints[index] = numValue
                              onChange((prev) => ({
                                ...prev,
                                blankPoints: newBlankPoints,
                              }))
                            }}
                            placeholder="Auto"
                            className="w-20"
                          />
                        </div>
                      ))}
                      {(() => {
                        // Calculate sum of specified blank points
                        const specifiedPointsSum = blankPoints.reduce((sum, p) => {
                          if (p !== null && p !== undefined) {
                            return sum + Number(p)
                          }
                          return sum
                        }, 0)
                        
                        // Show warning if sum exceeds total points
                        if (specifiedPointsSum > question.points) {
                          return (
                            <p className="text-xs text-destructive mt-2 font-medium">
                              Warning: Sum of blank points ({specifiedPointsSum}) exceeds question points ({question.points}).
                            </p>
                          )
                        }
                        
                        return (
                          <p className="text-xs text-muted-foreground mt-2">
                            If points are not specified, full credit requires all blanks to be correct.
                            {specifiedPointsSum > 0 && (
                              <span className="block mt-1">Total blank points: {specifiedPointsSum} / {question.points}</span>
                            )}
                          </p>
                        )
                      })()}
                    </div>
                  )}
                </div>
              )
            })() : (
              <>
                <Label htmlFor={`explanation-${question.id}`}>
                  {question.type === 'LONG_TEXT'
                    ? 'Example Answer (optional)' 
                    : question.type === 'TEXT_BLOCK'
                    ? 'Notes (optional)'
                    : 'Explanation (optional)'}
                </Label>
                <textarea
                  id={`explanation-${question.id}`}
                  className="mt-2 w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={question.explanation}
                  onChange={(event) =>
                    onChange((prev) => ({
                      ...prev,
                      explanation: event.target.value,
                    }))
                  }
                  placeholder={
                    question.type === 'LONG_TEXT'
                      ? 'Provide an example of a good answer for grading reference.'
                      : question.type === 'TEXT_BLOCK'
                      ? 'Add any notes or instructions about this text block.'
                      : 'Share the reasoning for the correct answer.'
                  }
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table Configuration Dialog */}
      <Dialog open={showTableDialog} onOpenChange={setShowTableDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Insert Table</DialogTitle>
            <DialogDescription>
              Configure the number of rows and columns for your table.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="table-rows">Number of Rows</Label>
              <Input
                id="table-rows"
                type="number"
                min="2"
                max="20"
                value={tableConfig.rows}
                onChange={(e) => setTableConfig(prev => ({ ...prev, rows: parseInt(e.target.value) || 2 }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum 2 rows (including header)
              </p>
            </div>
            <div>
              <Label htmlFor="table-cols">Number of Columns</Label>
              <Input
                id="table-cols"
                type="number"
                min="1"
                max="10"
                value={tableConfig.cols}
                onChange={(e) => setTableConfig(prev => ({ ...prev, cols: parseInt(e.target.value) || 1 }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum 10 columns
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTableDialog(false)}>
              Cancel
            </Button>
            <Button onClick={insertTable}>
              Insert Table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Question Preview (Student View)</DialogTitle>
            <DialogDescription>
              This is how Question {index + 1} will appear to students taking the test.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border-2 border-primary/20 bg-muted/30 p-6 space-y-4">
            {(question.context || (question.contextTables && question.contextTables.length > 0)) && (
              <div className="pb-4 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Context/Stimulus</p>
                <QuestionPrompt 
                  promptMd={
                    question.contextTables && question.contextTables.length > 0
                      ? `${question.context}\n\n${question.contextTables.map(t => t.markdown).join('\n\n')}`
                      : question.context
                  } 
                  imageLayout={imageLayout.context} 
                />
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Question {index + 1}</p>
              {question.type === 'FILL_BLANK' && /\[blank\d*\]/.test(question.prompt || '') ? (
                // For fill-in-the-blank, we'll render it inline with input fields below
                // Don't render the prompt separately here
                null
              ) : (
                <QuestionPrompt 
                  promptMd={
                    question.promptTables && question.promptTables.length > 0
                      ? `${question.prompt}\n\n${question.promptTables.map(t => t.markdown).join('\n\n')}`
                      : question.prompt
                  } 
                  imageLayout={imageLayout.prompt} 
                />
              )}
            </div>
            {question.type !== 'LONG_TEXT' && question.type !== 'FILL_BLANK' && question.type !== 'TEXT_BLOCK' && question.options.length > 0 && (
              <div className="space-y-2 pt-2">
                {(question.type === 'MCQ_SINGLE' || question.type === 'TRUE_FALSE') ? (
                  <RadioGroup className="space-y-2">
                    {question.options.filter(opt => opt.label.trim()).map((option, idx) => (
                      <div key={option.id} className="flex items-center gap-2">
                        <RadioGroupItem value={option.id} id={`preview-${question.id}-${option.id}`} disabled />
                        <Label htmlFor={`preview-${question.id}-${option.id}`} className="cursor-default font-normal">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="space-y-2">
                    {question.options.filter(opt => opt.label.trim()).map((option, idx) => (
                      <div key={option.id} className="flex items-center gap-2">
                        <Checkbox id={`preview-${question.id}-${option.id}`} disabled />
                        <Label htmlFor={`preview-${question.id}-${option.id}`} className="cursor-default font-normal">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {question.type === 'FILL_BLANK' && (() => {
              // Render fill-in-the-blank exactly as students will see it
              const promptText = question.prompt || ''
              const hasBlanks = /\[blank\d*\]/.test(promptText)
              
              if (hasBlanks) {
                // Parse the prompt to extract context and prompt sections
                const parts = promptText.split('---')
                const contextSection = parts.length > 1 ? parts[0].trim() : ''
                const promptSection = parts.length > 1 ? parts[1].trim() : promptText.trim()
                
                // Extract images and tables temporarily (similar to take-test-client)
                const imageRegex = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g
                const tableRegex = /(\|.+\|[\r\n]+\|[-:\s|]+\|[\r\n]+(?:\|.+\|(?:\r?\n(?!\r?\n))?)+)/g
                
                // Extract images and tables to render separately
                const imageMatches: string[] = []
                const tableMatches: string[] = []
                let match
                while ((match = imageRegex.exec(promptSection)) !== null) {
                  imageMatches.push(match[0])
                }
                while ((match = tableRegex.exec(promptSection)) !== null) {
                  tableMatches.push(match[0])
                }
                
                let textOnly = promptSection
                textOnly = textOnly.replace(imageRegex, '')
                textOnly = textOnly.replace(tableRegex, '')
                
                // Split on blank markers
                const normalizedText = textOnly.replace(/\[blank\d*\]/g, '[BLANK_MARKER]')
                const textSegments = normalizedText.split('[BLANK_MARKER]')
                const blankCount = textSegments.length - 1
                
                return (
                  <div className="pt-2 space-y-4">
                    {/* Render images separately if they exist (before the text) */}
                    {imageMatches.length > 0 && (
                      <div className="mb-4">
                        {imageMatches.map((img, idx) => (
                          <div key={`preview-img-${idx}`} className="my-3 rounded-md border border-input overflow-hidden bg-muted/30">
                            <img
                              src={img.match(/\(([^)]+)\)/)?.[1] || ''}
                              alt={img.match(/\[([^\]]*)\]/)?.[1] || 'Image'}
                              className="max-w-full max-h-96 object-contain block mx-auto"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Render prompt text with inline input fields (disabled for preview) */}
                    <div className="text-base leading-relaxed">
                      {textSegments.map((segment, index) => (
                        <span key={index} className="inline">
                          {segment && (
                            <span className="whitespace-pre-wrap">{segment}</span>
                          )}
                          {index < textSegments.length - 1 && (
                            <Input
                              type="text"
                              placeholder=""
                              disabled
                              value=""
                              className="inline-block w-auto min-w-[150px] max-w-[300px] mx-2 align-middle"
                            />
                          )}
                        </span>
                      ))}
                    </div>
                    
                    {/* Render tables separately if they exist (after the text) */}
                    {tableMatches.length > 0 && (
                      <div className="mt-4">
                        {tableMatches.map((table, idx) => (
                          <div key={`preview-table-${idx}`} className="my-3">
                            <QuestionPrompt promptMd={table} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }
              
              // Fallback if no blanks found
              return (
                <div className="pt-2">
                  <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/10 p-4 text-sm text-muted-foreground">
                    Add [blank] markers to your prompt to create fill-in-the-blank questions.
                  </div>
                </div>
              )
            })()}
            {question.type === 'TEXT_BLOCK' && (
              <div className="pt-2">
                <div className="rounded-md border border-muted-foreground/20 bg-muted/5 p-4 text-sm text-muted-foreground italic">
                  This is a text block (display-only content). Students will see this content but won&apos;t need to answer it.
                </div>
              </div>
            )}
            {question.type === 'LONG_TEXT' && (
              <div className="pt-2 space-y-4">
                {question.frqParts && question.frqParts.length > 0 ? (
                  <div className="space-y-4">
                    {question.frqParts.map((part, partIdx) => {
                      const dynamicLabel = getFRQPartLabel(partIdx)
                      return (
                        <div key={part.id} className="border-l-2 border-primary pl-4">
                          <p className="text-sm font-semibold mb-2">Part {dynamicLabel}) ({part.points} points)</p>
                          <p className="text-sm mb-2">{part.prompt}</p>
                          <div className="w-full min-h-[80px] rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-muted-foreground">
                            Student will type their answer here...
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="w-full min-h-[120px] rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-muted-foreground">
                    Student will type their answer here...
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground border-t border-border/50">
              <span>Points: {question.points}</span>
              {question.shuffleOptions && <span>Choices will be shuffled</span>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function renderTypeLabel(type: QuestionType) {
  switch (type) {
    case 'LONG_TEXT':
      return 'Free response'
    case 'MCQ_SINGLE':
      return 'Multiple choice'
    case 'MCQ_MULTI':
      return 'Select all that apply'
    case 'TRUE_FALSE':
      return 'True or False'
    case 'FILL_BLANK':
      return 'Fill in the blank'
    case 'TEXT_BLOCK':
      return 'Text block'
    default:
      return type
  }
}

// Sortable table item component with inline editing
function SortableTableItem({ 
  id, 
  table, 
  index, 
  total, 
  onRemove, 
  onMoveUp, 
  onMoveDown,
  onEdit
}: { 
  id: string
  table: { id: string; markdown: string }
  index: number
  total: number
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onEdit: (newMarkdown: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const { headers, rows } = markdownTableToData(table.markdown)
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
  const [editValue, setEditValue] = useState('')

  const startEditing = (row: number, col: number, currentValue: string) => {
    setEditingCell({ row, col })
    setEditValue(currentValue)
  }

  const saveEdit = () => {
    if (!editingCell) return
    
    const { row, col } = editingCell
    let newHeaders = [...headers]
    let newRows = rows.map(r => [...r])
    
    if (row === -1) {
      // Editing header
      newHeaders[col] = editValue
    } else {
      // Editing body cell
      newRows[row][col] = editValue
    }
    
    const newMarkdown = dataToMarkdownTable(newHeaders, newRows)
    onEdit(newMarkdown)
    setEditingCell(null)
  }

  const cancelEdit = () => {
    setEditingCell(null)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 p-2 rounded-md border border-input bg-muted/30"
    >
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-center h-7 w-7 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex-1 overflow-x-auto">
        <table className="min-w-full border-collapse border border-input bg-background text-sm">
          <thead>
            <tr className="bg-muted/30">
              {headers.map((header, i) => (
                <td key={i} className="border border-input px-3 py-2 max-w-[200px]">
                  {editingCell?.row === -1 && editingCell?.col === i ? (
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          saveEdit()
                        }
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      autoFocus
                      rows={1}
                      className="w-full bg-background border border-input rounded px-2 py-1 resize-none overflow-hidden"
                      style={{ minHeight: '32px' }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement
                        target.style.height = 'auto'
                        target.style.height = target.scrollHeight + 'px'
                      }}
                    />
                  ) : (
                    <div
                      onClick={() => startEditing(-1, i, header)}
                      className="cursor-text hover:bg-muted/50 rounded px-1 py-0.5 min-w-[40px] break-words whitespace-pre-wrap"
                    >
                      {header || '\u00A0'}
                    </div>
                  )}
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} className="border border-input px-3 py-2 max-w-[200px]">
                    {editingCell?.row === rowIdx && editingCell?.col === cellIdx ? (
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            saveEdit()
                          }
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        autoFocus
                        rows={1}
                        className="w-full bg-background border border-input rounded px-2 py-1 resize-none overflow-hidden"
                        style={{ minHeight: '32px' }}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement
                          target.style.height = 'auto'
                          target.style.height = target.scrollHeight + 'px'
                        }}
                      />
                    ) : (
                      <div
                        onClick={() => startEditing(rowIdx, cellIdx, cell)}
                        className="cursor-text hover:bg-muted/50 rounded px-1 py-0.5 min-w-[40px] break-words whitespace-pre-wrap"
                      >
                        {cell || '\u00A0'}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation()
              onMoveUp()
            }}
            disabled={index === 0}
            title="Move up"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation()
              onMoveDown()
            }}
            disabled={index === total - 1}
            title="Move down"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          title="Remove table"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="text-xs text-muted-foreground pt-1">
        #{index + 1}
      </div>
    </div>
  )
}

// Sortable image item component
function SortableImageItem({ 
  id, 
  img, 
  index, 
  total, 
  onRemove, 
  onMoveUp, 
  onMoveDown 
}: { 
  id: string
  img: { alt: string; src: string }
  index: number
  total: number
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 p-2 rounded-md border border-input bg-muted/30 cursor-grab active:cursor-grabbing"
    >
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-center h-7 w-7 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex-1 relative rounded-md border border-input overflow-hidden bg-background min-w-[100px]">
        <img
          src={img.src}
          alt={img.alt}
          className="max-w-full max-h-32 object-contain block"
        />
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation()
              onMoveUp()
            }}
            disabled={index === 0}
            title="Move up"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation()
              onMoveDown()
            }}
            disabled={index === total - 1}
            title="Move down"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          title="Remove image"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="text-xs text-muted-foreground pt-1">
        #{index + 1}
      </div>
    </div>
  )
}
