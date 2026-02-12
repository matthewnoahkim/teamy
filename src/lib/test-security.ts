import argon2 from 'argon2'
import crypto from 'crypto'

/**
 * Hash a test admin password using Argon2id
 */
export async function hashTestPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  })
}

/**
 * Verify a test admin password against a hash
 */
export async function verifyTestPassword(
  hash: string,
  password: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password)
  } catch (_error) {
    return false
  }
}

/**
 * Generate a client fingerprint hash from browser data
 */
export function generateClientFingerprint(data: {
  userAgent: string
  timezone?: string
  platform?: string
  language?: string
}): string {
  const fingerprint = JSON.stringify(data)
  return crypto.createHash('sha256').update(fingerprint).digest('hex')
}

/**
 * Generate a seeded random number for question/option shuffling
 * Uses attemptId as seed for deterministic randomization
 */
export function seededRandom(seed: string, index: number): number {
  const hash = crypto
    .createHash('sha256')
    .update(seed + index.toString())
    .digest()
  return hash.readUInt32BE(0) / 0xffffffff
}

/**
 * Shuffle an array using a seed for deterministic randomization
 */
export function seededShuffle<T>(array: T[], seed: string): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed, i) * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Calculate proctoring risk score from events
 * Returns 0-100, higher = more suspicious
 */
export function calculateProctoringScore(events: Array<{ kind: string }>): number {
  const weights: Record<string, number> = {
    EXIT_FULLSCREEN: 15,
    TAB_SWITCH: 10,
    VISIBILITY_HIDDEN: 8,
    DEVTOOLS_OPEN: 20,
    BLUR: 5,
    COPY: 10,
    PASTE: 8,
    CONTEXTMENU: 3,
    RESIZE: 2,
    NETWORK_OFFLINE: 5,
    MULTI_MONITOR_HINT: 12,
  }

  let score = 0
  const eventCounts: Record<string, number> = {}

  events.forEach((event) => {
    const kind = event.kind
    eventCounts[kind] = (eventCounts[kind] || 0) + 1
    const weight = weights[kind] || 1
    
    // Apply diminishing returns for repeated events
    const count = eventCounts[kind]
    const diminished = weight * Math.log(count + 1)
    score += diminished
  })

  // Cap at 100
  return Math.min(Math.round(score), 100)
}

/**
 * Check if a test is currently available for taking
 */
export function isTestAvailable(test: {
  status: string
  startAt: Date | null
  endAt: Date | null
  allowLateUntil: Date | null
}): { available: boolean; reason?: string } {
  if (test.status !== 'PUBLISHED') {
    return { available: false, reason: 'Test is not published' }
  }

  const now = new Date()

  if (test.startAt && now < test.startAt) {
    return { available: false, reason: 'Test has not started yet' }
  }

  if (test.endAt) {
    const deadline = test.allowLateUntil || test.endAt
    if (now > deadline) {
      return { available: false, reason: 'Test deadline has passed' }
    }
  }

  return { available: true }
}

/**
 * Get IP address from request headers
 */
export function getClientIp(headers: Headers): string | null {
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    null
  )
}

/**
 * Auto-grade a question answer
 */
