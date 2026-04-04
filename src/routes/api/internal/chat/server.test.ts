/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './+server'
import { createMockLocals, createMockCookies } from '$lib/test-utils/factories'

// Hoist mockCreate so it is available inside the vi.mock factory (which is hoisted by vitest)
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn().mockResolvedValue({
    choices: [
      {
        finish_reason: 'stop',
        message: {
          content: 'Here is how you add a product...',
          tool_calls: null,
        },
      },
    ],
  }),
}))

// Mock the OpenAI SDK
vi.mock('openai', () => {
  function MockOpenAI() {
    return { chat: { completions: { create: mockCreate } } }
  }
  return { default: MockOpenAI }
})

// Mock env
vi.mock('$env/static/private', () => ({
  AI_BASE_URL: 'https://api.groq.com/openai/v1/',
  AI_MODEL: 'llama-3.3-70b-versatile',
  AI_API_KEY: 'dummy-key',
}))

function createRequestEvent(body: object, localsOverride?: object) {
  const locals = { ...(localsOverride ?? createMockLocals()) }
  return {
    request: new Request('http://localhost/api/internal/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    locals,
    cookies: createMockCookies(),
  }
}

describe('POST /api/internal/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: 'Here is how you add a product...',
            tool_calls: null,
          },
        },
      ],
    })
  })

  it('returns 401 when user is not authenticated', async () => {
    const locals = createMockLocals()
    locals.safeGetSession = vi
      .fn()
      .mockResolvedValue({ session: null, user: null })

    const event = createRequestEvent({ message: 'hello' }, locals)
    const response = await POST(event as unknown as Parameters<typeof POST>[0])

    expect(response.status).toBe(401)
  })

  it('returns 403 when user has no store membership', async () => {
    const locals = createMockLocals()
    // Override supabase to return no membership
    locals.supabase.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'Not found' } }),
    })

    const event = createRequestEvent({ message: 'hello' }, locals)
    const response = await POST(event as unknown as Parameters<typeof POST>[0])

    expect(response.status).toBe(403)
  })

  it('returns 400 when message is empty', async () => {
    const event = createRequestEvent({
      message: '',
      conversationHistory: [],
    })
    const response = await POST(event as unknown as Parameters<typeof POST>[0])
    expect(response.status).toBe(400)
  })

  it('returns 200 with a streamed text response for valid request', async () => {
    const event = createRequestEvent({
      message: 'How do I add a product?',
      conversationHistory: [],
    })
    const response = await POST(event as unknown as Parameters<typeof POST>[0])

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/plain')
  })

  it('caps conversationHistory to 10 messages before forwarding to model', async () => {
    const history = Array.from({ length: 15 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `message ${i}`,
    }))

    const event = createRequestEvent({
      message: 'test',
      conversationHistory: history,
    }) as any
    const response = await POST(event)

    expect(response.status).toBe(200)
    // The messages array sent to the model must be at most 12 (system + 10 history + 1 new message)
    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.messages.length).toBeLessThanOrEqual(12)
  })
})
