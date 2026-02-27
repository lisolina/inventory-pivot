

## Fix Plan: Invoice Parsing, Inventory Display, PO Dates, Cash Position, and File Viewing

### Issues Found

**1. Invoice parsing returns $0 and wrong data**
- `InvoiceDropZone` reuses the `parse-po-document` edge function, which has a PO-specific prompt. It calculates amount as `quantity * unitPrice`, but invoices don't have those fields. Need a dedicated invoice parsing prompt that extracts vendor, invoice number, total amount, and due date directly.

**2. Inventory tab shows wrong data / missing products**
- Data IS in the database (e.g., "Spaghetti Dust Aglio" with 4,188 units, 349 cases). The frontend `FINISHED_PRODUCTS` filter array has "SpaghettiDust Aglio" (no space) but the DB stores "Spaghetti Dust Aglio" (with space).
- No `category` column exists on `inventory_items` — the sheet has a category column but it's not being stored. Need to add a `category` column and use it for tab filtering instead of hardcoded product name lists.

**3. PO upload sets wrong date**
- The `parse-po-document` edge function parses `poDate` correctly but the order insert doesn't use it — `order_date` defaults to `now()`. Need to pass `parsedResult.poDate` as `order_date`.

**4. No file viewing for uploaded POs/invoices**
- Files are sent as base64 for AI parsing but never stored. Need to upload files to a storage bucket and store the file path on the order/invoice record so users can click to view the original document.

**5. Cash Position tile shows "—"**
- CSV import works but `balance_after` is NULL on most entries. The Chase CSV parser correctly reads the Balance column, but the data shows NULL. The `cashBalance` state only updates when `balance_after` is not null. Need to compute running balance from cash entries if no explicit balance exists.

**6. Dashboard "Cash on Hand" also shows "—"**
- Same root cause — pulls from `cash_entries.balance_after` which is null. Will be fixed by the same running balance logic.

---

### Implementation Steps

**Step 1: Add `category` and `sku` columns to `inventory_items` + `file_url` to `orders` and `invoices`**
- Migration: `ALTER TABLE inventory_items ADD COLUMN category text, ADD COLUMN sku text`
- Migration: `ALTER TABLE orders ADD COLUMN file_url text`
- Migration: `ALTER TABLE invoices ADD COLUMN file_url text`
- Create storage bucket `document-uploads` (public) for viewing uploaded files

**Step 2: Fix `sync-google-sheets` to store category and SKU**
- Find the category and SKU column indices from headers
- Store them alongside existing fields
- Frontend `InventoryTab.tsx`: filter by `category` column (values "Pasta"/"Dust" for finished products, "Packaging" for packaging) instead of hardcoded product name arrays
- Frontend `DashboardTab.tsx`: update inventory snapshot filter similarly

**Step 3: Fix invoice parsing**
- Create a new edge function `parse-invoice-document` (or add an `invoiceMode` flag to `parse-po-document`) with an invoice-specific AI prompt that extracts: vendor name, invoice number, total amount, due date, description
- Update `InvoiceDropZone` to use the invoice-specific parsing
- Upload the file to storage and store `file_url` on the invoice record

**Step 4: Fix PO upload — date + file storage**
- In `parse-po-document`, set `order_date: parsedResult.poDate` when inserting the order
- Upload the file to `document-uploads` bucket and store the URL on the order's `file_url`
- Update `POUploader` to send file for storage

**Step 5: Add document view icons to order and invoice tables**
- In `OrdersTab` order table: add a file icon button that opens the stored PDF in a dialog/new tab
- In `MoneyTab` invoice table: same file icon for viewing uploaded invoices

**Step 6: Fix cash position from CSV data**
- The Chase CSV balance column IS being parsed but stored as NULL (likely a parsing issue with the CSV format). Debug and fix the CSV parser to correctly capture the Balance column.
- As fallback: compute cash position as the `balance_after` from the most recent entry that has one, or sum all in/out transactions.
- Update `DashboardTab` cash on hand to use the same logic.

**Step 7: Fix `CashFlowChart` to show balance line**
- Currently balance is null for most entries. After fixing CSV import, the chart will auto-populate. Also add forward-fill logic so the balance line is continuous even on days with no explicit balance value.

### Files to Create/Edit
- **Migration**: add `category`, `sku` to `inventory_items`; `file_url` to `orders` and `invoices`; `document-uploads` bucket
- `supabase/functions/sync-google-sheets/index.ts` — store category + SKU columns
- `supabase/functions/parse-po-document/index.ts` — set order_date from poDate, upload file to storage
- `src/components/InvoiceDropZone.tsx` — dedicated invoice AI prompt, upload file to storage, store file_url
- `src/components/POUploader.tsx` — pass file for storage upload
- `src/components/CSVUploader.tsx` — fix balance_after parsing
- `src/components/tabs/InventoryTab.tsx` — filter by category column
- `src/components/tabs/DashboardTab.tsx` — fix inventory snapshot filter, fix cash on hand
- `src/components/tabs/OrdersTab.tsx` — add file view icon
- `src/components/tabs/MoneyTab.tsx` — add file view icon on invoices, fix cash position display
- `src/components/CashFlowChart.tsx` — forward-fill balance values

