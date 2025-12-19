import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOpenAIClient } from '@/lib/ai'

const SYSTEM_PROMPT = `You are an AI assistant specialized in Science Olympiad, a national STEM competition for middle school and high school students in the United States. You can ONLY provide information and assistance related to Science Olympiad topics.

Your areas of expertise include:
- All Science Olympiad events (both Division B and Division C)
- Event rules, formats, and strategies
- Study tips and resources for specific events
- Science concepts covered in Science Olympiad events (anatomy, astronomy, chemistry, physics, earth science, biology, engineering, etc.)
- Competition logistics and tournament preparation
- Building events tips and techniques
- Test-taking strategies for Science Olympiad

If a user asks about something unrelated to Science Olympiad or the scientific concepts covered in Science Olympiad events, politely decline and redirect them to ask about Science Olympiad topics instead.

Be helpful, accurate, and encouraging. Remember that Science Olympiad participants range from middle school to high school students, so adjust your explanations accordingly.

When answering questions about specific events, try to reference the current year's rules when relevant, but note that rules change yearly and users should always verify with the official Science Olympiad rules.`

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const openai = getOpenAIClient()
    if (!openai) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 })
    }

    const body = await request.json()
    const { messages } = body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 })
    }

    // Limit conversation history to prevent token overflow
    const recentMessages = messages.slice(-10)

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...recentMessages,
      ],
      max_tokens: 1000,
      temperature: 0.7,
    })

    const response = completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response. Please try again.'

    return NextResponse.json({ message: response })
  } catch (error) {
    console.error('Error in AI chat:', error)
    return NextResponse.json({ error: 'Failed to process chat request' }, { status: 500 })
  }
}

