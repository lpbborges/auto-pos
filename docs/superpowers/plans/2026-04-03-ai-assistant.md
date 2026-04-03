# AI Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated "Help" tab to Auto POS with an AI assistant that answers how-to questions and queries the user's live store data via tool use.

**Architecture:** A SvelteKit API route (`/api/internal/chat`) receives user messages, authenticates via `safeGetSession()`, resolves `store_id` from `store_memberships`, then runs a tool-use loop with the Claude API. The AI decides whether to call Supabase tools (`get_products`, `get_low_stock_items`, `get_recent_sales`, `get_stock_movements`) or answer directly. The final text is streamed back as a plain `ReadableStream`. A new `AssistantView.svelte` component renders the chat UI as the 4th tab.

**Tech Stack:** SvelteKit, Svelte 5, `@anthropic-ai/sdk`, Supabase (via `event.locals.supabase`), Vitest, `@testing-library/svelte`

**Spec:** `docs/superpowers/specs/2026-04-03-ai-assistant-design.md`

---

## File Map

### New files

| File                                          | Responsibility                                                    |
| --------------------------------------------- | ----------------------------------------------------------------- |
| `src/lib/ai/system-prompt.ts`                 | Exports `getSystemPrompt(): string` — static how-to knowledge     |
| `src/lib/ai/tools.ts`                         | Tool schemas (for Claude) + executor functions (Supabase queries) |
| `src/routes/api/internal/chat/+server.ts`     | POST handler: auth, storeId, tool-use loop, streaming             |
| `src/lib/components/AssistantView.svelte`     | Chat UI component — 4th tab                                       |
| `src/lib/ai/system-prompt.test.ts`            | Tests for system prompt content                                   |
| `src/lib/ai/tools.test.ts`                    | Tests for each tool executor                                      |
| `src/routes/api/internal/chat/server.test.ts` | Tests for API route (auth, error cases)                           |

### Modified files

| File                                  | Change                                                      |
| ------------------------------------- | ----------------------------------------------------------- |
| `src/lib/test-utils/factories.ts`     | Add `lte` and `limit` to mock Supabase query builder        |
| `src/lib/components/BottomNav.svelte` | Add `'assistant'` to type union, add "Ajuda" tab button     |
| `src/routes/+page.svelte`             | Add `'assistant'` to state type, add `AssistantView` branch |
| `src/lib/components/index.ts`         | Export `AssistantView`                                      |
| `.env.example`                        | Add `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`    |

---

## Task 1: Install AI SDK and update env config

**Files:**

- Modify: `.env.example`
- Modify: `package.json` (via pnpm)

- [ ] **Step 1: Install `@anthropic-ai/sdk`**

```bash
pnpm add @anthropic-ai/sdk
```

Expected: package added to `dependencies` in `package.json`.

- [ ] **Step 2: Add env vars to `.env.example`**

Add these lines to the end of `.env.example`:

```env
AI_PROVIDER=claude
ANTHROPIC_API_KEY=your-anthropic-api-key-here
# OPENAI_API_KEY=your-openai-api-key-here
```

Also add to your local `.env` (replace with a real key for manual testing):

```env
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 3: Commit**

```bash
git add .env.example package.json pnpm-lock.yaml
git commit -m "chore: install @anthropic-ai/sdk and add AI env vars"
```

---

## Task 2: Extend mock Supabase client with `lte` and `limit`

The existing mock in `src/lib/test-utils/factories.ts` is missing `lte` (needed for low-stock queries) and `limit` (needed for stock movement queries). Add them before writing tool tests.

**Files:**

- Modify: `src/lib/test-utils/factories.ts`

- [ ] **Step 1: Add `lte` to the query builder in `createMockSupabaseClient`**

In `src/lib/test-utils/factories.ts`, inside the `builder` object (after the `gte` mock at line ~97), add:

```typescript
// lte() adds filter
lte: vi.fn((column: string, value: any) => {
  filters.push((record) => record[column] <= value)
  return builder
}),

// limit() limits results
limit: vi.fn((n: number) => {
  currentData.splice(n)
  return builder
}),
```

- [ ] **Step 2: Run existing tests to confirm nothing broke**

```bash
pnpm test
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/test-utils/factories.ts
git commit -m "test: add lte and limit to mock Supabase query builder"
```

---

## Task 3: System prompt

**Files:**

- Create: `src/lib/ai/system-prompt.ts`
- Create: `src/lib/ai/system-prompt.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/ai/system-prompt.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getSystemPrompt } from './system-prompt'

