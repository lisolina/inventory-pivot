

## Plan: Sortable Tables, Cash Balance Fix, Delete Actions, Task Expand, Alerts Management, Navigation Links, and Brand Colors

### 1. Sortable table headers (all tables)
- Create a reusable `SortableTableHead` component that renders clickable headers with sort arrows
- Apply to: **InventoryTab** (finished, packaging, shipping), **MoneyTab** (cash history, receivables, expenses), **OrdersTab** (open/fulfilled orders)
- Sort logic: alphabetical for text columns, numeric for number columns, chronological for dates

### 2. Fix cash position to account for pending transactions
- In `MoneyTab.fetchAll` and `DashboardTab.fetchMetrics`: after finding the last entry with `balance_after`, scan for any entries with a later date that have `balance_after = null`, and apply their in/out amounts to compute the true current balance
- Formula: `actualBalance = lastReportedBalance + sum(later "in" amounts) - sum(later "out" amounts)`

### 3. Delete orders from Open Orders
- Add a trash icon button to each row in the order table in `OrdersTab`
- Implement `handleDeleteOrder` that deletes from `orders` + associated `order_items`

### 4. Fix document links for POs/invoices
- The `file_url` is being stored but the link may not resolve. Check the storage bucket URL construction. The `document-uploads` bucket is public, so URLs should work. Debug: ensure the `file_url` field is actually populated on the order record (the `update` call uses `as any` cast which may not match types). Fix the types usage.

### 5. Fix PO date off-by-one
- The `parse-po-document` edge function likely stores the date as UTC midnight causing timezone shift. Fix by parsing the date string and ensuring it's stored without timezone offset, or adjusting the display to use UTC.

### 6. PO upload historical record
- Currently `uploadedPOs` state resets on component mount. Persist parsed PO results by storing them in the order record (the data is already there via `order_items`). Show a "Recent Uploads" section that queries orders with `source = 'distributor'` and `file_url IS NOT NULL`.

### 7. Delete invoices in Money tab
- Add trash icon next to "Mark Paid" button in the invoices table
- Implement `handleDeleteInvoice`

### 8. Alerts & Notifications — check/delete actions
- Currently alerts are computed in-memory from invoice due dates. To support check/dismiss, store dismissed alert IDs in local state (or a `dismissed_alerts` table). Simpler approach: add check and delete icon buttons that remove alerts from the displayed list using local state with localStorage persistence.

### 9. Tasks — expandable title/description
- Remove `truncate` class from task title/description in `TasksTile`
- Wrap task content in a clickable area that expands to show full description
- Or use a dialog/popover on click to show full task details

### 10. Email POs — delete action + hide converted
- Add a delete button to `ForwardedEmail` component
- Split email POs view into "Pending" (default) and "History" (converted/processed) with a toggle
- Need DELETE RLS policy on `forwarded_emails` table

### 11. Dashboard metric tiles — clickable navigation
- Wrap "Cash on Hand" tile with `onClick` that switches to Money tab
- Wrap "Open Orders" tile with `onClick` that switches to Orders tab
- Wrap "This Week's Revenue" tile with `onClick` that switches to Money tab
- Pass a `setActiveTab` callback from Index.tsx to DashboardTab

### 12. Add Cash Flow Chart to Money tab
- Import and render `CashFlowChart` component in `MoneyTab` (after the cash position cards)

### 13. Brand color update — red header + cream background
- Update CSS variables in `src/index.css`:
  - `--primary` from navy (220 46% 20%) to L'Isolina red (need to determine exact red — will use a rich Italian red ~HSL 0 70% 40%)
  - `--background` to cream (~HSL 40 30% 96% — already close, may need slight adjustment)
- The header uses `bg-primary`, so changing `--primary` will update it automatically

### Database migration needed
- Add DELETE policy on `forwarded_emails` for authenticated users

### Files to edit
- **Create**: `src/components/SortableTable.tsx` (reusable sort hook/component)
- **Edit**: `src/index.css` — brand colors
- **Edit**: `src/pages/Index.tsx` — pass tab setter to DashboardTab
- **Edit**: `src/components/tabs/DashboardTab.tsx` — clickable tiles, fix cash balance logic
- **Edit**: `src/components/tabs/InventoryTab.tsx` — sortable headers
- **Edit**: `src/components/tabs/OrdersTab.tsx` — delete order, sortable headers, fix date display, historical PO uploads
- **Edit**: `src/components/tabs/MoneyTab.tsx` — delete invoice, sortable headers, cash balance fix, add CashFlowChart
- **Edit**: `src/components/TasksTile.tsx` — expandable task details
- **Edit**: `src/components/ForwardedEmail.tsx` — delete action, pending/history split
- **Edit**: `supabase/functions/parse-po-document/index.ts` — fix date timezone
- **Migration**: DELETE policy on `forwarded_emails`

