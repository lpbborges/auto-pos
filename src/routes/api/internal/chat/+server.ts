import { AI_BASE_URL, AI_MODEL, AI_API_KEY } from '$env/static/private'
import OpenAI from 'openai'
import type { RequestEvent } from '@sveltejs/kit'
import { getSystemPrompt } from '$lib/ai/system-prompt'
import { getToolDefinitions, executeToolCall } from '$lib/ai/tools'

// Simple in-memory rate limiter: 20 requests per 60 seconds per user
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60_000

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

const MAX_HISTORY = 10
const MAX_TOOL_ITERATIONS = 5

type ConversationMessage = { role: 'user' | 'assistant'; content: string }

export async function POST(event: RequestEvent) {
  const { user } = await event.locals.safeGetSession()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!checkRateLimit(user.id)) {
    return new Response('Too Many Requests', { status: 429 })
  }

  const { data: membership } = await event.locals.supabase
    .from('store_memberships')
    .select('store_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return new Response('Forbidden', { status: 403 })
  }

  const storeId: string = membership.store_id
  let message: string
  let conversationHistory: ConversationMessage[]

  try {
    const body = await event.request.json()
    message = String(body.message ?? '')
    conversationHistory = Array.isArray(body.conversationHistory)
      ? body.conversationHistory
          .filter(
            (m: unknown) =>
              m !== null &&
              typeof m === 'object' &&
              ((m as Record<string, unknown>).role === 'user' ||
                (m as Record<string, unknown>).role === 'assistant') &&
              typeof (m as Record<string, unknown>).content === 'string' &&
              ((m as Record<string, unknown>).content as string).trim().length >
                0,
          )
          .slice(-MAX_HISTORY)
      : []
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  if (!message.trim() || message.length > 2000) {
    return new Response('Bad Request', { status: 400 })
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: getSystemPrompt() },
    ...conversationHistory.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: message },
  ]

  const client = new OpenAI({
    baseURL: AI_BASE_URL,
    apiKey: AI_API_KEY,
  })

  const tools = getToolDefinitions()
  const model = AI_MODEL

  try {
    let response = await client.chat.completions.create({
      model,
      messages,
      tools,
    })

    let iterations = 0
    while (
      response.choices[0].finish_reason === 'tool_calls' &&
      iterations < MAX_TOOL_ITERATIONS
    ) {
      iterations++

      const assistantMessage = response.choices[0].message
      messages.push(assistantMessage)

      const toolCalls = assistantMessage.tool_calls ?? []

      for (const toolCall of toolCalls) {
        if (toolCall.type !== 'function') continue

        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(toolCall.function.arguments)
        } catch {
          // malformed args — proceed with empty input, executor has defaults
        }

        const result = await executeToolCall(
          toolCall.function.name,
          args,
          storeId,
          event.locals.supabase,
        )

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        })
      }

      response = await client.chat.completions.create({
        model,
        messages,
        tools,
      })
    }

    if (
      iterations >= MAX_TOOL_ITERATIONS &&
      response.choices[0].finish_reason === 'tool_calls'
    ) {
      return new Response('Assistant failed to produce a response', {
        status: 500,
      })
    }

    const streamResponse = await client.chat.completions.create({
      model,
      messages,
      stream: true,
    })

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamResponse) {
            const content = chunk.choices[0]?.delta?.content
            if (content) {
              controller.enqueue(encoder.encode(content))
            }
          }
        } catch (err) {
          console.error('[chat] Streaming error:', err)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain' },
    })
  } catch (err) {
    console.error('[chat] Error:', err)
    return new Response('Internal Server Error', { status: 500 })
  }
}
