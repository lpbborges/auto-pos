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
      │ POST /api/chat { message, conversationHistory }
      ▼
[/api/chat/+server.ts]
      │ 1. Authenticate user, extract storeId from session
      │ 2. Build system prompt (static how-to knowledge)
      │ 3. Call AI with tool definitions
      ▼
[AI Model (Claude default / OpenAI swappable)]
      │ Decides whether to call tools based on user message
      │ May call: get_products, get_low_stock_items,
      │           get_recent_sales, get_stock_movements
      ▼
[Tool executor — server-side, scoped to storeId]
      │ Queries Supabase, returns structured data
      ▼
[AI Model] → streams final answer back
      ▼
[AssistantView.svelte] renders streamed tokens
```

---

## New Files

| File                                      | Purpose                                           |
| ----------------------------------------- | ------------------------------------------------- |
| `src/routes/api/chat/+server.ts`          | API route: auth, prompt, tool dispatch, streaming |
| `src/lib/ai/tools.ts`                     | Tool definitions (schema + Supabase executors)    |
| `src/lib/ai/system-prompt.ts`             | Static how-to knowledge about the app             |
| `src/lib/components/AssistantView.svelte` | Chat UI — 4th tab in bottom nav                   |

### Modified Files

| File                                  | Change                                                           |
| ------------------------------------- | ---------------------------------------------------------------- |
| `src/lib/components/BottomNav.svelte` | Add "Help" tab (4th item)                                        |
| `src/routes/+page.svelte`             | Add `activeTab === 'assistant'` branch rendering `AssistantView` |
| `src/lib/components/index.ts`         | Export `AssistantView`                                           |
| `.env.example`                        | Add `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`         |

---

## UI: AssistantView

- **Layout:** Full-screen tab with a scrollable message list and a pinned input area above the bottom nav
- **Messages:** Alternating user (right-aligned) and assistant (left-aligned) bubbles
- **Streaming:** Assistant response renders token-by-token via `ReadableStream`
- **Loading state:** "Thinking..." indicator while awaiting AI response or tool results
- **Error state:** Inline error message on API failure, with a retry option
- **Session:** Conversation array lives in component state — clears when navigating away from the tab

---

## Tools

Four tools are registered in `src/lib/ai/tools.ts`. Each has a JSON schema description (for the AI) and a server-side executor (for Supabase queries).

| Tool                  | Description given to AI                                                    | Supabase query                                       |
| --------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------- |
| `get_products`        | Returns all active products in the store with name, price, stock, and unit | `products` where `storeId = X AND deletedAt IS NULL` |
| `get_low_stock_items` | Returns products with stock below a given threshold (default: 5)           | same table, filtered by `stock < threshold`          |
| `get_recent_sales`    | Returns sales from the past N days with totals and payment methods         | `sales` scoped by date range                         |
| `get_stock_movements` | Returns stock movement history (ins and outs) for the store                | `stock_movements` joined with product name           |

All executors receive `storeId` from the authenticated session. Users can only access their own store's data.

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

Swapping providers requires changing only the env vars and one conditional in `+server.ts` that adapts the tool schema format (Claude uses `input_schema`, OpenAI uses `parameters`). The rest of the route — auth, tool dispatch, streaming — is provider-agnostic.

---

## Data Flow: Tool Use Sequence

```
User: "Which items have low stock?"

1. API route sends message + tool definitions to AI
2. AI responds with a tool call: get_low_stock_items({ threshold: 5 })
3. Server executes Supabase query, returns [{ name: "Arroz", stock: 2 }, ...]
4. Server sends tool result back to AI
5. AI generates final answer: "These items are running low: Arroz (2 units)..."
6. Response streamed to AssistantView
```

```
User: "How do I process a sale?"

1. API route sends message + tool definitions to AI
2. AI answers directly from system prompt knowledge — no tool call
3. Response streamed to AssistantView
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
