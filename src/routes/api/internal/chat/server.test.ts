import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './+server'
import { createMockLocals, createMockCookies } from '$lib/test-utils/factories'

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn().mockResolvedValue({
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: 'Here is how you add a product...' }],
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function MockAnthropic(_opts: any) {
    return { messages: { create: mockCreate } }
  }
  return { default: MockAnthropic }
})

// Mock env
vi.mock('$env/static/private', () => ({
  ANTHROPIC_API_KEY: 'test-key',
  AI_PROVIDER: 'claude',
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
  })

  it('returns 401 when user is not authenticated', async () => {
    const locals = createMockLocals()
    locals.safeGetSession = vi
      .fn()
      .mockResolvedValue({ session: null, user: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = createRequestEvent({ message: 'hello' }, locals) as any
    const response = await POST(event)

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = createRequestEvent({ message: 'hello' }, locals) as any
    const response = await POST(event)

    expect(response.status).toBe(403)
  })

  it('returns 200 with a streamed text response for valid request', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = createRequestEvent({
      message: 'How do I add a product?',
      conversationHistory: [],
    }) as any
    const response = await POST(event)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/plain')
  })

  it('accepts conversationHistory up to 10 messages', async () => {
    const history = Array.from({ length: 15 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `message ${i}`,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = createRequestEvent({
      message: 'test',
      conversationHistory: history,
    }) as any
    const response = await POST(event)

    // Should not fail — history is capped server-side
    expect(response.status).toBe(200)
  })
})
