import { OLLAMA_BASE_URL, OLLAMA_MODEL } from '$env/static/private'
import OpenAI from 'openai'
import type { RequestEvent } from '@sveltejs/kit'
import { getSystemPrompt } from '$lib/ai/system-prompt'
import { getToolDefinitions, executeToolCall } from '$lib/ai/tools'

const MAX_HISTORY = 10
const MAX_TOOL_ITERATIONS = 5

type ConversationMessage = { role: 'user' | 'assistant'; content: string }

export async function POST(event: RequestEvent) {
  // 1. Verify user via safeGetSession (validates JWT server-side)
  const { user } = await event.locals.safeGetSession()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // 2. Resolve store_id from store_memberships
  const { data: membership } = await event.locals.supabase
    .from('store_memberships')
    .select('store_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return new Response('Forbidden', { status: 403 })
  }

  const storeId: string = membership.store_id

  // 3. Parse request body
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

  // 4. Build messages for the model
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: getSystemPrompt() },
    ...conversationHistory.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: message },
  ]

  const client = new OpenAI({
    baseURL: OLLAMA_BASE_URL,
    apiKey: 'ollama',
  })

  const tools = getToolDefinitions()
  const model = OLLAMA_MODEL

  // 5. Tool-use loop (wrapped in error boundary)
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

    // 6. Stream final text back
    const finalText = response.choices[0].message.content ?? ''

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(finalText))
        controller.close()
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
