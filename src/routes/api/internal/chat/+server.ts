import { ANTHROPIC_API_KEY } from '$env/static/private'
import Anthropic from '@anthropic-ai/sdk'
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

  if (!message.trim()) {
    return new Response('Bad Request', { status: 400 })
  }

  // 4. Build messages for Claude
  const messages: Anthropic.Messages.MessageParam[] = [
    ...conversationHistory.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: message },
  ]

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  const tools = getToolDefinitions()

  // 5. Tool-use loop (wrapped in error boundary)
  try {
    let response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: getSystemPrompt(),
      tools,
      messages,
    })

    let iterations = 0
    while (
      response.stop_reason === 'tool_use' &&
      iterations < MAX_TOOL_ITERATIONS
    ) {
      iterations++

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
      )

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] =
        await Promise.all(
          toolUseBlocks.map(async (block) => {
            const result = await executeToolCall(
              block.name,
              block.input as Record<string, unknown>,
              storeId,
              event.locals.supabase,
            )
            return {
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: JSON.stringify(result),
            }
          }),
        )

      messages.push(
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      )

      response = await client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        system: getSystemPrompt(),
        tools,
        messages,
      })
    }

    if (
      iterations >= MAX_TOOL_ITERATIONS &&
      response.stop_reason === 'tool_use'
    ) {
      return new Response('Assistant failed to produce a response', {
        status: 500,
      })
    }

    // 6. Extract final text and stream it back
    const textBlock = response.content.find(
      (b): b is Anthropic.Messages.TextBlock => b.type === 'text',
    )
    const finalText = textBlock?.text ?? ''

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
  } catch {
    return new Response('Internal Server Error', { status: 500 })
  }
}