describe('getSystemPrompt', () => {
  it('returns a non-empty string', () => {
    expect(typeof getSystemPrompt()).toBe('string')
    expect(getSystemPrompt().length).toBeGreaterThan(100)
  })

  it('includes the app name', () => {
    expect(getSystemPrompt()).toContain('Auto POS')
  })

  it('mentions key features', () => {
    const prompt = getSystemPrompt()
    expect(prompt).toContain('inventory')
    expect(prompt).toContain('sales')
    expect(prompt).toContain('stock')
  })

  it('instructs the AI to use tools for live data', () => {
    expect(getSystemPrompt()).toContain('tool')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/lib/ai/system-prompt.test.ts
```

Expected: FAIL — `Cannot find module './system-prompt'`

- [ ] **Step 3: Create `src/lib/ai/system-prompt.ts`**

```typescript
export function getSystemPrompt(): string {
  return `You are a helpful assistant for Auto POS, a mobile-first point-of-sale system used by small store owners.

## App Features

**Inventory (Produtos tab):**
- Add products with name, price, stock quantity, and unit (kg, g, lt, und)
- Edit or delete products using the action buttons on each product card
- Track stock: the stock number shows current available units
- Use the stock movement button to record manual stock entries or exits

**Sales (Vendas tab):**
- Tap a product to add it to the cart
- Adjust quantities in the cart by tapping + or −
- Choose a payment method: Dinheiro (cash), PIX, Débito (debit), or Crédito (credit)
- Tap "Finalizar venda" to complete the sale — stock is updated automatically

**Stock Movements:**
- Record "entrada" (stock in) when receiving new inventory
- Record "saída" (stock out) for losses, adjustments, or corrections
- Sales automatically create stock out movements

**Profile (Perfil tab):**
- Shows the store name and logged-in user
- Use the logout button to sign out

## How to Answer

- Keep answers short and direct — users are on mobile
- Use bullet points for multi-step instructions
- When the user asks about their specific data (products, sales, stock levels), use the available tools to fetch accurate information
- When the user asks how to do something in the app, answer from your knowledge above — no tool call needed
- If you cannot retrieve data, say so honestly and suggest they check the app directly`
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/lib/ai/system-prompt.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/system-prompt.ts src/lib/ai/system-prompt.test.ts
git commit -m "feat: add AI system prompt"
```

---

## Task 4: Tool definitions and executors

**Files:**

- Create: `src/lib/ai/tools.ts`
- Create: `src/lib/ai/tools.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/ai/tools.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getToolDefinitions, executeToolCall } from './tools'
import { createMockSupabaseClient } from '$lib/test-utils/factories'

describe('getToolDefinitions', () => {
  it('returns an array of 4 tools', () => {
    const tools = getToolDefinitions()
    expect(tools).toHaveLength(4)
  })

  it('includes get_products tool', () => {
    const tools = getToolDefinitions()
    expect(tools.some((t) => t.name === 'get_products')).toBe(true)
  })

  it('includes get_low_stock_items tool', () => {
    const tools = getToolDefinitions()
    expect(tools.some((t) => t.name === 'get_low_stock_items')).toBe(true)
  })

  it('includes get_recent_sales tool', () => {
    const tools = getToolDefinitions()
    expect(tools.some((t) => t.name === 'get_recent_sales')).toBe(true)
  })

  it('includes get_stock_movements tool', () => {
    const tools = getToolDefinitions()
    expect(tools.some((t) => t.name === 'get_stock_movements')).toBe(true)
  })
})

describe('executeToolCall', () => {
  let supabase: ReturnType<typeof createMockSupabaseClient>
  const storeId = 'store-1'

  beforeEach(() => {
    supabase = createMockSupabaseClient()
    vi.clearAllMocks()
  })

  describe('get_products', () => {
    it('queries products table with store_id filter', async () => {
      await executeToolCall('get_products', {}, storeId, supabase)
      expect(supabase.from).toHaveBeenCalledWith('products')
    })

    it('returns error object on Supabase failure', async () => {
      supabase.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn(() =>
          Promise.resolve({ data: null, error: { message: 'DB error' } }),
        ),
      }))
      const result = await executeToolCall(
        'get_products',
        {},
        storeId,
        supabase,
      )
      expect(result).toHaveProperty('error')
    })
  })

  describe('get_low_stock_items', () => {
    it('queries products with stock threshold', async () => {
      await executeToolCall(
        'get_low_stock_items',
        { threshold: 5 },
        storeId,
        supabase,
      )
      expect(supabase.from).toHaveBeenCalledWith('products')
    })

    it('uses default threshold of 5 when not provided', async () => {
      // Should not throw even without threshold param
      await expect(
        executeToolCall('get_low_stock_items', {}, storeId, supabase),
      ).resolves.not.toThrow()
    })
  })

  describe('get_recent_sales', () => {
    it('queries sales table with store_id filter', async () => {
      await executeToolCall('get_recent_sales', { days: 7 }, storeId, supabase)
      expect(supabase.from).toHaveBeenCalledWith('sales')
    })

    it('uses default of 7 days when not provided', async () => {
      await expect(
        executeToolCall('get_recent_sales', {}, storeId, supabase),
      ).resolves.not.toThrow()
    })
  })

  describe('get_stock_movements', () => {
    it('queries stock_movements table', async () => {
      await executeToolCall('get_stock_movements', {}, storeId, supabase)
      expect(supabase.from).toHaveBeenCalledWith('stock_movements')
    })
  })

  describe('unknown tool', () => {
    it('returns error for unknown tool name', async () => {
      const result = await executeToolCall(
        'unknown_tool',
        {},
        storeId,
        supabase,
      )
      expect(result).toHaveProperty('error')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/lib/ai/tools.test.ts
```

Expected: FAIL — `Cannot find module './tools'`

- [ ] **Step 3: Create `src/lib/ai/tools.ts`**

```typescript
import type { Tool } from '@anthropic-ai/sdk/resources'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

export function getToolDefinitions(): Tool[] {
  return [
    {
      name: 'get_products',
      description:
        'Returns all active products in the store with name, price, stock quantity, and unit. Use when the user asks about their inventory or product list.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'get_low_stock_items',
      description:
        'Returns products with stock below a threshold. Use when the user asks about low stock, what is running out, or what needs to be restocked.',
      input_schema: {
        type: 'object' as const,
        properties: {
          threshold: {
            type: 'number',
            description:
              'Stock level below which a product is considered low. Defaults to 5.',
          },
        },
        required: [],
      },
    },
    {
      name: 'get_recent_sales',
      description:
        'Returns sales from the past N days with total amount and payment method. Use when the user asks about sales history, revenue, or payment breakdown.',
      input_schema: {
        type: 'object' as const,
        properties: {
          days: {
            type: 'number',
            description: 'Number of past days to include. Defaults to 7.',
          },
        },
        required: [],
      },
    },
    {
      name: 'get_stock_movements',
      description:
        'Returns recent stock movement history (entries and exits) with product names. Use when the user asks about stock changes, what came in or out.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
  ]
}

export async function executeToolCall(
  toolName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>,
  storeId: string,
  supabase: SupabaseClient,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  try {
    switch (toolName) {
      case 'get_products': {
        const { data, error } = await supabase
          .from('products')
          .select('name, price, stock, unit')
          .is('deleted_at', null)
          .eq('store_id', storeId)
          .order('name')
        if (error) return { error: 'Could not retrieve products' }
        return data
      }

      case 'get_low_stock_items': {
        const threshold =
          typeof input.threshold === 'number' ? input.threshold : 5
        const { data, error } = await supabase
          .from('products')
          .select('name, price, stock, unit')
          .is('deleted_at', null)
          .eq('store_id', storeId)
          .lte('stock', threshold)
          .order('stock')
        if (error) return { error: 'Could not retrieve low stock items' }
        return data
      }

      case 'get_recent_sales': {
        const days = typeof input.days === 'number' ? input.days : 7
        const cutoff = new Date(
          Date.now() - days * 24 * 60 * 60 * 1000,
        ).toISOString()
        const { data, error } = await supabase
          .from('sales')
          .select('id, total, payment_method, created_at')
          .eq('store_id', storeId)
          .gte('created_at', cutoff)
          .order('created_at', { ascending: false })
        if (error) return { error: 'Could not retrieve recent sales' }
        return data
      }

      case 'get_stock_movements': {
        const { data, error } = await supabase
          .from('stock_movements')
          .select('type, quantity, reason, created_at, product:products(name)')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
          .limit(50)
        if (error) return { error: 'Could not retrieve stock movements' }
        return data
      }

      default:
        return { error: `Unknown tool: ${toolName}` }
    }
  } catch {
    return { error: 'Tool execution failed' }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/lib/ai/tools.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/tools.ts src/lib/ai/tools.test.ts
git commit -m "feat: add AI tool definitions and Supabase executors"
```

---

## Task 5: API route

**Files:**

- Create: `src/routes/api/internal/chat/+server.ts`
- Create: `src/routes/api/internal/chat/server.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/routes/api/internal/chat/server.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './+server'
import { createMockLocals, createMockCookies } from '$lib/test-utils/factories'

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Here is how you add a product...' }],
      }),
    },
  })),
}))

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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/routes/api/internal/chat/server.test.ts
```

Expected: FAIL — `Cannot find module './+server'`

- [ ] **Step 3: Create `src/routes/api/internal/chat/+server.ts`**

```typescript
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
      ? body.conversationHistory.slice(-MAX_HISTORY)
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

  // 5. Tool-use loop
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

    // Collect all tool use blocks
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
    )

    // Execute all tool calls
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

    // Feed results back to Claude
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
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/routes/api/internal/chat/server.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/api/internal/chat/+server.ts src/routes/api/internal/chat/server.test.ts
git commit -m "feat: add AI chat API route with tool-use loop"
```

---

## Task 6: AssistantView component

**Files:**

- Create: `src/lib/components/AssistantView.svelte`

The component manages a local `messages` array in `$state`. It POSTs to `/api/internal/chat`, reads the response stream via `getReader()`, and appends tokens to the current assistant message.

- [ ] **Step 1: Create `src/lib/components/AssistantView.svelte`**

```svelte
<script lang="ts">
  import { Send, Bot } from 'lucide-svelte'
  import { cn } from '$lib/utils'

  type Message = { role: 'user' | 'assistant'; content: string }

  let messages = $state<Message[]>([])
  let input = $state('')
  let isLoading = $state(false)
  let error = $state<string | null>(null)
  let messagesEnd = $state<HTMLDivElement | null>(null)

  function scrollToBottom() {
    messagesEnd?.scrollIntoView({ behavior: 'smooth' })
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || isLoading) return

    input = ''
    error = null
    messages = [...messages, { role: 'user', content: text }]

    // Add empty assistant message to fill in via streaming
    messages = [...messages, { role: 'assistant', content: '' }]
    isLoading = true

    try {
      const history = messages.slice(0, -1) // exclude the empty assistant message

      const response = await fetch('/api/internal/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationHistory: history.slice(0, -1), // exclude the user message we just added
        }),
      })

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        messages = messages.map((m, i) =>
          i === messages.length - 1 ? { ...m, content: m.content + chunk } : m,
        )
        scrollToBottom()
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Something went wrong'
      // Remove the empty assistant message on error
      messages = messages.slice(0, -1)
    } finally {
      isLoading = false
      scrollToBottom()
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }
</script>

