# Auto POS - Fixes Report

> Generated: 2026-02-25
> Repository: auto-pos (SvelteKit 5 + Supabase POS system)

## Summary

| Severity  | Count  |
| --------- | ------ |
| Critical  | 4      |
| High      | 5      |
| Medium    | 10     |
| Low       | 5      |
| **Total** | **24** |

---

## CRITICAL

### 1. ESLint configuration file missing — linting completely broken

**File:** (missing) `eslint.config.js`
**Evidence:** `pnpm lint` output:

```
ESLint couldn't find an eslint.config.(js|mjs|cjs) file.
```

ESLint 9.x requires a flat config file (`eslint.config.js`). The project has `eslint`, `eslint-plugin-svelte`, and `typescript-eslint` installed as devDependencies, and a `"lint": "eslint ."` script in `package.json:17`, but no config file exists. Linting has never worked in this project.

**Fix:** Create `eslint.config.js` with Svelte + TypeScript flat config.

---

### 2. Dependency vulnerabilities — 15 advisories (4 high, 8 moderate, 3 low)

**Source:** `pnpm audit`

| Severity     | Package                                | Issue                                                                         | Fix                                                                |
| ------------ | -------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **high**     | `minimatch <10.2.1`                    | ReDoS via repeated wildcards                                                  | Update `@sveltejs/adapter-vercel`, `@vitest/coverage-v8`, `eslint` |
| **high**     | `tar <7.5.8`                           | Arbitrary file read/write via symlink chain                                   | Update `@sveltejs/adapter-vercel`                                  |
| **moderate** | `svelte <=5.51.4` (x4 CVEs)            | XSS in SSR spread attributes, `<option>`, `<svelte:element>`, prototype chain | Update `svelte` to `>=5.51.5`                                      |
| **moderate** | `@sveltejs/adapter-vercel <6.3.2`      | Cache poisoning                                                               | Update `@sveltejs/adapter-vercel` to `>=6.3.2`                     |
| **moderate** | `@sveltejs/kit >=2.49.0 <=2.52.1` (x2) | CPU/memory exhaustion in form deserialization                                 | Update `@sveltejs/kit` to `>=2.52.2`                               |
| **moderate** | `ajv <6.14.0`                          | ReDoS with `$data` option                                                     | Update `eslint`                                                    |
| **low**      | `cookie <0.7.0`                        | Accepts out-of-bounds characters                                              | Update `@sveltejs/kit`                                             |
| **low**      | `devalue <=5.6.2` (x2)                 | CPU amplification from sparse arrays; prototype pollution                     | Update `@sveltejs/kit`                                             |

**Fix:** Run `pnpm update --latest` for core dependencies, specifically:

```bash
pnpm update svelte @sveltejs/kit @sveltejs/adapter-vercel eslint
```

---

### 3. Race condition in sale processing — stock uses stale client-side values

**File:** `src/routes/+page.server.ts:196-208`

```typescript
for (const item of items) {
  const { error: stockError } = await locals.supabase
    .from('products')
    .update({
      stock: item.product.stock - item.quantity, // <-- stale value from client
    })
    .eq('id', item.product.id)
}
```

The stock update uses `item.product.stock` which is the value from the client's state at the time the form was submitted. If two users buy the same product concurrently, both will compute the new stock from the same base value, resulting in incorrect stock (e.g., stock=10, both buy 1, both set stock=9 instead of 8).

**Fix:** Use Supabase RPC or a database function that performs `stock = stock - quantity` atomically:

```sql
-- Use: .rpc('decrement_stock', { product_id: id, amount: quantity })
UPDATE products SET stock = stock - amount WHERE id = product_id AND stock >= amount;
```

---

### 4. Unvalidated JSON.parse can crash the server

**File:** `src/routes/+page.server.ts:145`

```typescript
const items = JSON.parse(itemsJson)
```

`JSON.parse` is called on user-submitted form data with no try/catch. A malformed JSON string will throw an unhandled exception, crashing the request handler and returning a 500 error instead of a graceful validation error.

**Fix:** Wrap in try/catch and validate the parsed structure with Zod (already a dependency):

```typescript
let items
try {
  items = JSON.parse(itemsJson)
} catch {
  return { success: false, error: 'Invalid sale data format' }
}
```

---

## HIGH

### 5. No store-level authorization on product mutations

**Files:**

- `src/routes/+page.server.ts:88-112` (updateProduct)
- `src/routes/+page.server.ts:114-134` (deleteProduct)

