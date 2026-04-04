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
2. Resolves the store's `store_id` from `store_memberships` using the provided `storeId` parameter (already passed to all tool executions)
3. Inserts a row into the `products` table
4. If `stock > 0`, inserts a `stock_movements` row with `type: 'in'`, `reason: 'Estoque inicial'`
5. Returns the created product on success, or an error object on failure

This mirrors the logic already in the `createProduct` form action in `src/routes/+page.server.ts`.

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
