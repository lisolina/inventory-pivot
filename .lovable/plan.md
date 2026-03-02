

## Plan: Inventory Default Sort, Editable Invoice Direction, Dust Launch Calendar + NL Input, and World Building Tab

### 1. Inventory: Default sort by quantity descending

**Edit `src/components/tabs/InventoryTab.tsx`**: Change `useSort()` calls to default to `units_on_hand` descending:
- `const finishedSort = useSort("units_on_hand", "desc");`
- `const packagingSort = useSort("units_on_hand", "desc");`
- `const shippingSort = useSort("quantity", "desc");`

### 2. Invoice direction: Inline editable dropdown

**Edit `src/components/tabs/MoneyTab.tsx`**: Replace the static `Badge` in the Type column (lines 397-400) with an inline `Select` dropdown that calls `supabase.from("invoices").update({ direction }).eq("id", inv.id)` and re-fetches. Small dropdown showing Receivable/Payable, updates DB on change.

### 3. Dust Launch HQ: 3-month calendar + NL task input + lead time tracking

**Edit `src/components/tabs/DustLaunchTab.tsx`**:

**a) 3-month calendar view** — Add a calendar section showing 3 months at a time with milestone deadlines and launch dates marked. Navigation arrows to scroll forward/backward by month. Key dates shown as colored dots (ordering=blue, production=amber, packaging=purple, go-to-market=green). Click a date to see milestones due.

**b) Natural language task input** — Add a text input at the top where the user types freeform updates (e.g., "Porcini dust packaging designs are nearly finished..."). On submit, call the existing `chat` edge function with a system prompt that extracts structured tasks from the input. Each extracted task gets inserted into `launch_milestones` with appropriate category, deadline, and product association. Display parsed tasks for confirmation before inserting.

**c) Lead time tracking** — Add `order_placed_date` and `arrived_date` columns to `launch_milestones` table (migration). Show "Order by" date (deadline minus lead time) as a drop-dead date. When an order arrives, record the date — the system calculates actual lead time (arrived - placed) and displays it alongside the estimated lead time. This historical data informs future estimates.

### 4. World Building tab

**Create `src/components/tabs/WorldBuildingTab.tsx`**: A new tab for tracking Substack, Lovable builds, .world website, brand artifacts, and merch tasks. Uses a new `world_tasks` table with columns: `id`, `title`, `description`, `category` (substack, lovable, website, artifacts, merch), `status` (pending/in-progress/done), `deadline`, `priority`, `notes`, `created_at`, `updated_at`.

Features:
- Category filter tabs (All, Substack, Lovable, Website, Artifacts, Merch)
- Add task dialog with category selector
- Sortable task list with status toggles, deadlines, priority badges
- NL input for quick task entry (reuse same pattern as Dust Launch)

**Edit `src/pages/Index.tsx`**: Add World Building tab next to Dust Launch HQ.

### Database Migration
```sql
-- Add lead time tracking to launch_milestones
ALTER TABLE launch_milestones
  ADD COLUMN order_placed_date timestamptz,
  ADD COLUMN arrived_date timestamptz;

-- World Building tasks table
CREATE TABLE world_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'substack',
  status text NOT NULL DEFAULT 'pending',
  deadline timestamptz,
  priority text NOT NULL DEFAULT 'medium',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE world_tasks ENABLE ROW LEVEL SECURITY;
-- RLS: authenticated full CRUD
CREATE POLICY "Auth users can view world_tasks" ON world_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert world_tasks" ON world_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update world_tasks" ON world_tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete world_tasks" ON world_tasks FOR DELETE TO authenticated USING (true);
```

### Files Summary
- **Migration**: Add `order_placed_date`/`arrived_date` to `launch_milestones`, create `world_tasks` table
- **Edit**: `src/components/tabs/InventoryTab.tsx` — default sort by quantity desc
- **Edit**: `src/components/tabs/MoneyTab.tsx` — inline direction dropdown on invoices
- **Edit**: `src/components/tabs/DustLaunchTab.tsx` — 3-month calendar, NL task input, lead time tracking fields
- **Create**: `src/components/tabs/WorldBuildingTab.tsx` — full task management tab
- **Edit**: `src/pages/Index.tsx` — add World Building tab

