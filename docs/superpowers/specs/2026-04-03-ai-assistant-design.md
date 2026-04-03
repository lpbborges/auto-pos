# AI Assistant — Design Spec

**Date:** 2026-04-03
**Project:** Auto POS (SvelteKit + Supabase, mobile-first POS system)
**Status:** Approved

---

## Overview

An in-app AI assistant that helps users understand how to use Auto POS and answer questions about their own store data. It lives as a dedicated fourth tab ("Help") in the bottom navigation and starts fresh each session.

---

## Goals

- Let users ask natural-language questions about how to use the app ("how do I add a product?")
- Let users ask questions about their own live data ("which items have low stock?")
- Keep it simple: no chat history persistence, no user training, no complex RAG pipeline
- Keep the AI provider swappable with minimal code changes

---

## Non-Goals

- Persistent conversation history across sessions
- Proactive notifications or suggestions (the assistant only responds when asked)
- Taking actions on behalf of the user (read-only access to data)
- Multi-turn memory within a session beyond the current conversation

---

## Architecture

```
[AssistantView.svelte]
      │ POST /api/internal/chat { message, conversationHistory }
      ▼
[/api/internal/chat/+server.ts]
      │ 1. Check event.locals.user → 401 if null
      │ 2. Resolve store_id from store_memberships by user_id → 401 if none
      │ 3. Build system prompt (static how-to knowledge)
      │ 4. Enter tool-use loop with AI
      ▼
[AI Model (Claude default / OpenAI swappable)]
      │ May request tool calls; server executes and feeds results back
      │ Loop continues until AI produces a final text response
      ▼
[Tool executors — server-side, scoped to store_id]
      │ Use event.locals.supabase (user-scoped RLS client)
      │ On error: return { error: string } tool result → AI responds gracefully
      ▼
[+server.ts streams final text chunks as plain ReadableStream]
      │ Content-Type: text/plain (no SSE framing)
      ▼
[AssistantView.svelte] reads via fetch + response.body.getReader() + TextDecoder
```

---

## New Files

| File                                      | Purpose                                                        |
| ----------------------------------------- | -------------------------------------------------------------- |
| `src/routes/api/internal/chat/+server.ts` | API route: auth, store_id resolution, tool-use loop, streaming |
| `src/lib/ai/tools.ts`                     | Tool definitions (schema + Supabase executors)                 |
| `src/lib/ai/system-prompt.ts`             | Static how-to knowledge about the app                          |
| `src/lib/components/AssistantView.svelte` | Chat UI — 4th tab in bottom nav                                |

Note: `src/lib/ai/` is a new subdirectory that must be created.

### Modified Files

