# Sale Date Feature Design

**Date:** 2026-04-15

## Problem

Sales are recorded with an auto-generated `created_at` timestamp. There is no way to backdate a sale — if a cashier forgets to log a sale at the time it happened, the recorded date is always the current moment, not the actual sale date.

## Solution

Add a `sold_at DATE` column to the `sales` table and expose a date picker in the checkout dialog, always visible and defaulting to today.

## Approach

Option B: add a separate `sold_at` column. `created_at` remains as the DB audit timestamp; `sold_at` is the business date of the sale.

## Components

### Database migration

- Add `sold_at DATE NOT NULL DEFAULT CURRENT_DATE` to `sales`
- No RLS changes required
- Existing rows receive today's date as the default

### Server — `processSale` action (`src/routes/+page.server.ts`)

- Read `saleDate` from form data
- Validate: must be a valid `YYYY-MM-DD` string, not in the future
- Pass as `sold_at` in the `sales` insert
- Fall back to today's date if missing or invalid

### UI — `CheckoutDialog.svelte`

- Add a native `<input type="date">` below the payment method section
- Defaults to today (`new Date().toISOString().split('T')[0]`)
- `max` attribute set to today to prevent future-dating
- Styled to match existing inputs (border, rounded, same height)
- Value submitted as `saleDate` in the existing form

### Sales history — `src/routes/sales/+page.server.ts` and display

- Query includes `sold_at` from the `sales` table
- Display `sold_at` as the sale date in the history view instead of `created_at`

### Types — `src/lib/types.ts`

- Add `soldAt: string` to the `Sale` interface

## Out of Scope

- Time-of-day selection (date only)
- Bulk import of past sales
- Filtering sales history by date range