export function autoGradeQuestion(question: {
  type: string
  points: number
  numericTolerance?: number | null
  promptMd?: string | null
  explanation?: string | null
  options?: Array<{ id: string; isCorrect: boolean; label: string }>
}, answer: {
  selectedOptionIds?: string[]
  numericAnswer?: number | null
  answerText?: string | null
}): { pointsAwarded: number; isCorrect: boolean } {
  const points = Number(question.points)

  if (question.type === 'MCQ_SINGLE') {
    const correctOption = question.options?.find((o) => o.isCorrect)
    const selectedId = answer.selectedOptionIds?.[0]
    const isCorrect = selectedId === correctOption?.id
    return { pointsAwarded: isCorrect ? points : 0, isCorrect }
  }

  if (question.type === 'MCQ_MULTI') {
    const correctIds = new Set(
      question.options?.filter((o) => o.isCorrect).map((o) => o.id) || []
    )
    const selectedIds = new Set(answer.selectedOptionIds || [])
    
    // All correct answers must be selected, no incorrect ones
    const allCorrectSelected = [...correctIds].every((id) => selectedIds.has(id))
    const noIncorrectSelected = [...selectedIds].every((id) => correctIds.has(id))
    const isCorrect = allCorrectSelected && noIncorrectSelected
    
    return { pointsAwarded: isCorrect ? points : 0, isCorrect }
  }

  if (question.type === 'NUMERIC' && answer.numericAnswer !== null && answer.numericAnswer !== undefined) {
    // Find the correct option (should be the one marked as isCorrect)
    const correctOption = question.options?.find((o) => o.isCorrect)
    if (!correctOption) {
      return { pointsAwarded: 0, isCorrect: false }
    }

    // The correct answer should be in the option's label
    const correctAnswer = parseFloat(correctOption.label)
    if (isNaN(correctAnswer)) {
      return { pointsAwarded: 0, isCorrect: false }
    }

    const tolerance = Number(question.numericTolerance) || 0
    const studentAnswer = Number(answer.numericAnswer)
    const isCorrect = Math.abs(studentAnswer - correctAnswer) <= tolerance
    
    return { pointsAwarded: isCorrect ? points : 0, isCorrect }
  }

  // Handle fill-in-the-blank questions (SHORT_TEXT with blank markers: [blank] or [blank1], [blank2], etc.)
  if (question.type === 'SHORT_TEXT' && question.promptMd && /\[blank\d*\]/.test(question.promptMd) && answer.answerText) {
    try {
      // Parse correct answers and points from explanation field (stored as JSON object)
      const parsed = question.explanation ? JSON.parse(question.explanation) : null
      let correctAnswers: string[] = []
      let blankPoints: (number | null)[] = []
      
      if (parsed && typeof parsed === 'object' && 'answers' in parsed) {
        // New format: { answers: string[], points?: number[] }
        correctAnswers = parsed.answers || []
        blankPoints = parsed.points || []
      } else if (Array.isArray(parsed)) {
        // Old format: just array of answers
        correctAnswers = parsed
        blankPoints = []
      }
      
      if (correctAnswers.length === 0) {
        return { pointsAwarded: 0, isCorrect: false }
      }

      // Parse student's answers (stored as delimited string)
      const studentAnswers = answer.answerText.split(' | ').map(a => a.trim())
      
      // Check if all blanks are filled
      if (studentAnswers.length !== correctAnswers.length) {
        return { pointsAwarded: 0, isCorrect: false }
      }

      // Check if per-blank points are specified
      const hasPerBlankPoints = blankPoints.length > 0 && blankPoints.some(p => p !== null && p !== undefined)
      
      if (hasPerBlankPoints) {
        // Award points per correct blank
        let pointsAwarded = 0
        let allCorrect = true
        
        studentAnswers.forEach((studentAnswer, index) => {
          const correctAnswer = correctAnswers[index]?.trim() || ''
          const isCorrect = studentAnswer.toLowerCase() === correctAnswer.toLowerCase()
          const blankPointValue = blankPoints[index]
          
          if (isCorrect && blankPointValue !== null && blankPointValue !== undefined) {
            pointsAwarded += Number(blankPointValue)
          } else {
            allCorrect = false
          }
        })
        
        return { pointsAwarded, isCorrect: allCorrect }
      } else {
        // All-or-nothing: all blanks must be correct
        const allCorrect = studentAnswers.every((studentAnswer, index) => {
          const correctAnswer = correctAnswers[index]?.trim() || ''
          return studentAnswer.toLowerCase() === correctAnswer.toLowerCase()
        })

        return { pointsAwarded: allCorrect ? points : 0, isCorrect: allCorrect }
      }
    } catch (_error) {
      // If parsing fails, require manual grading
      return { pointsAwarded: 0, isCorrect: false }
    }
  }

  // Text questions require manual grading
  return { pointsAwarded: 0, isCorrect: false }
}

/**
 * Rate limiting check for test operations
 * Simple in-memory implementation (should use Redis in production)
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetAt) {
    const resetAt = now + windowMs
    rateLimitStore.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: maxRequests - 1, resetAt }
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt }
  }

  record.count++
  return { allowed: true, remaining: maxRequests - record.count, resetAt: record.resetAt }
}

// Cleanup old rate limit entries every hour
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetAt) {
        rateLimitStore.delete(key)
      }
    }
  }, 60 * 60 * 1000)
}

/**
 * Check if scores should be released for a test
 */
export function shouldReleaseScores(test: {
  releaseScoresAt: Date | null
  status: string
}): boolean {
  // Always release for draft/closed tests (shouldn't be taking these anyway)
  if (test.status !== 'PUBLISHED') {
    return true
  }

  // If no releaseScoresAt is set, release immediately
  if (!test.releaseScoresAt) {
    return true
  }

  // Release if current time is past releaseScoresAt
  return new Date() >= test.releaseScoresAt
}

/**
 * Calculate grading status for an attempt
 */
