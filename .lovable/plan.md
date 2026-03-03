

## Plan: Schedule Save Button + Product Differentiation (Tubes vs Finished Product)

### What changes

**1. Add a "Save Schedule" button** to the Schedule tab that persists events to localStorage and re-runs the simulation. Currently events are only saved when the main sidebar "Save" is clicked — give the schedule its own save button with toast confirmation.

**2. Add a "product" field to `SupplyChainEvent`** with values `"tubes"` or `"finished_product"` (Spaghetti Dust). This disambiguates what each event refers to:
- `tube_arrival` → product defaults to `"tubes"`, adds to `simTubes`
- `production_start` → product defaults to `"tubes"`, subtracts from `simTubes` (tubes consumed)
- `production_complete` / `freight_arrival` → product defaults to `"finished_product"`, adds to `simInventory`
- `tube_order` / `tube_payment` → product defaults to `"tubes"` (cash-only, no inventory change)

**3. Add a "Product" column** to the schedule table with a dropdown (`Tubes` / `Spaghetti Dust`). Pre-populated defaults set automatically based on event type.

**4. Update simulation logic** to use the `product` field: `tube_arrival` with product `"tubes"` adds to tubes; `freight_arrival` with product `"finished_product"` adds to finished inventory. This makes the inventory chart correctly reflect both lines.

### Simulation mapping

| Event Type | Product | Inventory Effect |
|---|---|---|
| `tube_arrival` | Tubes | `simTubes += qty` |
| `production_start` | Tubes | `simTubes -= qty` (consumed) |
| `production_complete` | Spaghetti Dust | No immediate inventory change (in-transit) |
| `freight_arrival` | Spaghetti Dust | `simInventory += qty` |
| `tube_order` | Tubes | Cash outflow only |
| `tube_payment` | Tubes | Cash outflow only |

### Changes — `src/components/tabs/CashPlannerTab.tsx`

1. Add `product: "tubes" | "finished_product"` field to `SupplyChainEvent`
2. Update `defaultScheduledEvents` with correct `product` values
3. Add "Product" dropdown column to schedule table (Tubes / Spaghetti Dust)
4. Auto-set product when event type changes (tube events → tubes, production_complete/freight_arrival → finished_product)
5. Add dedicated "Save Schedule" button that persists to localStorage and shows toast
6. Simulation already handles these event types correctly — verify product field is used for any edge cases

### Files
- **Edit**: `src/components/tabs/CashPlannerTab.tsx`

