# Testing Guide

This project has comprehensive test coverage for all features.

## Test Structure

```
├── src/
│   ├── lib/
│   │   ├── test-utils/
│   │   │   └── factories.ts      # Test data factories & mocks
│   │   ├── utils.test.ts         # Utility function tests
│   │   └── stores/
│   │       ├── products.test.ts  # Products store tests
│   │       └── cart.test.ts      # Cart store tests
│   └── routes/
│       └── page.server.test.ts   # Server action tests
├── e2e/
│   └── app.spec.ts               # Playwright E2E tests
├── .github/
│   └── workflows/
│       └── ci.yml                # GitHub Actions CI
├── vite.config.ts                # Vitest configuration
└── playwright.config.ts          # Playwright configuration
```

## Running Tests

### Unit Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### E2E Tests

```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

## Coverage Requirements

- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 80%
- **Statements**: 80%

Coverage reports are generated in the `coverage/` directory after running `npm run test:coverage`.

## Test Categories

### 1. Utility Tests (`utils.test.ts`)
- ✅ `cn()` - Tailwind class merging
- ✅ `formatCurrency()` - BRL currency formatting
- ✅ `formatDate()` - Brazilian date formatting

### 2. Store Tests

**Products Store** (`products.test.ts`):
- ✅ Initialization (empty array and with data)
- ✅ Add product to store
- ✅ Update product
- ✅ Soft delete product (sets deletedAt)
- ✅ Decrement stock
- ✅ Filtered products excludes deleted
- ✅ Search query filtering
- ✅ Available products (stock > 0)

**Cart Store** (`cart.test.ts`):
- ✅ Add product to cart
- ✅ Increment quantity for existing products
- ✅ Remove product from cart
- ✅ Update quantity
- ✅ Remove item when quantity is 0 or negative
- ✅ Clear cart
- ✅ Cart total calculation
- ✅ Cart item count

### 3. Server Action Tests (`page.server.test.ts`)

**createProduct**:
- ✅ Creates product with valid data
- ✅ Returns error for missing fields
- ✅ Returns error for invalid price
- ✅ Returns error when user not authenticated
- ✅ Includes store_id in product

**updateProduct**:
- ✅ Updates product with valid data
- ✅ Returns error for missing id
- ✅ Returns error for invalid data

**deleteProduct** (Soft Delete):
- ✅ Sets deleted_at timestamp
- ✅ Returns error for missing id

**processSale**:
- ✅ Processes sale with valid data
- ✅ Creates sale items
- ✅ Returns error for invalid items
- ✅ Returns error when user not authenticated
- ✅ Includes store_id in sale and sale_items

**logout**:
- ✅ Signs out user and redirects
- ✅ Returns error on sign out failure

### 4. E2E Tests (`app.spec.ts`)

**Authentication**:
- ✅ Redirect to login when not authenticated
- ✅ Login successfully
- ✅ Show error for invalid credentials

**Products**:
- ✅ Display product list
- ✅ Add new product
- ✅ Search products
- ✅ Edit product
- ✅ Soft delete product

**Sales**:
- ✅ Switch to sales tab
- ✅ Add product to cart
- ✅ Open cart and checkout
- ✅ Process sale and clear cart

**Sales History**:
- ✅ View sales history
- ✅ Filter by today
- ✅ Filter by week (7 days)
- ✅ Filter by month
- ✅ Show total revenue

**Profile**:
- ✅ Navigate to profile
- ✅ Toggle theme
- ✅ Logout

**Navigation**:
- ✅ Show bottom navigation
- ✅ Highlight active tab

## Test Data Factories

Use the factory functions in `src/lib/test-utils/factories.ts` to create test data:

```typescript
import { 
  createProduct, 
  createCartItem, 
  createSale,
  createMockSupabaseClient,
  createMockLocals,
  createMockFormData,
  createMockCookies 
} from "$lib/test-utils/factories";

// Create a test product
const product = createProduct({ 
  name: "Test Product", 
  price: 100 
});

// Create mock Supabase client
const supabase = createMockSupabaseClient();
```

## CI/CD Integration

Tests run automatically on every push and pull request via GitHub Actions:

1. **Unit Tests**: Run with coverage reporting
2. **Type Check**: Ensures TypeScript validity
3. **E2E Tests**: Run across multiple browsers (Chrome, Firefox, Safari)

Coverage reports are uploaded to Codecov for tracking.

## Writing New Tests

### Unit Test Example

```typescript
import { describe, it, expect } from "vitest";

describe("Feature", () => {
  it("should do something", () => {
    const result = myFunction();
    expect(result).toBe(expectedValue);
  });
});
```

### Component Test Example

```typescript
import { render, screen } from "@testing-library/svelte";
import MyComponent from "./MyComponent.svelte";

describe("MyComponent", () => {
  it("renders correctly", () => {
    render(MyComponent, { props: { title: "Test" } });
    expect(screen.getByText("Test")).toBeInTheDocument();
  });
});
```

### E2E Test Example

```typescript
import { test, expect } from "@playwright/test";

test("user can complete action", async ({ page }) => {
  await page.goto("/");
  await page.click("button");
  await expect(page.locator("text=Success")).toBeVisible();
});
```

## Mocking

All external dependencies (Supabase, cookies, etc.) are mocked in the test factories. This ensures tests run quickly and don't require a real database.

## Troubleshooting

### Tests failing locally?

1. Make sure all dependencies are installed:
   ```bash
   npm install
   ```

2. Clear Vitest cache:
   ```bash
   npx vitest --clearCache
   ```

3. Check if mocks are set up correctly in your tests

### Coverage not meeting requirements?

Run `npm run test:coverage` and check the HTML report in `coverage/index.html` to see which lines are not covered.