`updateProduct` and `deleteProduct` accept a product `id` from form data and operate on it directly without verifying the product belongs to the user's store. Any authenticated user can update or delete any product in the database by submitting a crafted form with an arbitrary product ID.

`createProduct` correctly fetches the store membership (line 64-68), but `updateProduct` and `deleteProduct` skip this check entirely.

**Fix:** Add store membership verification and filter by `store_id`:

```typescript
// In updateProduct/deleteProduct:
const { data: membership } = await locals.supabase
  .from('store_memberships')
  .select('store_id')
  .eq('user_id', locals.user.id)
  .single()

// Then filter: .eq("store_id", membership.store_id)
```

---

### 6. Sale processing is not atomic — partial failures leave inconsistent data

**File:** `src/routes/+page.server.ts:163-209`

The `processSale` action performs 3 sequential operations: insert sale, insert sale items, update stock. If `sale_items` insert fails (line 186-192), the `sales` record is already committed. If stock update fails mid-loop (line 196-208), some products have decremented stock and others don't.

**Fix:** Wrap the entire operation in a Supabase database transaction (via RPC/stored procedure) or use a compensating pattern that rolls back the sale on failure.

---

### 7. CI pipeline missing lint step

**File:** `.github/workflows/ci.yml:37-41`

The CI pipeline runs type checking and tests but never runs linting. Combined with the missing ESLint config (fix #1), this means code quality checks are completely absent from the pipeline.

**Fix:** Add lint step to CI (after fixing ESLint config):

```yaml
- name: Run linter
  run: pnpm run lint
```

---

### 8. CI pipeline missing E2E tests

**File:** `.github/workflows/ci.yml`

Commit `9ef2a2f` removed the E2E job entirely. Playwright is configured (`playwright.config.ts`, `e2e/app.spec.ts`) but never runs in CI. Regressions in authentication flows, checkout, and navigation will not be caught.

**Fix:** Restore E2E job or add a scheduled workflow for E2E tests.

---

### 9. Pre-release dependency in production

**File:** `package.json:22`

```json
"bits-ui": "^1.0.0-next.73"
```

This is a pre-release (`next`) version. Combined with caret (`^`), any `1.0.0-next.74+` will be installed on `pnpm install`, potentially introducing breaking changes. Pre-release semver ranges are unpredictable.

**Fix:** Pin to exact version (`"bits-ui": "1.0.0-next.73"`) or upgrade to a stable release if available.

---

## MEDIUM

### 10. console.log left in production code

**File:** `src/lib/components/CheckoutDialog.svelte:46`

```typescript
console.log({ result, total })
```

Debug logging in the checkout flow. Leaks internal state to browser console in production.

**Fix:** Remove the line or wrap in `if (import.meta.env.DEV)`.

---

### 11. Mixed language in UI — English string in Portuguese app

**File:** `src/lib/components/InventoryView.svelte:68`

```svelte
{$searchQuery
  ? 'Try a different search term'
  : 'Adicione um produto para começar'}
```

The entire UI is in Portuguese, but this one string is in English. Inconsistent user experience.

**Fix:** Replace with `"Tente um termo de pesquisa diferente"`.

---

### 12. Coverage thresholds are misleadingly low and contradict documentation

**Files:**

- `vite.config.ts:12-17` — actual thresholds: 25% lines, 35% functions, 35% branches, 25% statements
- `TESTING.md` — claims: 80% lines, 80% functions, 80% branches, 80% statements

Additionally, `vite.config.ts:25-30` excludes all components (`src/lib/components/**`) and all routes (`src/routes/**`) from coverage, which are the majority of the application code.

**Fix:** Either raise thresholds to meaningful values (e.g., 60%+) and reduce exclusions, or update TESTING.md to reflect reality.

---

### 13. Client-side validation defined but never called

**File:** `src/lib/components/ProductFormDialog.svelte:31-43`

The `validate()` function is defined but never called before form submission. The `use:enhance` handler (line 45) submits the form without invoking `validate()`. Client-side validation errors are only cosmetic — the server must be the source of truth.

Server-side validation in `+page.server.ts:54-56` only checks `!name || isNaN(price) || isNaN(stock)`, missing:

- Name trimming (empty spaces pass)
- Price/stock bounds (negative values, extremely large numbers)
- Name length limits

**Fix:** Call `validate()` in the enhance handler and return early if invalid. Also tighten server-side validation.

---

### 14. Playwright config uses npm instead of pnpm

**File:** `playwright.config.ts:37`

```typescript
command: 'npm run build && npm run preview'
```

The project uses pnpm. This is inconsistent and could cause issues if `package-lock.json` doesn't exist.

**Fix:** Change to `pnpm run build && pnpm run preview`.

---

### 15. No rate limiting on login endpoint

**File:** `src/routes/login/+page.server.ts:4-28`

The login action has no rate limiting or brute-force protection. An attacker can submit unlimited login attempts. While Supabase may have its own rate limiting, the application layer provides no defense.

**Fix:** Implement rate limiting via middleware or verify Supabase's built-in rate limiting is properly configured.

---

### 16. Error messages leak internal details

**Files:**

- `src/routes/+page.server.ts:82` — `return { success: false, error: error.message }`
- `src/routes/+page.server.ts:108` — same pattern
- `src/routes/+page.server.ts:130` — same pattern
- `src/routes/login/+page.server.ts:20` — `return fail(400, { error: error.message })`

Raw Supabase error messages are returned to the client. These can leak database schema details, constraint names, or internal state.

**Fix:** Return generic user-facing error messages and log the detailed errors server-side only.

---

### 17. Sales query not scoped to user's store

**File:** `src/routes/sales/+page.server.ts:6-17`

```typescript
let query = locals.supabase
  .from('sales')
  .select(`*, sale_items (*, product:products (name))`)
  .order('created_at', { ascending: false })
```

The sales query has no `store_id` filter. If Row Level Security (RLS) is not configured in Supabase, any authenticated user can view all sales from all stores.

**Fix:** Add `.eq("store_id", membership.store_id)` filter, or verify RLS is properly configured.

---

### 18. Products query not scoped to user's store on page load

**File:** `src/routes/+page.server.ts:8-12`

```typescript
const { data: products } = await locals.supabase
  .from('products')
  .select('*')
  .is('deleted_at', null)
  .order('created_at', { ascending: false })
```

Similar to fix #17 — no `store_id` filter. Relies entirely on Supabase RLS.

**Fix:** Add explicit store filtering or document the RLS dependency.

---

### 19. Missing `.env.example` file

No template exists for required environment variables. New developers must discover them from CI config or source code.

**Fix:** Create `.env.example`:

```
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-publishable-key
PRIVATE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PRIVATE_INTERNAL_API_KEY=your-internal-api-key
```

---

## LOW

### 20. Hardcoded port in Playwright config

**File:** `playwright.config.ts:11`

```typescript
baseURL: 'http://localhost:4173'
```

**Fix:** Use `process.env.PLAYWRIGHT_BASE_URL || "http://localhost:4173"`.

---

### 21. Store membership fetched redundantly in multiple actions

**Files:** `src/routes/+page.server.ts` lines 64-68, 153-157

`createProduct` and `processSale` both independently query `store_memberships`. This is a repeated pattern per request.

**Fix:** Fetch store membership once in the `load` function or a shared utility, and pass it through `locals`.

---

### 22. Cart store allows adding quantities beyond stock

**File:** `src/lib/stores/cart.ts:9-20`

The `add` method increments quantity without checking stock limits. The UI (`SalesView.svelte:25-28`) enforces this, but the store itself doesn't — any code calling `cart.add()` can exceed stock.

**Fix:** Accept a `maxStock` parameter in `add()` or validate in the store.

---

### 23. Missing TypeScript strictness options

**File:** `tsconfig.json`

Missing recommended options: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noImplicitReturns`.

**Fix:** Add these to `compilerOptions` for tighter type checking.

---

### 24. Product types use camelCase but database uses snake_case

**File:** `src/lib/types.ts:14-23`

```typescript
export interface Product {
  storeId: string // DB column: store_id
  createdAt: string // DB column: created_at
  updatedAt: string // DB column: updated_at
  deletedAt?: string // DB column: deleted_at
}
```

The type definitions use camelCase but Supabase returns snake_case. This mismatch may cause runtime property access failures unless there's a transformation layer (none was found in the codebase).

**Fix:** Either align types with snake_case DB columns, or add a mapping layer.

---

## Tool Results Summary

| Check          | Result                                             |
| -------------- | -------------------------------------------------- |
| `svelte-check` | 0 errors, 0 warnings                               |
| `eslint`       | **FAILED** — config file missing                   |
| `vitest`       | 51 tests passed (4 files)                          |
| `pnpm audit`   | **15 vulnerabilities** (4 high, 8 moderate, 3 low) |
