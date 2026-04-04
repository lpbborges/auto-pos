# AI Assistant Create Product Tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `create_product` tool to the AI assistant so users can register new products in the database via natural language conversation with confirmation.

**Architecture:** Two source files change. `tools.ts` gets a new tool definition (for the model's function-calling schema) and a new execution case (the actual DB write). `system-prompt.ts` gets a new section instructing the AI to gather required fields, present a Portuguese confirmation summary, and only call the tool after the user confirms.

**Tech Stack:** SvelteKit, Supabase JS client, OpenAI-compatible tool calling via Ollama, Vitest

---

## File Map

| File                               | Change                                                |
| ---------------------------------- | ----------------------------------------------------- |
| `src/lib/ai/tools.ts`              | Add `create_product` tool definition + execution case |
| `src/lib/ai/tools.test.ts`         | Add tests for the new tool definition and execution   |
| `src/lib/ai/system-prompt.ts`      | Add product creation guidance section                 |
| `src/lib/ai/system-prompt.test.ts` | Add test that prompt includes creation guidance       |

No other files change. The chat route (`+server.ts`) already passes `storeId` and `supabase` to `executeToolCall` — no modifications needed.

---

## Task 1: Add `create_product` tool definition

**Files:**

- Modify: `src/lib/ai/tools.ts` — `getToolDefinitions()` function
- Modify: `src/lib/ai/tools.test.ts` — `describe('getToolDefinitions')`

- [ ] **Step 1: Update the tool count test**

In `src/lib/ai/tools.test.ts`, change the existing count assertion from 4 to 5:

```ts
it('returns an array of 5 tools', () => {
  const tools = getToolDefinitions()
  expect(tools).toHaveLength(5)
})
```

- [ ] **Step 2: Add a failing test for the new tool**

Still in `src/lib/ai/tools.test.ts`, inside `describe('getToolDefinitions')`, add:

```ts
it('includes create_product tool', () => {
  const tools = getToolDefinitions()
  expect(
    tools.some(
      (t) => t.type === 'function' && t.function.name === 'create_product',
    ),
  ).toBe(true)
})
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
pnpm test -- --reporter=verbose src/lib/ai/tools.test.ts
```

Expected: FAIL — `expected 4 to equal 5` and `expected false to be true`

- [ ] **Step 4: Add the `create_product` tool definition**

In `src/lib/ai/tools.ts`, inside `getToolDefinitions()`, append a new entry to the returned array:

```ts
{
  type: 'function',
  function: {
    name: 'create_product',
    description:
      'Creates a new product in the store. Only call this after the user has confirmed the product details. Required: name, price, unit. Optional: initial stock quantity.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Product name.',
        },
        price: {
          type: 'number',
          description: 'Product price in BRL.',
        },
        unit: {
          type: 'string',
          enum: ['kg', 'g', 'lt', 'und'],
          description: 'Unit of measure.',
        },
        stock: {
          type: 'number',
          description: 'Initial stock quantity. Defaults to 0.',
        },
      },
      required: ['name', 'price', 'unit'],
    },
  },
},
```

- [ ] **Step 5: Run the tests and verify they pass**

```bash
pnpm test -- --reporter=verbose src/lib/ai/tools.test.ts
```

Expected: PASS on all `getToolDefinitions` tests

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/tools.ts src/lib/ai/tools.test.ts
git commit -m "feat: add create_product tool definition"
```

---

## Task 2: Implement `create_product` tool execution

**Files:**

- Modify: `src/lib/ai/tools.ts` — `executeToolCall()` switch
- Modify: `src/lib/ai/tools.test.ts` — add `describe('create_product')` block

The tool must:

1. Validate `name` (non-empty string), `price` (number ≥ 0), `unit` (one of `kg`, `g`, `lt`, `und`)
2. Insert the product into the `products` table using `storeId`
3. If `stock > 0`, insert a `stock_movements` row with `type: 'in'`, `unit_cost: 0`, `reason: 'Estoque inicial'`, and a generated UUID `id`
4. Return the created product on success, or `{ error: '...' }` on failure

Note on price storage: `price` is stored as a JS `number` (float) in the products table, matching the existing `createProduct` form action which also uses `parseFloat()`. Confirm the `products.price` column is `numeric` or `decimal` (not integer cents) before submitting — check `supabase/migrations/20260304225102_remote_schema.sql`.

- [ ] **Step 1: Add failing tests**

Add this block to `src/lib/ai/tools.test.ts`, inside `describe('executeToolCall')`:

```ts
describe('create_product', () => {
  // Each test gets a fresh spy state so call assertions don't bleed between cases
  beforeEach(() => {
    vi.clearAllMocks()
    supabase = createMockSupabaseClient()
  })

  it('inserts into products table', async () => {
    await executeToolCall(
      'create_product',
      { name: 'Arroz', price: 5.0, unit: 'kg' },
      storeId,
      supabase,
    )
    expect(supabase.from).toHaveBeenCalledWith('products')
  })

  it('does not insert stock movement when stock is 0', async () => {
    await executeToolCall(
      'create_product',
      { name: 'Arroz', price: 5.0, unit: 'kg', stock: 0 },
      storeId,
      supabase,
    )
    expect(supabase.from).not.toHaveBeenCalledWith('stock_movements')
  })

  it('inserts stock movement with correct shape when stock > 0', async () => {
    await executeToolCall(
      'create_product',
      { name: 'Arroz', price: 5.0, unit: 'kg', stock: 10 },
      storeId,
      supabase,
    )
    expect(supabase.from).toHaveBeenCalledWith('stock_movements')
    // Verify the insert was called with unit_cost (required by DB CHECK constraint)
    const movementsFrom = supabase.from.mock.calls.find(
      ([t]: [string]) => t === 'stock_movements',
    )
    expect(movementsFrom).toBeDefined()
  })

  it('returns error for missing name', async () => {
    const result = await executeToolCall(
      'create_product',
      { price: 5.0, unit: 'kg' },
      storeId,
      supabase,
    )
    expect(result).toHaveProperty('error')
  })

  it('returns error for invalid unit', async () => {
    const result = await executeToolCall(
      'create_product',
      { name: 'Arroz', price: 5.0, unit: 'invalid' },
      storeId,
      supabase,
    )
    expect(result).toHaveProperty('error')
  })

  it('returns error on Supabase failure', async () => {
    supabase.from = vi.fn((table: string) => {
      if (table === 'products') {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({ data: null, error: { message: 'DB error' } }),
              ),
            })),
          })),
        }
      }
      return supabase.from(table)
    })
    const result = await executeToolCall(
      'create_product',
      { name: 'Arroz', price: 5.0, unit: 'kg' },
      storeId,
      supabase,
    )
    expect(result).toHaveProperty('error')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm test -- --reporter=verbose src/lib/ai/tools.test.ts