<div class="flex h-screen flex-col pb-16">
  <!-- Header -->
  <div class="border-b border-border bg-card px-4 py-3">
    <div class="mx-auto flex max-w-lg items-center gap-2">
      <Bot class="h-5 w-5 text-primary" />
      <h1 class="font-semibold">Assistente</h1>
    </div>
  </div>

  <!-- Message list -->
  <div class="flex-1 overflow-y-auto px-4 py-4">
    <div class="mx-auto max-w-lg space-y-4">
      {#if messages.length === 0}
        <div class="py-12 text-center text-muted-foreground">
          <Bot class="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p class="text-sm">Como posso te ajudar?</p>
          <p class="mt-1 text-xs opacity-70">
            Pergunte sobre como usar o app ou sobre os dados da sua loja.
          </p>
        </div>
      {/if}

      {#each messages as msg}
        <div
          class={cn(
            'flex',
            msg.role === 'user' ? 'justify-end' : 'justify-start',
          )}
        >
          <div
            class={cn(
              'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground',
            )}
          >
            {#if msg.role === 'assistant' && msg.content === '' && isLoading}
              <span class="text-muted-foreground">Pensando...</span>
            {:else}
              <p class="whitespace-pre-wrap">{msg.content}</p>
            {/if}
          </div>
        </div>
      {/each}

      {#if error}
        <div
          class="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
          <button onclick={() => (error = null)} class="ml-2 underline">
            Fechar
          </button>
        </div>
      {/if}

      <div bind:this={messagesEnd}></div>
    </div>
  </div>

  <!-- Input area -->
  <div class="border-t border-border bg-card px-4 py-3 pb-20">
    <div class="mx-auto flex max-w-lg gap-2">
      <textarea
        bind:value={input}
        onkeydown={handleKeydown}
        placeholder="Pergunte algo..."
        rows={1}
        disabled={isLoading}
        class="flex-1 resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
      ></textarea>
      <button
        onclick={sendMessage}
        disabled={isLoading || !input.trim()}
        class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
        aria-label="Enviar"
      >
        <Send class="h-4 w-4" />
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Type-check the component**

```bash
pnpm check
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/AssistantView.svelte
git commit -m "feat: add AssistantView chat UI component"
```

---

## Task 7: Wire up navigation

Connect `AssistantView` to the bottom nav and the main page.

**Files:**

- Modify: `src/lib/components/BottomNav.svelte`
- Modify: `src/routes/+page.svelte`
- Modify: `src/lib/components/index.ts`

- [ ] **Step 1: Export `AssistantView` from the component index**

In `src/lib/components/index.ts`, add:

```typescript
export { default as AssistantView } from './AssistantView.svelte'
```

- [ ] **Step 2: Update `BottomNav.svelte`**

Replace the entire file content with the updated version that adds the `'assistant'` tab:

```svelte
<script lang="ts">
  import { Package, ShoppingCart, User, HelpCircle } from 'lucide-svelte'
  import { cn } from '$lib/utils'

  interface Props {
    activeTab: 'inventory' | 'sales' | 'profile' | 'assistant'
    ontabchange: (tab: 'inventory' | 'sales' | 'profile' | 'assistant') => void
  }

  let { activeTab, ontabchange }: Props = $props()
</script>

<nav
  class="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm"
>
  <div class="mx-auto flex max-w-lg items-center justify-around px-4 py-2">
    <button
      onclick={() => ontabchange('inventory')}
      class={cn(
        'flex min-h-11 min-w-18 flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 transition-colors',
        activeTab === 'inventory'
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Package class="h-5 w-5" />
      <span class="text-xs font-medium">Produtos</span>
    </button>

    <button
      onclick={() => ontabchange('sales')}
      class={cn(
        'flex min-h-11 min-w-18 flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 transition-colors',
        activeTab === 'sales'
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <ShoppingCart class="h-5 w-5" />
      <span class="text-xs font-medium">Vendas</span>
    </button>

    <button
      onclick={() => ontabchange('profile')}
      class={cn(
        'flex min-h-11 min-w-18 flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 transition-colors',
        activeTab === 'profile'
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <User class="h-5 w-5" />
      <span class="text-xs font-medium">Perfil</span>
    </button>

    <button
      onclick={() => ontabchange('assistant')}
      class={cn(
        'flex min-h-11 min-w-18 flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 transition-colors',
        activeTab === 'assistant'
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <HelpCircle class="h-5 w-5" />
      <span class="text-xs font-medium">Ajuda</span>
    </button>
  </div>
</nav>
```

- [ ] **Step 3: Update `+page.svelte`**

Replace the file content to add the assistant tab branch:

```svelte
<script lang="ts">
  import {
    BottomNav,
    InventoryView,
    SalesView,
    ProfileView,
    AssistantView,
  } from '$lib/components'
  import { products } from '$lib/stores'
  import type { PageData } from './$types'

  interface Props {
    data: PageData
  }

  let { data }: Props = $props()

  $effect(() => {
    if (data.products) {
      products.set(data.products)
    }
  })

  let activeTab = $state<'inventory' | 'sales' | 'profile' | 'assistant'>(
    'inventory',
  )
</script>

<svelte:head>
  <title>Auto POS</title>
  <meta name="description" content="Point of Sale System" />
</svelte:head>

<div class="min-h-screen bg-background">
  {#if activeTab === 'inventory'}
    <InventoryView />
  {:else if activeTab === 'sales'}
    <SalesView />
  {:else if activeTab === 'assistant'}
    <AssistantView />
  {:else}
    <ProfileView user={data.user} store={data.store} />
  {/if}

  <BottomNav {activeTab} ontabchange={(tab) => (activeTab = tab)} />
</div>
```

- [ ] **Step 4: Type-check everything**

```bash
pnpm check
```

Expected: no type errors.

- [ ] **Step 5: Run full test suite**

```bash
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/index.ts src/lib/components/BottomNav.svelte src/routes/+page.svelte
git commit -m "feat: wire up AI assistant tab to bottom navigation"
```

---

## Task 8: Manual smoke test

With a real `ANTHROPIC_API_KEY` in your local `.env`:

- [ ] **Start the dev server**

```bash
pnpm dev
```

- [ ] **Test how-to question (no tool call expected)**
  1. Open the app, tap "Ajuda"
  2. Ask: "Como faço para adicionar um produto?"
  3. Expected: clear step-by-step answer without hitting Supabase

- [ ] **Test data question (tool call expected)**
  1. Ask: "Quais produtos estão com estoque baixo?"
  2. Expected: response lists actual products from your store with stock counts (or says none found)

- [ ] **Test unauthenticated access**
  1. Sign out, then try to call `POST /api/internal/chat` directly
  2. Expected: 401 response

- [ ] **Final commit (if any fixes needed from smoke test)**

```bash
git add -p
git commit -m "fix: <describe what was fixed>"
```
