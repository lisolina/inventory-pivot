

## Plan: Add Receivable vs Payable Direction to Invoices

### Problem
The `invoices` table has no way to distinguish between **receivables** (money owed TO you, like invoice #1496 from Rainforest) and **payables** (money you OWE, like invoice #3005 to AES). Currently all pending invoices are treated as inflows in the cash flow projection, which is wrong.

### Changes

**1. Database migration** — Add a `direction` column to `invoices`:
- `direction TEXT NOT NULL DEFAULT 'receivable'` with values `'receivable'` or `'payable'`

**2. MoneyTab UI updates:**
- Split the Receivables tab into two sections: **Receivables** (money coming in) and **Payables** (money going out), or add a direction badge/column to the invoice table
- Add a `direction` selector (Receivable / Payable) to the "Add Invoice" dialog
- Show amounts in green for receivables, red for payables
- Update the table to show a direction indicator column

**3. InvoiceDropZone** — Add a direction option so when uploading an invoice the user can specify if it's a receivable or payable (default receivable)

**4. CashFlowProjection** — Fix the projection logic:
- Invoices with `direction = 'receivable'` → **inflow** on due date
- Invoices with `direction = 'payable'` → **outflow** on due date
- This automatically updates the calendar and projection chart

### Files
- **Migration**: add `direction` column to `invoices`
- **Edit**: `src/components/tabs/MoneyTab.tsx` — direction column in table, direction in Add Invoice form
- **Edit**: `src/components/InvoiceDropZone.tsx` — pass direction when creating invoice
- **Edit**: `src/components/CashFlowProjection.tsx` — use `direction` to determine inflow vs outflow

