import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { message, eventName, context } = body

    if (!message || !eventName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if we have an API key for AI
    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      // Fallback response without AI
      return NextResponse.json({
        response: `I'm sorry, AI assistance is not currently configured. For help with ${eventName}, I recommend checking the Scioly.org wiki or the resources in the Tools tab.`,
      })
    }

    // Build context from previous messages
    const contextMessages = (context || []).map((msg: { role: string; content: string }) => ({
      role: msg.role,
      content: msg.content,
    }))

    const systemPrompt = `You are a helpful Science Olympiad study assistant specializing in the event "${eventName}". 

Your role is to:
1. Help students fact-check their notes and study materials
2. Explain concepts clearly and concisely
3. Provide accurate information that could be included in note sheets or binders
4. Answer questions about the event topic
5. Suggest relevant topics or information to include in notes

Keep your responses concise but informative - students often have limited space on their note sheets.
Always be accurate - Science Olympiad competitions require precise scientific knowledge.
If you're not certain about something, say so rather than guessing.`

    // Try OpenAI first
    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              ...contextMessages,
              { role: 'user', content: message },
            ],
            max_tokens: 500,
            temperature: 0.7,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          return NextResponse.json({
            response: data.choices[0]?.message?.content || 'Sorry, I could not generate a response.',
          })
        }
      } catch (error) {
        console.error('OpenAI API error:', error)
      }
    }

    // Try Anthropic as fallback
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 500,
            system: systemPrompt,
            messages: [
              ...contextMessages,
              { role: 'user', content: message },
            ],
          }),
        })

        if (response.ok) {
          const data = await response.json()
          return NextResponse.json({
            response: data.content[0]?.text || 'Sorry, I could not generate a response.',
          })
        }
      } catch (error) {
        console.error('Anthropic API error:', error)
      }
    }

    // If all AI attempts fail, return helpful fallback
    return NextResponse.json({
      response: `I apologize, but I'm unable to process your request at the moment. For help with ${eventName}, I recommend checking:
- Scioly.org Wiki for comprehensive event information
- OpenStax or CK-12 for free textbooks
- Khan Academy for video explanations
- The Science Olympiad Student Center forums for peer help`,
    })
  } catch (error) {
    console.error('Study assistant error:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}