export function calculateGradingStatus(answers: Array<{
  gradedAt: Date | null
  question: { type: string }
}>): {
  status: 'UNGRADED' | 'PARTIALLY_GRADED' | 'FULLY_GRADED'
  gradedCount: number
  totalCount: number
  ungradedCount: number
} {
  const totalCount = answers.length
  const gradedCount = answers.filter((a) => a.gradedAt !== null).length
  const ungradedCount = totalCount - gradedCount

  let status: 'UNGRADED' | 'PARTIALLY_GRADED' | 'FULLY_GRADED'
  if (gradedCount === 0) {
    status = 'UNGRADED'
  } else if (gradedCount === totalCount) {
    status = 'FULLY_GRADED'
  } else {
    status = 'PARTIALLY_GRADED'
  }

  return { status, gradedCount, totalCount, ungradedCount }
}

/**
 * Calculate score breakdown for an attempt
 */
export function calculateScoreBreakdown(answers: Array<{
  pointsAwarded: number | null
  gradedAt: Date | null
  question: { points: number }
}>): {
  earnedPoints: number
  gradedTotalPoints: number
  overallTotalPoints: number
  hasUngradedQuestions: boolean
} {
  let earnedPoints = 0
  let gradedTotalPoints = 0
  let overallTotalPoints = 0

  answers.forEach((answer) => {
    const questionPoints = Number(answer.question.points)
    overallTotalPoints += questionPoints

    if (answer.gradedAt !== null) {
      gradedTotalPoints += questionPoints
      earnedPoints += Number(answer.pointsAwarded || 0)
    }
  })

  const hasUngradedQuestions = gradedTotalPoints < overallTotalPoints

  return {
    earnedPoints,
    gradedTotalPoints,
    overallTotalPoints,
    hasUngradedQuestions,
  }
}

/**
 * Filter attempt data based on score release settings
 */
export function filterAttemptByReleaseMode(
  attempt: Record<string, unknown> & { gradeEarned?: unknown; proctoringScore?: unknown; answers?: Array<Record<string, unknown>> },
  test: {
    scoreReleaseMode: 'NONE' | 'SCORE_ONLY' | 'SCORE_WITH_WRONG' | 'FULL_TEST'
    releaseScoresAt: Date | null
    status: string
  },
  isAdmin: boolean
): Record<string, unknown> {
  // Admins always see everything
  if (isAdmin) {
    return attempt
  }

  // Check if scores should be released
  const scoresReleased = shouldReleaseScores(test)

  if (!scoresReleased) {
    // Hide all score-related information
    return {
      ...attempt,
      gradeEarned: null,
      proctoringScore: null,
      answers: attempt.answers?.map((answer) => ({
        ...answer,
        pointsAwarded: null,
        gradedAt: null,
        graderNote: null,
      })),
    }
  }

  // NONE mode - don't release anything, even if releaseScoresAt has passed
  if (test.scoreReleaseMode === 'NONE') {
    return {
      ...attempt,
      gradeEarned: null,
      proctoringScore: null,
      answers: null,
    }
  }

  // Scores are released - filter based on mode
  if (test.scoreReleaseMode === 'SCORE_ONLY') {
    // Only show overall score
    return {
      ...attempt,
      gradeEarned: attempt.gradeEarned,
      proctoringScore: null,
      answers: null, // Hide all answer details
    }
  }

  if (test.scoreReleaseMode === 'SCORE_WITH_WRONG') {
    // Show score and which questions were wrong (but not the answers)
    return {
      ...attempt,
      gradeEarned: attempt.gradeEarned,
      proctoringScore: null,
      answers: attempt.answers?.map((answer) => ({
        id: answer.id,
        questionId: answer.questionId,
        pointsAwarded: answer.pointsAwarded,
        // Include question data so UI can show which questions were wrong
        // But hide options to prevent seeing correct answers
        question: (answer.question as Record<string, unknown> | null) ? {
          id: (answer.question as Record<string, unknown>).id,
          promptMd: (answer.question as Record<string, unknown>).promptMd,
          type: (answer.question as Record<string, unknown>).type,
          points: (answer.question as Record<string, unknown>).points,
          sectionId: (answer.question as Record<string, unknown>).sectionId,
          order: (answer.question as Record<string, unknown>).order,
          // Don't include options to hide correct answers
          options: [],
        } : null,
        // Hide actual answers and feedback
        answerText: null,
        selectedOptionIds: null,
        numericAnswer: null,
        graderNote: null,
      })),
    }
  }

  // FULL_TEST mode - show everything
  return attempt
}