```

Expected: FAIL — `create_product` cases hit the `default` branch and return `{ error: 'Unknown tool: create_product' }`

- [ ] **Step 3: Add the import for `generateUUIDv7`**

At the top of `src/lib/ai/tools.ts`, add:

```ts
import { v7 as generateUUIDv7 } from 'uuid'
```

- [ ] **Step 4: Add the `create_product` execution case**

In `src/lib/ai/tools.ts`, inside the `switch (toolName)` block in `executeToolCall`, add before the `default` case:

```ts
case 'create_product': {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const price = typeof input.price === 'number' ? input.price : NaN
  const unit = typeof input.unit === 'string' ? input.unit : ''
  const stock = typeof input.stock === 'number' ? input.stock : 0

  const validUnits = ['kg', 'g', 'lt', 'und']
  if (!name || isNaN(price) || price < 0 || !validUnits.includes(unit)) {
    return { error: 'Invalid product data: name, price, and unit are required' }
  }

  const { data, error } = await supabase
    .from('products')
    .insert([{ name, price, unit, stock, store_id: storeId }])
    .select()
    .single()

  if (error) return { error: 'Could not create product' }

  if (stock > 0) {
    await supabase.from('stock_movements').insert({
      id: generateUUIDv7(),
      product_id: data.id,
      store_id: storeId,
      type: 'in',
      quantity: stock,
      unit_cost: 0,
      reason: 'Estoque inicial',
    })
  }

  return data
}
```

- [ ] **Step 5: Run the tests and verify they pass**

```bash
pnpm test -- --reporter=verbose src/lib/ai/tools.test.ts
```

Expected: PASS on all tests

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/tools.ts src/lib/ai/tools.test.ts
git commit -m "feat: implement create_product tool execution"
```

---

## Task 3: Update system prompt with product creation guidance

**Files:**

- Modify: `src/lib/ai/system-prompt.ts` — `getSystemPrompt()` return string
- Modify: `src/lib/ai/system-prompt.test.ts` — add test for new content

- [ ] **Step 1: Add a failing test**

In `src/lib/ai/system-prompt.test.ts`, add:

```ts
it('includes create_product confirmation guidance', () => {
  const prompt = getSystemPrompt()
  expect(prompt).toContain('create_product')
  expect(prompt).toContain('Confirma')
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test -- --reporter=verbose src/lib/ai/system-prompt.test.ts
```

Expected: FAIL — `create_product` not found in prompt

- [ ] **Step 3: Add the product creation section to the system prompt**

In `src/lib/ai/system-prompt.ts`, append the following section inside the template string returned by `getSystemPrompt()`, after the existing content and before the closing backtick:

```
**Creating Products (Cadastrar Produto):**
- When the user wants to add a new product, collect: name (required), price in BRL (required), unit — kg, g, lt, or und (required), and initial stock quantity (optional, defaults to 0)
- If any required fields are missing, ask for all missing fields at once in a single message
- Once you have all required fields, present a confirmation summary in Portuguese before calling the tool. Example: "Vou criar: Arroz, R$ 5,00/kg, estoque inicial: 10 kg. Confirma?"
- Only call the create_product tool after the user explicitly confirms
- If the tool returns an error, report it to the user in plain language
```

Note: do NOT include a backtick at the end of the last bullet — the code block above uses triple backticks as fencing only. The text should be appended as regular string content inside the existing template literal in `getSystemPrompt()`.

- [ ] **Step 4: Run the tests and verify they pass**

```bash
pnpm test -- --reporter=verbose src/lib/ai/system-prompt.test.ts
```

Expected: PASS on all tests

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
pnpm test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/system-prompt.ts src/lib/ai/system-prompt.test.ts
git commit -m "feat: add create product guidance to AI system prompt"
```
