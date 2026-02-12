import type { ChatCompletionMessageParam } from 'openai/resources/index.mjs'
import { getOpenAIClient, ensureOpenAIConfigured } from './ai'

const DEFAULT_FRQ_MODEL = process.env.OPENAI_FRQ_MODEL || 'gpt-4o-mini'

export interface FrqSuggestionInput {
  questionPrompt: string
  rubric?: string | null
  maxPoints: number
  studentResponse?: string | null
}

export interface FrqSuggestionResult {
  suggestedScore: number
  maxScore: number
  summary: string
  strengths?: string
  gaps?: string
  rubricAlignment?: string
  rawResponse: unknown
}

const responseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'frq_grading_suggestion',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        suggestedScore: {
          type: 'number',
          description: 'Suggested numeric score for the response',
        },
        maxScore: {
          type: 'number',
          description: 'Maximum score the question is worth',
        },
        summary: {
          type: 'string',
          description: 'One-paragraph rationale for the suggested score',
        },
        strengths: {
          type: 'string',
          description: 'Brief summary of what the student did well',
        },
        gaps: {
          type: 'string',
          description: 'Brief summary of what is missing or incorrect',
        },
        rubricAlignment: {
          type: 'string',
          description: 'Explain how rubric criteria map to the points awarded',
        },
      },
      required: ['suggestedScore', 'maxScore', 'summary'],
    },
  },
}

export async function requestFrqSuggestion(input: FrqSuggestionInput): Promise<FrqSuggestionResult> {
  ensureOpenAIConfigured()
  const client = getOpenAIClient()
  if (!client) {
    throw new Error('OpenAI client is not available')
  }

  const sanitizedPrompt = input.questionPrompt?.trim() || 'No prompt provided'
  const sanitizedRubric = input.rubric?.trim() || 'No rubric text was provided. Use the prompt to infer expectations.'
  const sanitizedResponse = input.studentResponse?.trim() || 'The student left this question blank.'

  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content:
        'You are an experienced Science Olympiad test grader. Provide consistent, rubric-aligned suggestions. ' +
        'Never award points beyond the stated maximum. Always err on the side of caution and note that a human will finalize grades.',
    },
    {
      role: 'user',
      content: [
        `Question prompt:\n${sanitizedPrompt}`,
        `Rubric / Example solution:\n${sanitizedRubric}`,
        `Maximum points available: ${input.maxPoints}`,
        `Student response:\n${sanitizedResponse}`,
        'Return a JSON object with your suggested score, a short summary, what went well, what is missing, and how the rubric criteria map to the score.',
      ].join('\n\n'),
    },
  ]

  const completion = await client.chat.completions.create({
    model: DEFAULT_FRQ_MODEL,
    temperature: 0.2,
    response_format: responseFormat as unknown as Record<string, unknown>,
    messages,
  })

  const content = completion.choices[0]?.message?.content
  if (!content) {
    throw new Error('AI response did not include any content')
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(content)
  } catch (_error) {
    throw new Error('Failed to parse AI response')
  }

  const suggestedScore = clampNumber(parsed.suggestedScore, 0, input.maxPoints)
  const maxScore = clampNumber(parsed.maxScore ?? input.maxPoints, 0, input.maxPoints)

  return {
    suggestedScore,
    maxScore,
    summary: parsed.summary || 'No summary provided.',
    strengths: parsed.strengths || '',
    gaps: parsed.gaps || '',
    rubricAlignment: parsed.rubricAlignment || '',
    rawResponse: completion,
  }
}

function clampNumber(value: number, min: number, max: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return min
  }
  return Math.min(Math.max(value, min), max)
}


