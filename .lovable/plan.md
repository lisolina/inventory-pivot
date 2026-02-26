

## Plan: Fix Critical Issues + Add Key Features

This is a large request covering many areas. I'll organize into two phases: **Phase A** (fix broken things) and **Phase B** (new features).

---

### Phase A: Fix What's Broken

**1. Fix PO Upload (PDF parsing doesn't work)**
The current code sends a placeholder string `[PDF Document: filename]` instead of actual PDF content. Fix:
- Convert PDF to base64 in the browser and send to the edge function
- In `parse-po-document`, accept base64 content and use the AI gateway's multimodal capabilities (Gemini) to read the PDF directly
- After successful parse, auto-create an order in the `orders` table with line items

**2. Fix Google Sheets inventory sync missing products**
The sync function filters for `category === "Pasta"` or `category === "Dust"` only. SpaghettiDust products may have a different category value or the column matching is failing. Fix:
- Remove the strict category filter — instead pull ALL rows from the Inventory sheet and store them
- The frontend already filters by product name, so the edge function doesn't need to pre-filter
- Also store the SKU column so packaging items (CASE-AGLIO-DUST, TUBE-AGLIO-DUST) are captured

**3. Fix Email POs not showing body / not creating orders**
- The "Convert to Order" button updates the email status but doesn't actually insert into the `orders` table
- Fix `handleConvertToOrder` to parse the email and create an order with line items
- Ensure `email_body` is being stored by the `receive-forwarded-email` function

---

### Phase B: New Features

**4. Natural language order input on Orders tab**
- Add a text input + submit button at the top of the Open Orders sub-tab
- On submit, send text to AI (via existing chat edge function or a new one) to extract: customer name, product, quantity, urgency
- Auto-create an order in the `orders` table from the parsed result
- Example: "Jason at Almond wants a case of radiatory for ASAP" → creates order

**5. Channel tiles on Open Orders**
- Group open orders by source (faire, distributor, shopify/d2c)
- Show a summary card per channel: count of open orders, total units
- Expandable to show individual line items

**6. Bank statement CSV upload for Cash Flow**
- Add a CSV upload zone to the Money tab (or Cash Position card)
- Parse CSV rows (date, description, amount, balance) — support Chase CSV format
- Insert parsed rows into `cash_entries` table
- The existing CashFlowChart already renders from `cash_entries`, so it will auto-populate

**7. Invoice drag-and-drop with AI parsing**
- Replace the manual "Add Invoice" form with a drag-and-drop zone
- Upload invoice PDF/image → send to AI gateway to extract: vendor, invoice number, amount, due date
- Auto-populate and insert into `invoices` table
- Keep the manual form as a fallback

**8. Sales CRM tab**
- New database table: `crm_accounts` (name, contact_name, contact_email, status, last_contact_date, next_followup_date, notes)
- New database table: `crm_activities` (account_id, type, description, date)
- New component: `src/components/tabs/SalesCRMTab.tsx`
  - Account list with status badges (prospect, active, churned)
  - Activity log per account
  - Follow-up reminders (accounts where next_followup_date is approaching)
  - Email template popover with copy-to-clipboard
- Add "Sales CRM" tab to Index.tsx

---

### Database Changes
- New table `crm_accounts`: id, name, contact_name, contact_email, status, last_contact_date, next_followup_date, followup_cadence_days (default 10), notes, created_at, updated_at
- New table `crm_activities`: id, account_id (FK), type (email/call/meeting/note), description, date, created_at
- RLS: authenticated users full CRUD on both tables

### Files to Create/Edit
- **Create**: `src/components/tabs/SalesCRMTab.tsx`
- **Edit**: `supabase/functions/sync-google-sheets/index.ts` — remove category filter
- **Edit**: `supabase/functions/parse-po-document/index.ts` — handle base64 PDF
- **Edit**: `src/components/POUploader.tsx` — send base64 for PDFs, auto-create order after parse
- **Edit**: `src/components/tabs/OrdersTab.tsx` — add NL input, channel tiles, fix email conversion
- **Edit**: `src/components/tabs/MoneyTab.tsx` — add CSV upload, invoice drag-drop with AI
- **Edit**: `src/pages/Index.tsx` — add Sales CRM tab

### Implementation Order
1. Fix inventory sync (quick win, unblocks dashboard)
2. Fix PO upload (PDF base64 + AI parsing)
3. Add NL order input + channel tiles
4. Add CSV upload for cash flow
5. Add invoice drag-and-drop
6. Build Sales CRM tab + migration

