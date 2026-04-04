# AI Assistant: Create Product Tool

**Date:** 2026-04-03  
**Status:** Approved

## Overview

Enable the AI assistant to create new products in the database via natural language conversation. The AI gathers required fields from the user, presents a confirmation summary, and only writes to the database after the user confirms.

## Scope

- New `create_product` tool in `src/lib/ai/tools.ts`
- Updated system prompt in `src/lib/ai/system-prompt.ts`
- No changes to the chat API route or frontend

## Tool Definition

Tool name: `create_product`

Parameters:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Product name |
| `price` | number | yes | Price in BRL |
| `unit` | enum: `kg`, `g`, `lt`, `und` | yes | Unit of measure |
| `stock` | number | no | Initial stock quantity (defaults to 0) |

## Tool Execution

The `create_product` case in `executeToolCall`:

1. Validates required fields (`name`, `price`, `unit`)
2. Uses `storeId` directly — it is already the resolved store ID passed to `executeToolCall`; no additional membership lookup needed
3. Inserts a row into the `products` table
4. If `stock > 0`, inserts a `stock_movements` row with:
   - `id: generateUUIDv7()` — import as `import { v7 as generateUUIDv7 } from 'uuid'` (the column has no default; same pattern as `+page.server.ts`)
   - `type: 'in'`
   - `reason: 'Estoque inicial'`
   - `unit_cost: 0` — the migration defines a CHECK constraint (`entry_must_have_cost`) requiring `unit_cost IS NOT NULL` for all `type = 'in'` rows; use `0` since purchase cost is unknown at AI-creation time. Note: the existing `createProduct` form action at `+page.server.ts` line 90 omits `unit_cost` and has the same constraint gap — that should be fixed separately as a follow-up.
5. Returns the created product on success, or an error object on failure

## Confirmation Gate

The confirmation step is enforced by the system prompt instruction only — there is no code-level guard preventing the tool from being called without user confirmation. This is an accepted trade-off given that Ollama models vary in instruction-following reliability. If a stricter guarantee is needed in the future, a client-side confirmation state could be added, but it is out of scope for this feature.

## System Prompt Changes

Add a new section to `getSystemPrompt()` describing how to handle product creation:

- Identify all required fields the user hasn't provided (name, price, unit) and ask for all of them at once in a single message
- Also ask for initial stock in the same message (optional)
- Once all required fields are known, present a Portuguese-language confirmation summary before calling the tool
  - Example: _"Vou criar: Arroz, R$ 5,00/kg, estoque inicial: 10 kg. Confirma?"_
- Only call `create_product` after the user explicitly confirms

## Data Flow

```
User: "add rice, R$5/kg"
AI:   "Qual o estoque inicial? (pode deixar 0)"
User: "10"
AI:   "Vou criar: Arroz, R$ 5,00/kg, estoque inicial: 10 kg. Confirma?"
User: "sim"
AI:   → calls create_product(name="Arroz", price=5.00, unit="kg", stock=10)
Tool: inserts product + stock_movement
AI:   "Produto Arroz criado com sucesso!"
```

## Error Handling

- If the tool returns an error, the AI reports it to the user in plain language
- No partial rollback needed — stock movement is only inserted if `stock > 0`, after the product insert succeeds

## Files Changed

- `src/lib/ai/tools.ts` — add tool definition + execution case
- `src/lib/ai/system-prompt.ts` — add product creation guidance