| File                                  | Change                                                                                                                                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/components/BottomNav.svelte` | Add `'assistant'` to the `activeTab` prop type union; add "Help" tab UI item                                                                                                                                      |
| `src/routes/+page.svelte`             | Add `'assistant'` to the `activeTab` state type; convert the bare `{:else}` (ProfileView) to `{:else if activeTab === 'profile'}`, then add `{:else if activeTab === 'assistant'}<AssistantView />{/if}` after it |
| `src/lib/components/index.ts`         | Export `AssistantView`                                                                                                                                                                                            |
| `.env.example`                        | Add `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`                                                                                                                                                          |

---

## UI: AssistantView

- **Layout:** Full-screen tab with a scrollable message list and a pinned input area above the bottom nav
- **Messages:** Alternating user (right-aligned) and assistant (left-aligned) bubbles
- **Streaming:** The client calls `fetch('/api/internal/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(...) })`, then reads `response.body.getReader()` in a loop, decoding each chunk with `TextDecoder` and appending to the current assistant message in `$state`.
- **Wire format:** The server returns `Content-Type: text/plain`. Each chunk is a raw UTF-8 string fragment. No SSE `data:` framing.
- **Loading state:** "Thinking..." indicator while awaiting AI response or tool results
- **Error state:** Inline error message on API failure, with a retry option
- **Session:** `messages` array lives in component `$state` — clears when navigating away from the tab

### conversationHistory shape

The client sends up to the last 10 messages as history (to cap token costs):

```ts
type ConversationMessage = { role: 'user' | 'assistant'; content: string }
// POST body:
{ message: string; conversationHistory: ConversationMessage[] }
```

The server normalizes this format for the target provider (Claude and OpenAI both accept this shape with minor differences handled by the provider adapter).

---

## Authentication & storeId Resolution

`/api/internal/*` routes bypass the redirect-to-login guard in `hooks.server.ts` (all `/api/*` paths are treated as public). The chat route must therefore perform its own auth checks explicitly.

**Important:** Do not read `event.locals.user` directly — it is populated from `getSession()` which does not revalidate the JWT server-side. Use `event.locals.safeGetSession()` instead, which calls `getUser()` and returns a verified user:

```ts
// 1. Verify user via safeGetSession (validates JWT with Supabase server)
const { user } = await event.locals.safeGetSession()
if (!user) return new Response('Unauthorized', { status: 401 })

// 2. Resolve store_id (using cookie-based user-scoped Supabase client)
const { data: membership } = await event.locals.supabase
  .from('store_memberships')
  .select('store_id')
  .eq('user_id', user.id)
  .single()

if (!membership) return new Response('Forbidden', { status: 403 })
const storeId = membership.store_id
```

Note: the `PRIVATE_INTERNAL_API_KEY` env var exists for machine-to-machine calls (e.g., registration). The chat route is user-facing and uses session cookies for auth — it does **not** use that key.

---

## Tool-Use Loop

The AI call is a loop, not a single request, because the model may chain multiple tool calls:

```
1. Send: system prompt + conversationHistory + user message + tool definitions
2. Receive AI response:
   a. If response contains tool calls → execute each tool → send results back to AI → go to step 2
   b. If response is a final text message → stream it to the client → done
```

Termination: when the AI returns a text response with no tool calls. **Maximum iterations: 5.** If the loop exceeds 5 rounds without a final text response, return a 500 error to the client ("Assistant failed to produce a response"). In practice, one round is expected for data queries.

**AI stream error handling:** If the upstream AI provider stream errors mid-response (network drop, rate limit, etc.), the server closes the `ReadableStream` with an error. The client detects this when `reader.read()` returns `done: true` earlier than expected or throws, and shows an inline error message with a retry option.

---

## Tools

Four tools are registered in `src/lib/ai/tools.ts`. Each has a JSON schema description (for the AI) and a server-side executor using `event.locals.supabase` scoped to `store_id`.

| Tool                  | Description given to AI                                          | Supabase query                                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_products`        | Returns all active products with name, price, stock, and unit    | `products` — `.select('name, price, stock, unit').is('deleted_at', null).eq('store_id', storeId).order('name')`                                                         |
| `get_low_stock_items` | Returns products with stock below a threshold (default: 5)       | same table + `.lte('stock', threshold).order('stock')`                                                                                                                  |
| `get_recent_sales`    | Returns sales from the past N days with total and payment method | `sales` — `.select('id, total, payment_method, created_at').eq('store_id', storeId).gte('created_at', cutoff).order('created_at', { ascending: false })`                |
| `get_stock_movements` | Returns stock movement history with product names                | `stock_movements` — `.select('type, quantity, reason, created_at, product:products(name)').eq('store_id', storeId).order('created_at', { ascending: false }).limit(50)` |

**Error handling:** If a Supabase query fails, the executor returns `{ error: "Could not retrieve data" }` as the tool result. The AI receives this and responds gracefully ("I wasn't able to fetch that data right now"). The stream does not abort.

To add a new tool: add an entry to `tools.ts` with its schema and executor. No other files need to change.

---

## System Prompt

Defined in `src/lib/ai/system-prompt.ts`. Static string covering:

- Role: "You are a helpful assistant for Auto POS, a mobile point-of-sale system."
- App features: inventory management, sales/cart flow, stock movements, payment methods (cash, PIX, debit, credit)
- Tone guidelines: concise, practical, mobile-friendly — short answers, no walls of text
- Data instruction: use the provided tools when the user asks about their specific store data; answer from general knowledge otherwise

---

## Provider Abstraction

The API route supports two providers via environment variable:

```
AI_PROVIDER=claude      # default
ANTHROPIC_API_KEY=sk-...

# or:
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

Swapping providers requires changing only the env vars and one conditional in `+server.ts` that adapts the tool schema format (Claude uses `input_schema`, OpenAI uses `parameters`) and message format. The auth, storeId resolution, tool dispatch, and streaming logic is provider-agnostic.

**npm packages to install:**

- Claude: `@anthropic-ai/sdk`
- OpenAI: `openai`

Install whichever matches `AI_PROVIDER`.

---

## Data Flow Examples

```
User: "Which items have low stock?"

1. Auth + storeId resolution
2. Enter tool-use loop: send message + tools to AI
3. AI responds with tool call: get_low_stock_items({ threshold: 5 })
4. Server queries: products where store_id=X AND stock <= 5
5. Returns [{ name: "Arroz", stock: 2 }, ...] to AI
6. AI produces final text → streamed to AssistantView
```

```
User: "How do I process a sale?"

1. Auth + storeId resolution
2. Enter tool-use loop: send message + tools to AI
3. AI answers from system prompt knowledge — no tool call
4. Final text streamed immediately to AssistantView
```

---

## Environment Variables

```env
# Add to .env and .env.example
AI_PROVIDER=claude
ANTHROPIC_API_KEY=your_key_here
# OPENAI_API_KEY=your_key_here  # uncomment if using OpenAI
```

---

## Out of Scope for This Iteration

- Conversation history persistence (localStorage or DB)
- Voice input
- Proactive suggestions or alerts
- Admin/analytics queries beyond the four defined tools
