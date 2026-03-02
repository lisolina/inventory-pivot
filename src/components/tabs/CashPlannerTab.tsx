import { useState, useMemo, useCallback } from "react";
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, TrendingUp, Package, DollarSign, ShieldCheck, Save, RotateCcw, ChevronLeft, ChevronRight, CalendarDays, Clock, Truck, Factory, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { addWeeks, format, differenceInWeeks } from "date-fns";

// ── Epoch: Week 1 starts Jan 1, 2026 ───────────────────────────────
const EPOCH = new Date(2026, 0, 1);

function weekToDate(weekIndex: number): Date {
  return addWeeks(EPOCH, weekIndex);
}
function currentWeekIndex(): number {
  return differenceInWeeks(new Date(), EPOCH);
}
function weekLabel(weekIndex: number): string {
  return format(weekToDate(weekIndex), "MMM d");
}

// ── Default model inputs ────────────────────────────────────────────
const defaultInputs = {
  cashOnHand: 35385,
  weeklyVelocity: 1000,
  faireShare: 90,
  wbcShare: 5,
  dtcShare: 5,
  faireRevPerUnit: 4.05,
  wbcRevPerUnit: 4.0,
  dtcRevPerUnit: 6.5,
  cogsPerUnit: 1.65,
  dtcFulfillmentPerUnit: 0.48,
  fairePayout: 0,
  wbcPaymentDays: 30,
  dtcPayout: 2,
  monthlyOpex: 10000,
  wayflierBiweekly: 833,
  inventoryOnHand: 8000,
  tubeLeadWeeks: 5,
  productionLeadWeeks: 2,
  freightToSabahWeeks: 1,
  minWeeksStock: 8,
  productionRunSize: 10000,
  tubeOrderSize: 30000,
  tubeCostPer: 0.31,
  ingredientCostPerUnit: 0.35,
  productionCostPerUnit: 0.35,
  freightPerRun: 350,
  tubesOnHand: 25000,
  // New Phase 1 inputs
  tubePaymentPct1: 50,       // % paid upfront on tube order
  ingredientLeadWeeks: 2,    // weeks before production to order ingredients
  aesNetDays: 30,            // Net terms for AES production invoice
};

const STORAGE_KEY = "lisolina-planner-inputs";
const APPROVALS_KEY = "lisolina-planner-approvals";

type Inputs = typeof defaultInputs;

interface ScheduledExpense {
  id: string;
  weekIndex: number;
  absWeek: number;
  dateLabel: string;
  description: string;
  amount: number;
  category: "tubes" | "ingredients" | "production" | "freight";
  approved: boolean;
  cycleId: number;
}

interface PipelineItem {
  type: "tubes" | "production" | "freight" | "ingredients";
  description: string;
  startWeek: number;
  arriveWeek: number;
  qty?: number;
  cost?: number;
  cycleId: number;
}

interface CascadeAction {
  cycleId: number;
  triggerWeek: number;
  events: { weekIndex: number; absWeek: number; dateLabel: string; description: string; amount: number; type: string }[];
}

function loadSavedInputs(): Inputs {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...defaultInputs, ...JSON.parse(saved) };
  } catch {}
  return defaultInputs;
}

function loadSavedApprovals(): Record<string, boolean> {
  try {
    const saved = localStorage.getItem(APPROVALS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {};
}

// ── Sidebar input field ─────────────────────────────────────────────
function InputField({
  label, value, onChange, prefix, suffix, step,
}: {
  label: string; value: number; onChange: (v: number) => void;
  prefix?: string; suffix?: string; step?: number;
}) {
  return (
    <div className="mb-2.5">
      <Label className="text-[11px] font-semibold tracking-wide text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1 mt-1">
        {prefix && <span className="text-xs font-semibold text-foreground">{prefix}</span>}
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          step={step || 1}
          className="h-8 text-xs font-mono font-semibold"
        />
        {suffix && <span className="text-[11px] text-muted-foreground whitespace-nowrap">{suffix}</span>}
      </div>
    </div>
  );
}

// ── Metric card ─────────────────────────────────────────────────────
function MetricCard({
  label, value, sub, variant = "default", icon: Icon,
}: {
  label: string; value: string; sub?: string;
  variant?: "default" | "success" | "warning" | "danger";
  icon?: React.ElementType;
}) {
  const borderClass =
    variant === "danger" ? "border-destructive bg-destructive/5" :
    variant === "warning" ? "border-warning bg-warning/5" :
    variant === "success" ? "border-success bg-success/5" :
    "border-border";
  const valueClass =
    variant === "danger" ? "text-destructive" :
    variant === "warning" ? "text-warning" :
    variant === "success" ? "text-success" :
    "text-foreground";

  return (
    <Card className={`flex-1 min-w-[150px] ${borderClass}`}>
      <CardContent className="p-3.5">
        <div className="flex items-center gap-1.5 mb-1">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</span>
        </div>
        <div className={`text-xl font-bold font-mono ${valueClass}`}>{value}</div>
        {sub && (
          <div className={`text-[11px] mt-0.5 ${variant === "danger" ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
            {sub}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionHeader({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-3 mt-6">
      <h3 className="text-sm font-bold tracking-wide text-foreground">{children}</h3>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function SidebarSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold tracking-widest text-accent uppercase border-b border-accent/30 pb-1 mb-2 mt-4 first:mt-0">
      {children}
    </div>
  );
}

// ── Formatters ──────────────────────────────────────────────────────
const fmt = (n: number) => "$" + Math.round(n).toLocaleString();
const fmtK = (n: number) => n >= 1000 ? "$" + (n / 1000).toFixed(1) + "k" : "$" + Math.round(n).toLocaleString();

// ── Chart colors (HSL strings matching our design tokens) ───────────
const C_GREEN = "hsl(142, 71%, 45%)";
const C_RED = "hsl(0, 84%, 60%)";
const C_NAVY = "hsl(220, 39%, 20%)";
const C_BLUE = "hsl(199, 89%, 48%)";
const C_GOLD = "hsl(43, 52%, 54%)";
const C_ORANGE = "hsl(38, 92%, 50%)";

// ── Core planner model (16-week simulation) ─────────────────────────
function useModel(inputs: Inputs, startWeekOffset: number, approvals: Record<string, boolean>) {
  return useMemo(() => {
    const weeks = 16;
    const {
      cashOnHand, weeklyVelocity, faireShare, wbcShare, dtcShare,
      faireRevPerUnit, wbcRevPerUnit, dtcRevPerUnit, cogsPerUnit,
      dtcFulfillmentPerUnit, wbcPaymentDays,
      monthlyOpex, wayflierBiweekly, inventoryOnHand,
      tubeLeadWeeks, productionLeadWeeks, freightToSabahWeeks,
      minWeeksStock, productionRunSize, tubeOrderSize, tubeCostPer,
      ingredientCostPerUnit, productionCostPerUnit, freightPerRun, tubesOnHand,
      tubePaymentPct1, ingredientLeadWeeks, aesNetDays,
    } = inputs;

    const faireUnits = Math.round(weeklyVelocity * faireShare / 100);
    const wbcUnits = Math.round(weeklyVelocity * wbcShare / 100);
    const dtcUnits = Math.round(weeklyVelocity * dtcShare / 100);

    const faireContrib = faireRevPerUnit - cogsPerUnit;
    const wbcContrib = wbcRevPerUnit - cogsPerUnit;
    const dtcContrib = dtcRevPerUnit - cogsPerUnit - dtcFulfillmentPerUnit;

    const weeklyOpex = monthlyOpex / 4.33;
    const weeklyWayflier = wayflierBiweekly / 2;

    const totalLeadWeeks = tubeLeadWeeks + productionLeadWeeks + freightToSabahWeeks;
    const weeksOfStock = inventoryOnHand / weeklyVelocity;

    const tubePct1 = tubePaymentPct1 / 100;
    const tubePct2 = 1 - tubePct1;
    const aesNetWeeks = Math.ceil(aesNetDays / 7);

    // ── Phase 1: Deferred payment ledger ──────────────────────────
    // Each entry: { week, amount, label, category, expenseId, cycleId }
    const deferredPayments: { week: number; amount: number; label: string; category: string; expenseId: string; cycleId: number }[] = [];
    const scheduledExpenses: ScheduledExpense[] = [];
    const pipelineItems: PipelineItem[] = [];
    const cascadeActions: CascadeAction[] = [];

    let cashBalance = cashOnHand;
    let inventory = inventoryOnHand;
    let tubes = tubesOnHand;
    const pendingCashIn: { week: number; amount: number }[] = [];
    const productionScheduled: { arriveWeek: number; type: string; qty: number }[] = [];
    const weeklyData: any[] = [];
    const actions: { week: number; type: string; text: string; cost: number; sanityNote?: string }[] = [];

    // Dynamic reordering: cooldown-based
    let nextEligibleProductionWeek = 0;
    let nextEligibleTubeOrderWeek = 0;
    let cycleCounter = 0;

    // ── First pass: identify all triggers and schedule deferred payments ──
    // We simulate inventory/tube drawdown to find trigger points
    let simInventory = inventoryOnHand;
    let simTubes = tubesOnHand;
    const triggers: { week: number; type: "production" | "tube_order"; cycleId: number }[] = [];
    let simNextProd = 0;
    let simNextTube = 0;
    let simCycle = 0;

    for (let w = 0; w < weeks; w++) {
      const unitsSold = Math.min(weeklyVelocity, simInventory);
      simInventory -= unitsSold;

      // Check arrivals from scheduled production
      productionScheduled.forEach((ps) => {
        if (ps.arriveWeek === w && ps.type === "tubes") simTubes += ps.qty;
        if (ps.arriveWeek === w && ps.type === "finished") simInventory += ps.qty;
      });

      // Tube reorder check
      const tubeBuffer = weeklyVelocity * (tubeLeadWeeks + 4);
      if (w >= simNextTube && simTubes < tubeBuffer) {
        simCycle++;
        triggers.push({ week: w, type: "tube_order", cycleId: simCycle });
        simNextTube = w + tubeLeadWeeks + 2;
        productionScheduled.push({ arriveWeek: w + tubeLeadWeeks, type: "tubes", qty: tubeOrderSize });
      }

      // Production reorder check
      const bufferThreshold = weeklyVelocity * minWeeksStock;
      if (w >= simNextProd && simInventory <= bufferThreshold) {
        const thisCycle = simCycle > 0 ? simCycle : ++simCycle;
        triggers.push({ week: w, type: "production", cycleId: thisCycle });
        simNextProd = w + totalLeadWeeks;
        simTubes -= productionRunSize;
        productionScheduled.push({ arriveWeek: w + productionLeadWeeks + freightToSabahWeeks, type: "finished", qty: productionRunSize });
      }
    }

    // Clear and rebuild
    productionScheduled.length = 0;

    // Build scheduled expenses and deferred payments from triggers
    for (const trigger of triggers) {
      const w = trigger.week;
      const absW = startWeekOffset + w;
      const cid = trigger.cycleId;

      if (trigger.type === "tube_order") {
        const totalCost = tubeOrderSize * tubeCostPer;
        const upfrontAmt = Math.round(totalCost * tubePct1);
        const deliveryAmt = Math.round(totalCost * tubePct2);
        const deliveryWeek = w + tubeLeadWeeks;

        const id1 = `tube-upfront-c${cid}-w${w}`;
        const id2 = `tube-delivery-c${cid}-w${deliveryWeek}`;

        scheduledExpenses.push({
          id: id1, weekIndex: w, absWeek: absW, dateLabel: weekLabel(absW),
          description: `Tube order upfront (${tubePaymentPct1}%) — ${tubeOrderSize.toLocaleString()} tubes`,
          amount: upfrontAmt, category: "tubes", approved: approvals[id1] !== false, cycleId: cid,
        });
        if (deliveryWeek < weeks) {
          scheduledExpenses.push({
            id: id2, weekIndex: deliveryWeek, absWeek: startWeekOffset + deliveryWeek,
            dateLabel: weekLabel(startWeekOffset + deliveryWeek),
            description: `Tube order balance (${100 - tubePaymentPct1}%) — delivery`,
            amount: deliveryAmt, category: "tubes", approved: approvals[id2] !== false, cycleId: cid,
          });
        }

        deferredPayments.push({ week: w, amount: upfrontAmt, label: `Tubes Upfront (${tubePaymentPct1}%)`, category: "tubes", expenseId: id1, cycleId: cid });
        if (deliveryWeek < weeks) {
          deferredPayments.push({ week: deliveryWeek, amount: deliveryAmt, label: `Tubes Balance (${100 - tubePaymentPct1}%)`, category: "tubes", expenseId: id2, cycleId: cid });
        }

        productionScheduled.push({ arriveWeek: deliveryWeek, type: "tubes", qty: tubeOrderSize });
        pipelineItems.push({ type: "tubes", description: `${tubeOrderSize.toLocaleString()} tubes en route to AES`, startWeek: w, arriveWeek: deliveryWeek, qty: tubeOrderSize, cost: totalCost, cycleId: cid });

        const tubeWeeksSupply = (tubeOrderSize / weeklyVelocity).toFixed(0);
        const sanityNote = `${tubeOrderSize.toLocaleString()} tubes at ${weeklyVelocity.toLocaleString()}/wk = ${tubeWeeksSupply} weeks supply. At $${tubeCostPer}/tube = ${fmt(Math.round(totalCost))} total (${tubePaymentPct1}% upfront, ${100 - tubePaymentPct1}% on delivery).`;
        actions.push({ week: w, type: "tube_order", text: `Order ${tubeOrderSize.toLocaleString()} tubes`, cost: totalCost, sanityNote });
      }

      if (trigger.type === "production") {
        const ingredientCost = Math.round(productionRunSize * ingredientCostPerUnit);
        const aesCost = Math.round(productionRunSize * productionCostPerUnit);
        const freightCost = Math.round(freightPerRun);
        const productionStartWeek = w;
        const ingredientOrderWeek = Math.max(0, productionStartWeek - ingredientLeadWeeks);
        const productionCompleteWeek = productionStartWeek + productionLeadWeeks;
        const aesInvoiceDueWeek = productionCompleteWeek + aesNetWeeks;
        const freightArriveWeek = productionCompleteWeek + freightToSabahWeeks;

        const idIng = `ingredients-c${cid}-w${ingredientOrderWeek}`;
        const idAes = `aes-invoice-c${cid}-w${aesInvoiceDueWeek}`;
        const idFrt = `freight-c${cid}-w${productionCompleteWeek}`;

        // Ingredients — order before production
        if (ingredientOrderWeek < weeks) {
          scheduledExpenses.push({
            id: idIng, weekIndex: ingredientOrderWeek, absWeek: startWeekOffset + ingredientOrderWeek,
            dateLabel: weekLabel(startWeekOffset + ingredientOrderWeek),
            description: `Ingredients for ${productionRunSize.toLocaleString()} unit run`,
            amount: ingredientCost, category: "ingredients", approved: approvals[idIng] !== false, cycleId: cid,
          });
          deferredPayments.push({ week: ingredientOrderWeek, amount: ingredientCost, label: "Ingredients", category: "ingredients", expenseId: idIng, cycleId: cid });
        }

        // AES invoice — Net 30 after production completes
        if (aesInvoiceDueWeek < weeks) {
          scheduledExpenses.push({
            id: idAes, weekIndex: aesInvoiceDueWeek, absWeek: startWeekOffset + aesInvoiceDueWeek,
            dateLabel: weekLabel(startWeekOffset + aesInvoiceDueWeek),
            description: `AES production invoice (Net ${aesNetDays}) — ${productionRunSize.toLocaleString()} units`,
            amount: aesCost, category: "production", approved: approvals[idAes] !== false, cycleId: cid,
          });
          deferredPayments.push({ week: aesInvoiceDueWeek, amount: aesCost, label: `AES Invoice (Net ${aesNetDays})`, category: "production", expenseId: idAes, cycleId: cid });
        }

        // Freight — when production completes
        if (productionCompleteWeek < weeks) {
          scheduledExpenses.push({
            id: idFrt, weekIndex: productionCompleteWeek, absWeek: startWeekOffset + productionCompleteWeek,
            dateLabel: weekLabel(startWeekOffset + productionCompleteWeek),
            description: `Freight to Sabah — ${productionRunSize.toLocaleString()} units`,
            amount: freightCost, category: "freight", approved: approvals[idFrt] !== false, cycleId: cid,
          });
          deferredPayments.push({ week: productionCompleteWeek, amount: freightCost, label: "Freight to Sabah", category: "freight", expenseId: idFrt, cycleId: cid });
        }

        productionScheduled.push({ arriveWeek: freightArriveWeek, type: "finished", qty: productionRunSize });

        pipelineItems.push({ type: "ingredients", description: `Ingredients for ${productionRunSize.toLocaleString()} units`, startWeek: ingredientOrderWeek, arriveWeek: productionStartWeek, cost: ingredientCost, cycleId: cid });
        pipelineItems.push({ type: "production", description: `AES production — ${productionRunSize.toLocaleString()} units`, startWeek: productionStartWeek, arriveWeek: productionCompleteWeek, qty: productionRunSize, cost: aesCost, cycleId: cid });
        pipelineItems.push({ type: "freight", description: `Freight to Sabah`, startWeek: productionCompleteWeek, arriveWeek: freightArriveWeek, qty: productionRunSize, cost: freightCost, cycleId: cid });

        const totalProdCost = ingredientCost + aesCost + freightCost;
        actions.push({ week: w, type: "production", text: `Production run — ${productionRunSize.toLocaleString()} units — ${fmt(totalProdCost)} across 3 payments`, cost: totalProdCost });

        // Build cascade
        const cascadeEvents = [
          { weekIndex: ingredientOrderWeek, absWeek: startWeekOffset + ingredientOrderWeek, dateLabel: weekLabel(startWeekOffset + ingredientOrderWeek), description: `Order ingredients`, amount: ingredientCost, type: "ingredients" },
          { weekIndex: productionStartWeek, absWeek: startWeekOffset + productionStartWeek, dateLabel: weekLabel(startWeekOffset + productionStartWeek), description: `Production starts at AES`, amount: 0, type: "production_start" },
          { weekIndex: productionCompleteWeek, absWeek: startWeekOffset + productionCompleteWeek, dateLabel: weekLabel(startWeekOffset + productionCompleteWeek), description: `Production completes → Freight ships`, amount: freightCost, type: "freight" },
          { weekIndex: aesInvoiceDueWeek, absWeek: startWeekOffset + aesInvoiceDueWeek, dateLabel: weekLabel(startWeekOffset + aesInvoiceDueWeek), description: `AES invoice due (Net ${aesNetDays})`, amount: aesCost, type: "aes_invoice" },
          { weekIndex: freightArriveWeek, absWeek: startWeekOffset + freightArriveWeek, dateLabel: weekLabel(startWeekOffset + freightArriveWeek), description: `+${productionRunSize.toLocaleString()} units arrive at Sabah`, amount: 0, type: "arrival" },
        ].filter(e => e.weekIndex < weeks).sort((a, b) => a.weekIndex - b.weekIndex);

        cascadeActions.push({ cycleId: cid, triggerWeek: w, events: cascadeEvents });
      }
    }

    // ── Second pass: actual cash simulation with deferred payments ──
    inventory = inventoryOnHand;
    tubes = tubesOnHand;
    cashBalance = cashOnHand;
    const arrivals2: typeof productionScheduled = [];
    // Re-derive arrivals from triggers
    for (const trigger of triggers) {
      if (trigger.type === "tube_order") {
        arrivals2.push({ arriveWeek: trigger.week + tubeLeadWeeks, type: "tubes", qty: tubeOrderSize });
      }
      if (trigger.type === "production") {
        const completeWeek = trigger.week + productionLeadWeeks;
        arrivals2.push({ arriveWeek: completeWeek + freightToSabahWeeks, type: "finished", qty: productionRunSize });
      }
    }

    let bufferHitWeek = -1;

    for (let w = 0; w < weeks; w++) {
      let weekCashIn = 0;
      let weekCashOut = 0;
      const cashInBreakdown: { label: string; amount: number }[] = [];
      const cashOutBreakdown: { label: string; amount: number }[] = [];

      const unitsSold = Math.min(weeklyVelocity, inventory);
      const faireSold = Math.min(faireUnits, Math.round(unitsSold * faireShare / 100));
      const wbcSold = Math.min(wbcUnits, Math.round(unitsSold * wbcShare / 100));
      const dtcSold = Math.min(dtcUnits, Math.round(unitsSold * dtcShare / 100));

      const faireRev = faireSold * faireRevPerUnit;
      const wbcRev = wbcSold * wbcRevPerUnit;
      const dtcRev = dtcSold * dtcRevPerUnit;
      const weekRevenue = faireRev + wbcRev + dtcRev;

      weekCashIn += faireRev + dtcRev;
      if (faireRev > 0) cashInBreakdown.push({ label: "Faire Revenue", amount: Math.round(faireRev) });
      if (dtcRev > 0) cashInBreakdown.push({ label: "DTC Revenue", amount: Math.round(dtcRev) });

      const wbcPayWeek = w + Math.ceil(wbcPaymentDays / 7);
      if (wbcPayWeek < weeks) {
        pendingCashIn.push({ week: wbcPayWeek, amount: wbcRev });
      }
      pendingCashIn.forEach((p) => {
        if (p.week === w) { weekCashIn += p.amount; cashInBreakdown.push({ label: "Wholesale (delayed)", amount: Math.round(p.amount) }); }
      });

      // Fixed costs
      const opexAmt = Math.round(weeklyOpex);
      const wayAmt = Math.round(weeklyWayflier);
      const dtcFulfill = Math.round(dtcSold * dtcFulfillmentPerUnit);
      weekCashOut += weeklyOpex + weeklyWayflier + dtcSold * dtcFulfillmentPerUnit;
      cashOutBreakdown.push({ label: "OpEx", amount: opexAmt });
      cashOutBreakdown.push({ label: "Wayflyer", amount: wayAmt });
      if (dtcFulfill > 0) cashOutBreakdown.push({ label: "DTC Fulfillment", amount: dtcFulfill });

      inventory -= unitsSold;

      // Deferred payments that hit this week (only if approved)
      deferredPayments.forEach((dp) => {
        if (dp.week === w) {
          const expense = scheduledExpenses.find(e => e.id === dp.expenseId);
          if (expense && expense.approved) {
            weekCashOut += dp.amount;
            cashOutBreakdown.push({ label: dp.label, amount: dp.amount });
          } else {
            // Show as pending
            cashOutBreakdown.push({ label: `⏸ ${dp.label} (pending)`, amount: 0 });
          }
        }
      });

      // Arrivals
      arrivals2.forEach((ps) => {
        if (ps.arriveWeek === w && ps.type === "tubes") tubes += ps.qty;
        if (ps.arriveWeek === w && ps.type === "finished") inventory += ps.qty;
      });

      // Consume tubes for production triggers
      triggers.forEach(t => {
        if (t.type === "production" && t.week === w) tubes -= productionRunSize;
      });

      // Track buffer hit
      if (bufferHitWeek < 0 && inventory <= weeklyVelocity * minWeeksStock) {
        bufferHitWeek = w;
      }

      cashBalance += weekCashIn - weekCashOut;
      const absWeek = startWeekOffset + w;
      weeklyData.push({
        week: absWeek + 1, label: weekLabel(absWeek), isCurrent: absWeek === currentWeekIndex(),
        cashIn: Math.round(weekCashIn), cashOut: Math.round(weekCashOut),
        netCash: Math.round(weekCashIn - weekCashOut), cashBalance: Math.round(cashBalance),
        inventory, tubes, unitsSold, revenue: Math.round(weekRevenue),
        weeksOfStock: inventory > 0 ? +(inventory / weeklyVelocity).toFixed(1) : 0,
        cashInBreakdown, cashOutBreakdown,
        bufferLevel: weeklyVelocity * minWeeksStock,
      });
    }

    const minCash = Math.min(...weeklyData.map((d: any) => d.cashBalance));
    const minCashWeek = weeklyData.findIndex((d: any) => d.cashBalance === minCash) + 1;
    const stockoutAt = weeklyData.findIndex((d: any) => d.inventory <= 0);
    const weeklyContrib = faireUnits * faireContrib + wbcUnits * wbcContrib + dtcUnits * dtcContrib;
    const blendedContribPerUnit = weeklyContrib / weeklyVelocity;
    const blendedRevPerUnit = (faireShare / 100 * faireRevPerUnit) + (wbcShare / 100 * wbcRevPerUnit) + (dtcShare / 100 * dtcRevPerUnit);
    const blendedMargin = blendedContribPerUnit / blendedRevPerUnit;

    return {
      weeklyData, actions, minCash, minCashWeek, stockoutAt,
      faireContrib, wbcContrib, dtcContrib, blendedContribPerUnit, blendedMargin,
      weeksOfStock, totalLeadWeeks, weeklyContrib,
      faireUnits, wbcUnits, dtcUnits, weeklyOpex, weeklyWayflier, blendedRevPerUnit,
      scheduledExpenses, pipelineItems, cascadeActions, bufferHitWeek,
    };
  }, [inputs, startWeekOffset, approvals]);
}

// ── Custom tooltip for cash forecast ────────────────────────────────
function CashBreakdownTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;
  return (
    <div className="bg-background border border-border rounded-lg shadow-xl px-3 py-2 text-xs max-w-[280px]">
      <div className="font-bold mb-1.5 text-foreground">{label}</div>
      <div className="font-semibold text-foreground mb-1">Cash Balance: {fmt(data.cashBalance)}</div>
      {data.cashInBreakdown?.length > 0 && (
        <div className="mb-1.5">
          <div className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase mb-0.5">Inflows ({fmt(data.cashIn)})</div>
          {data.cashInBreakdown.map((item: any, i: number) => (
            <div key={i} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-mono font-semibold" style={{ color: C_GREEN }}>{fmt(item.amount)}</span>
            </div>
          ))}
        </div>
      )}
      {data.cashOutBreakdown?.length > 0 && (
        <div>
          <div className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase mb-0.5">Outflows ({fmt(data.cashOut)})</div>
          {data.cashOutBreakdown.map((item: any, i: number) => (
            <div key={i} className="flex justify-between gap-3">
              <span className={`text-muted-foreground ${item.amount === 0 ? "italic" : ""}`}>{item.label}</span>
              <span className="font-mono font-semibold" style={{ color: item.amount > 0 ? C_RED : C_GOLD }}>{item.amount > 0 ? fmt(item.amount) : "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Category icons/colors
const CATEGORY_STYLE: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  tubes: { icon: Package, color: "text-accent", bg: "bg-accent/10" },
  ingredients: { icon: FlaskConical, color: "text-info", bg: "bg-info/10" },
  production: { icon: Factory, color: "text-warning", bg: "bg-warning/10" },
  freight: { icon: Truck, color: "text-success", bg: "bg-success/10" },
};

// ═══════════════════════════════════════════════════════════════════
export function CashPlannerTab() {
  const [inputs, setInputs] = useState<Inputs>(loadSavedInputs);
  const [startWeekOffset, setStartWeekOffset] = useState(() => currentWeekIndex());
  const [approvals, setApprovals] = useState<Record<string, boolean>>(loadSavedApprovals);
  const set = useCallback((key: keyof Inputs) => (val: number) => setInputs((p) => ({ ...p, [key]: val })), []);
  const model = useModel(inputs, startWeekOffset, approvals);

  const goBack = () => setStartWeekOffset((o) => o - 4);
  const goForward = () => setStartWeekOffset((o) => o + 4);
  const goToNow = () => setStartWeekOffset(currentWeekIndex());

  const handleSave = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
    localStorage.setItem(APPROVALS_KEY, JSON.stringify(approvals));
    toast({ title: "Inputs saved", description: "Model inputs and expense approvals saved." });
  }, [inputs, approvals]);

  const handleReset = useCallback(() => {
    const saved = loadSavedInputs();
    setInputs(saved);
    setApprovals(loadSavedApprovals());
    toast({ title: "Inputs refreshed", description: "Restored from last save." });
  }, []);

  const toggleApproval = useCallback((id: string) => {
    setApprovals(prev => ({ ...prev, [id]: prev[id] === false ? true : false }));
  }, []);

  return (
    <div className="flex gap-0 -mx-6 -mt-2">
      {/* ── LEFT SIDEBAR ──────────────────────────────────────── */}
      <ScrollArea className="w-[270px] min-w-[270px] border-r border-border bg-card px-3.5 py-4" style={{ height: "calc(100vh - 140px)" }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold tracking-widest text-accent">MODEL INPUTS</span>
        </div>
        <div className="flex gap-1.5 mb-4">
          <Button size="sm" variant="default" className="flex-1 h-8 text-xs" onClick={handleSave}>
            <Save className="h-3.5 w-3.5 mr-1" /> Save
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <SidebarSection>Starting Position</SidebarSection>
        <InputField label="Cash on Hand" value={inputs.cashOnHand} onChange={set("cashOnHand")} prefix="$" step={500} />
        <InputField label="Finished Units at Sabah" value={inputs.inventoryOnHand} onChange={set("inventoryOnHand")} suffix="units" step={500} />
        <InputField label="Tubes at AES" value={inputs.tubesOnHand} onChange={set("tubesOnHand")} suffix="tubes" step={1000} />

        <SidebarSection>Velocity + Channel Mix</SidebarSection>
        <InputField label="Weekly Velocity" value={inputs.weeklyVelocity} onChange={set("weeklyVelocity")} suffix="units/wk" step={50} />
        <InputField label="Faire %" value={inputs.faireShare} onChange={set("faireShare")} suffix="%" step={5} />
        <InputField label="Wholesale %" value={inputs.wbcShare} onChange={set("wbcShare")} suffix="%" step={5} />
        <InputField label="DTC %" value={inputs.dtcShare} onChange={set("dtcShare")} suffix="%" step={5} />

        <SidebarSection>Unit Economics</SidebarSection>
        <InputField label="Faire Rev/Unit" value={inputs.faireRevPerUnit} onChange={set("faireRevPerUnit")} prefix="$" step={0.05} />
        <InputField label="Wholesale Rev/Unit" value={inputs.wbcRevPerUnit} onChange={set("wbcRevPerUnit")} prefix="$" step={0.05} />
        <InputField label="DTC Rev/Unit" value={inputs.dtcRevPerUnit} onChange={set("dtcRevPerUnit")} prefix="$" step={0.05} />
        <InputField label="COGS/Unit (landed)" value={inputs.cogsPerUnit} onChange={set("cogsPerUnit")} prefix="$" step={0.05} />
        <InputField label="DTC Fulfillment/Unit" value={inputs.dtcFulfillmentPerUnit} onChange={set("dtcFulfillmentPerUnit")} prefix="$" step={0.05} />

        <SidebarSection>Fixed Costs</SidebarSection>
        <InputField label="Monthly OpEx" value={inputs.monthlyOpex} onChange={set("monthlyOpex")} prefix="$" step={500} />
        <InputField label="Wayflyer Bi-weekly" value={inputs.wayflierBiweekly} onChange={set("wayflierBiweekly")} prefix="$" step={50} />

        <SidebarSection>Lead Times</SidebarSection>
        <InputField label="Tube Order to AES" value={inputs.tubeLeadWeeks} onChange={set("tubeLeadWeeks")} suffix="weeks" />
        <InputField label="AES Production" value={inputs.productionLeadWeeks} onChange={set("productionLeadWeeks")} suffix="weeks" />
        <InputField label="AES → Sabah Freight" value={inputs.freightToSabahWeeks} onChange={set("freightToSabahWeeks")} suffix="weeks" />
        <InputField label="Ingredient Lead Time" value={inputs.ingredientLeadWeeks} onChange={set("ingredientLeadWeeks")} suffix="weeks" />
        <InputField label="Min Stock Buffer" value={inputs.minWeeksStock} onChange={set("minWeeksStock")} suffix="weeks" />

        <SidebarSection>Payment Terms</SidebarSection>
        <InputField label="Tube Upfront %" value={inputs.tubePaymentPct1} onChange={set("tubePaymentPct1")} suffix="%" step={10} />
        <InputField label="AES Net Terms" value={inputs.aesNetDays} onChange={set("aesNetDays")} suffix="days" step={15} />

        <SidebarSection>Production</SidebarSection>
        <InputField label="Run Size" value={inputs.productionRunSize} onChange={set("productionRunSize")} suffix="units" step={500} />
        <InputField label="Ingredient Cost/Unit" value={inputs.ingredientCostPerUnit} onChange={set("ingredientCostPerUnit")} prefix="$" step={0.05} />
        <InputField label="Production Cost/Unit" value={inputs.productionCostPerUnit} onChange={set("productionCostPerUnit")} prefix="$" step={0.05} />
        <InputField label="Freight per Run" value={inputs.freightPerRun} onChange={set("freightPerRun")} prefix="$" step={50} />
        <InputField label="Tube Order Size" value={inputs.tubeOrderSize} onChange={set("tubeOrderSize")} suffix="tubes" step={1000} />
        <InputField label="Tube Cost Each" value={inputs.tubeCostPer} onChange={set("tubeCostPer")} prefix="$" step={0.01} />
      </ScrollArea>

      {/* ── MAIN CONTENT ──────────────────────────────────────── */}
      <div className="flex-1 px-6 py-4 overflow-y-auto" style={{ height: "calc(100vh - 140px)" }}>
        {/* Week navigation */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={goToNow}>
              <CalendarDays className="h-3.5 w-3.5 mr-1" /> Today
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={goForward}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {weekLabel(startWeekOffset)} — {weekLabel(startWeekOffset + 15)}, {format(weekToDate(startWeekOffset + 15), "yyyy")}
          </span>
        </div>

        {/* Metric cards */}
        <div className="flex gap-3 flex-wrap mb-4">
          <MetricCard icon={DollarSign} label="Cash on Hand" value={fmt(inputs.cashOnHand)} sub={`${model.weeksOfStock.toFixed(1)} weeks of stock`} />
          <MetricCard
            icon={AlertTriangle} label="Lowest Cash Point" value={fmtK(model.minCash)}
            sub={weekLabel(startWeekOffset + model.minCashWeek - 1)}
            variant={model.minCash < 5000 ? "danger" : model.minCash < 10000 ? "warning" : "default"}
          />
          <MetricCard icon={TrendingUp} label="Blended Contribution" value={`$${model.blendedContribPerUnit.toFixed(2)}/unit`} sub={`${(model.blendedMargin * 100).toFixed(1)}% margin`} />
          <MetricCard icon={DollarSign} label="Weekly Contribution" value={fmtK(model.weeklyContrib)} sub={`${inputs.weeklyVelocity.toLocaleString()} units/wk`} variant="success" />
          <MetricCard
            icon={Package} label="Buffer Hit"
            value={model.bufferHitWeek >= 0 ? weekLabel(startWeekOffset + model.bufferHitWeek) : "None in 16wk"}
            sub={model.bufferHitWeek >= 0 ? `Hits ${inputs.minWeeksStock}wk buffer` : "Buffer maintained"}
            variant={model.bufferHitWeek >= 0 && model.bufferHitWeek < 6 ? "danger" : model.bufferHitWeek >= 0 ? "warning" : "success"}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="forecast" className="space-y-4">
          <TabsList className="bg-muted">
            <TabsTrigger value="forecast">Cash Forecast</TabsTrigger>
            <TabsTrigger value="channels">Channel Mix</TabsTrigger>
            <TabsTrigger value="inventory">Inventory & Timing</TabsTrigger>
            <TabsTrigger value="actions">Action Plan</TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Cash Forecast ─────────────────────────── */}
          <TabsContent value="forecast">
            <SectionHeader sub="Cash balance over 16 weeks with timed payment events">CASH BALANCE FORECAST</SectionHeader>
            <Card><CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={model.weeklyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} className="fill-muted-foreground" />
                  <Tooltip content={<CashBreakdownTooltip />} />
                  <ReferenceLine y={5000} stroke={C_RED} strokeDasharray="4 4" label={{ value: "DANGER", fill: C_RED, fontSize: 10 }} />
                  <ReferenceLine y={10000} stroke={C_ORANGE} strokeDasharray="4 4" label={{ value: "LOW", fill: C_ORANGE, fontSize: 10 }} />
                  <Bar dataKey="cashIn" name="Cash In" fill={C_GREEN} opacity={0.6} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="cashOut" name="Cash Out" fill={C_RED} opacity={0.5} radius={[3, 3, 0, 0]} />
                  <Line dataKey="cashBalance" name="Cash Balance" stroke={C_NAVY} strokeWidth={2.5} dot={{ r: 3, fill: C_NAVY }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent></Card>

            <SectionHeader sub="Net cash each week — watch for spikes when production costs hit">WEEKLY NET CASH FLOW</SectionHeader>
            <Card><CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={model.weeklyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} />
                  <Tooltip formatter={(v: number, name: string) => [fmt(v), name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <ReferenceLine y={0} stroke={C_NAVY} strokeWidth={1} />
                  <Bar dataKey="netCash" name="Net Cash Flow" fill={C_BLUE} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent></Card>

            <SectionHeader sub="Line-by-line breakdown of weekly inflows and outflows">WEEKLY BREAKDOWN</SectionHeader>
            <Card><CardContent className="pt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 px-2 font-bold text-muted-foreground">Week</th>
                    <th className="text-left py-1.5 px-2 font-bold" style={{ color: C_GREEN }}>Inflows</th>
                    <th className="text-left py-1.5 px-2 font-bold" style={{ color: C_RED }}>Outflows</th>
                    <th className="text-right py-1.5 px-2 font-bold text-foreground">Net</th>
                    <th className="text-right py-1.5 px-2 font-bold text-foreground">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {model.weeklyData.map((d: any, i: number) => (
                    <tr key={i} className={`border-b border-border/50 ${d.isCurrent ? "bg-accent/10" : ""}`}>
                      <td className={`py-1.5 px-2 font-semibold ${d.isCurrent ? "text-accent" : "text-foreground"}`}>{d.label}</td>
                      <td className="py-1.5 px-2">
                        {d.cashInBreakdown?.map((item: any, j: number) => (
                          <div key={j} className="flex justify-between gap-2">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-mono" style={{ color: C_GREEN }}>{fmt(item.amount)}</span>
                          </div>
                        ))}
                      </td>
                      <td className="py-1.5 px-2">
                        {d.cashOutBreakdown?.map((item: any, j: number) => (
                          <div key={j} className={`flex justify-between gap-2 ${item.amount === 0 ? "opacity-50 italic" : ""}`}>
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-mono" style={{ color: item.amount > 0 ? C_RED : C_GOLD }}>{item.amount > 0 ? fmt(item.amount) : "—"}</span>
                          </div>
                        ))}
                      </td>
                      <td className={`py-1.5 px-2 text-right font-mono font-semibold ${d.netCash >= 0 ? "text-foreground" : "text-destructive"}`}>{fmt(d.netCash)}</td>
                      <td className={`py-1.5 px-2 text-right font-mono font-semibold ${d.cashBalance < 5000 ? "text-destructive" : "text-foreground"}`}>{fmt(d.cashBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent></Card>
          </TabsContent>

          {/* ── Tab 2: Channel Mix ───────────────────────────── */}
          <TabsContent value="channels">
            <SectionHeader sub="What each channel contributes after COGS and fulfillment">CHANNEL ECONOMICS</SectionHeader>
            <div className="flex gap-4 flex-wrap">
              {[
                { name: "Faire", units: model.faireUnits, rev: inputs.faireRevPerUnit, contrib: model.faireContrib, share: inputs.faireShare, color: C_BLUE, timing: "Immediate on ship" },
                { name: "Wholesale", units: model.wbcUnits, rev: inputs.wbcRevPerUnit, contrib: model.wbcContrib, share: inputs.wbcShare, color: C_ORANGE, timing: `Net ${inputs.wbcPaymentDays} days` },
                { name: "DTC", units: model.dtcUnits, rev: inputs.dtcRevPerUnit, contrib: model.dtcContrib, share: inputs.dtcShare, color: C_GREEN, timing: "1-2 days" },
              ].map((ch) => (
                <Card key={ch.name} className="flex-1 min-w-[220px]">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-bold" style={{ color: ch.color }}>{ch.name}</span>
                      <Badge variant="outline">{ch.share}%</Badge>
                    </div>
                    {[
                      ["Units/week", ch.units.toLocaleString()],
                      ["Revenue/unit", "$" + ch.rev.toFixed(2)],
                      ["COGS/unit", "$" + inputs.cogsPerUnit.toFixed(2)],
                      ...(ch.name === "DTC" ? [["Fulfillment/unit", "$" + inputs.dtcFulfillmentPerUnit.toFixed(2)]] : []),
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-semibold font-mono">{v}</span>
                      </div>
                    ))}
                    <div className="border-t border-border pt-2 mt-2 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-muted-foreground">Contribution/unit</span>
                        <span className="font-bold font-mono" style={{ color: ch.contrib > 0 ? C_GREEN : C_RED }}>${ch.contrib.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Margin</span>
                        <span className="font-semibold font-mono">{(ch.contrib / ch.rev * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Weekly $</span>
                        <span className="font-semibold font-mono" style={{ color: C_GREEN }}>{fmt(ch.units * ch.contrib)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Cash timing</span>
                        <span className="font-semibold font-mono">{ch.timing}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <SectionHeader sub="What shifting DTC to 15% would do">CHANNEL MIX SCENARIOS</SectionHeader>
            <Card><CardContent className="p-4 text-sm leading-relaxed">
              {(() => {
                const scenario15 = 0.80 * model.faireContrib + 0.05 * model.wbcContrib + 0.15 * model.dtcContrib;
                const weeklyGain = (scenario15 - model.blendedContribPerUnit) * inputs.weeklyVelocity;
                return (
                  <>
                    <p className="mb-2"><strong>Current:</strong> ${model.blendedContribPerUnit.toFixed(2)}/unit blended = {fmt(model.weeklyContrib)}/week</p>
                    <p className="mb-2"><strong>If DTC grows to 15%</strong> (Faire 80%, WBC 5%, DTC 15%): ${scenario15.toFixed(2)}/unit = +{fmt(weeklyGain)}/week</p>
                    <p className="italic text-muted-foreground">Use the sidebar inputs to model any mix. Charts update instantly.</p>
                  </>
                );
              })()}
            </CardContent></Card>
          </TabsContent>

          {/* ── Tab 3: Inventory & Timing ────────────────────── */}
          <TabsContent value="inventory">
            <SectionHeader sub="Finished product and tube stock — buffer hit annotated">INVENTORY RUNWAY</SectionHeader>
            <Card><CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={model.weeklyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: "Finished Units", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} label={{ value: "Tubes", angle: 90, position: "insideRight", style: { fontSize: 10 } }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <ReferenceLine yAxisId="left" y={inputs.weeklyVelocity * inputs.minWeeksStock} stroke={C_ORANGE} strokeDasharray="4 4" label={{ value: `${inputs.minWeeksStock}wk buffer`, fill: C_ORANGE, fontSize: 10 }} />
                  <ReferenceLine yAxisId="left" y={0} stroke={C_RED} strokeWidth={2} />
                  <Line yAxisId="left" dataKey="inventory" name="Finished Product" stroke={C_NAVY} strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line yAxisId="right" dataKey="tubes" name="Tubes at AES" stroke={C_GOLD} strokeWidth={2} dot={{ r: 2 }} strokeDasharray="5 3" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent></Card>

            {/* Buffer hit annotation */}
            {model.bufferHitWeek >= 0 && (
              <Card className="border-l-4 border-l-warning mt-3">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-foreground">
                        {weekLabel(startWeekOffset + model.bufferHitWeek)} — Hits {inputs.minWeeksStock}-week buffer level
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Inventory drops to {(inputs.weeklyVelocity * inputs.minWeeksStock).toLocaleString()} units ({inputs.minWeeksStock} weeks at {inputs.weeklyVelocity.toLocaleString()}/wk). Reorder cycle initiated to maintain stock.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pipeline */}
            {model.pipelineItems.length > 0 && (
              <>
                <SectionHeader sub="Orders in progress — what's moving through the supply chain">SUPPLY CHAIN PIPELINE</SectionHeader>
                <div className="flex flex-col gap-2">
                  {model.pipelineItems.map((item, i) => {
                    const style = CATEGORY_STYLE[item.type] || CATEGORY_STYLE.tubes;
                    const Icon = style.icon;
                    return (
                      <Card key={i} className={`border-l-4 ${item.type === "tubes" ? "border-l-accent" : item.type === "production" ? "border-l-warning" : item.type === "ingredients" ? "border-l-info" : "border-l-success"}`}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-1.5 rounded ${style.bg}`}><Icon className={`h-3.5 w-3.5 ${style.color}`} /></div>
                            <div>
                              <div className="text-xs font-semibold text-foreground">{item.description}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {weekLabel(startWeekOffset + item.startWeek)} → {item.arriveWeek < 16 ? weekLabel(startWeekOffset + item.arriveWeek) : "Beyond window"}
                              </div>
                            </div>
                          </div>
                          {item.cost && <span className="text-xs font-mono font-semibold text-muted-foreground">{fmt(item.cost)}</span>}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}

            {/* Reorder recommendation */}
            {model.cascadeActions.length > 0 && (
              <>
                <SectionHeader sub="What you need to order, produce, and pay — with timing">REORDER RECOMMENDATION</SectionHeader>
                {model.cascadeActions.map((cascade, ci) => {
                  const totalCost = cascade.events.reduce((sum, e) => sum + e.amount, 0);
                  const payments = cascade.events.filter(e => e.amount > 0);
                  return (
                    <Card key={ci} className="mb-3">
                      <CardContent className="p-4">
                        <div className="text-xs font-bold text-accent mb-2 uppercase tracking-wide">
                          Production Cycle #{cascade.cycleId} — triggered {weekLabel(startWeekOffset + cascade.triggerWeek)}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Initiate production of {inputs.productionRunSize.toLocaleString()} units. Requires {inputs.productionRunSize.toLocaleString()} tubes + ingredients, costing {fmt(totalCost)} across {payments.length} payments.
                        </p>
                        <div className="relative pl-4 border-l-2 border-border space-y-2">
                          {cascade.events.map((event, ei) => (
                            <div key={ei} className="relative">
                              <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-accent border-2 border-background" />
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-[11px] font-bold text-muted-foreground">{event.dateLabel}</span>
                                  <span className="text-xs text-foreground ml-2">{event.description}</span>
                                </div>
                                {event.amount > 0 && <span className="text-xs font-mono font-semibold text-destructive ml-2 whitespace-nowrap">-{fmt(event.amount)}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}

            <SectionHeader sub="Full timeline from ordering tubes to sellable product at Sabah">PRODUCTION LEAD TIME CHAIN</SectionHeader>
            <Card><CardContent className="p-5">
              <div className="flex items-center gap-0 flex-wrap justify-center">
                {[
                  { label: "Order Tubes", weeks: inputs.tubeLeadWeeks, bg: "bg-accent", cost: fmt(inputs.tubeOrderSize * inputs.tubeCostPer) },
                  { label: "AES Production", weeks: inputs.productionLeadWeeks, bg: "bg-info", cost: fmt(inputs.productionRunSize * (inputs.ingredientCostPerUnit + inputs.productionCostPerUnit)) },
                  { label: "Freight to Sabah", weeks: inputs.freightToSabahWeeks, bg: "bg-warning", cost: fmt(inputs.freightPerRun) },
                ].map((step, i) => (
                  <div key={i} className="flex items-center">
                    <div className={`${step.bg} text-white rounded-lg px-5 py-3 min-w-[130px] text-center`}>
                      <div className="text-[11px] font-bold tracking-wide">{step.label}</div>
                      <div className="text-2xl font-extrabold font-mono">{step.weeks}wk</div>
                      <div className="text-[10px] opacity-85">{step.cost}</div>
                    </div>
                    {i < 2 && <span className="text-xl text-muted-foreground px-1.5">→</span>}
                  </div>
                ))}
                <span className="text-xl text-muted-foreground px-1.5">=</span>
                <div className="bg-foreground text-background rounded-lg px-5 py-3 min-w-[140px] text-center">
                  <div className="text-[11px] font-bold">TOTAL LEAD TIME</div>
                  <div className="text-2xl font-extrabold font-mono">{model.totalLeadWeeks}wk</div>
                  <div className="text-[10px] text-accent">
                    {fmt(inputs.tubeOrderSize * inputs.tubeCostPer + inputs.productionRunSize * (inputs.ingredientCostPerUnit + inputs.productionCostPerUnit) + inputs.freightPerRun)} total
                  </div>
                </div>
              </div>
            </CardContent></Card>
          </TabsContent>

          {/* ── Tab 4: Action Plan ───────────────────────────── */}
          <TabsContent value="actions">
            {/* Expense Forecast with Approvals */}
            {model.scheduledExpenses.length > 0 && (
              <>
                <SectionHeader sub="Approve or defer each expense — only approved items flow into the cash simulation">EXPENSE FORECAST</SectionHeader>
                <Card><CardContent className="pt-4 pb-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 px-2 font-bold text-muted-foreground">Date</th>
                        <th className="text-left py-1.5 px-2 font-bold text-muted-foreground">Description</th>
                        <th className="text-left py-1.5 px-2 font-bold text-muted-foreground">Category</th>
                        <th className="text-right py-1.5 px-2 font-bold text-muted-foreground">Amount</th>
                        <th className="text-center py-1.5 px-2 font-bold text-muted-foreground">Approved</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.scheduledExpenses.sort((a, b) => a.weekIndex - b.weekIndex).map((exp) => {
                        const style = CATEGORY_STYLE[exp.category] || CATEGORY_STYLE.tubes;
                        const Icon = style.icon;
                        return (
                          <tr key={exp.id} className={`border-b border-border/50 ${!exp.approved ? "opacity-50" : ""}`}>
                            <td className="py-2 px-2 font-semibold text-foreground">{exp.dateLabel}</td>
                            <td className="py-2 px-2 text-foreground">{exp.description}</td>
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-1">
                                <Icon className={`h-3 w-3 ${style.color}`} />
                                <span className="capitalize text-muted-foreground">{exp.category}</span>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-semibold text-destructive">{fmt(exp.amount)}</td>
                            <td className="py-2 px-2 text-center">
                              <Switch
                                checked={exp.approved}
                                onCheckedChange={() => toggleApproval(exp.id)}
                                className="scale-75"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border">
                        <td colSpan={3} className="py-2 px-2 font-bold text-foreground">Total Approved</td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-destructive">
                          {fmt(model.scheduledExpenses.filter(e => e.approved).reduce((s, e) => s + e.amount, 0))}
                        </td>
                        <td className="py-2 px-2 text-center text-[10px] text-muted-foreground">
                          {model.scheduledExpenses.filter(e => e.approved).length}/{model.scheduledExpenses.length}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </CardContent></Card>
              </>
            )}

            {/* Cascade view */}
            {model.cascadeActions.length > 0 && (
              <>
                <SectionHeader sub="Full cascade of events for each production cycle">PRODUCTION CASCADES</SectionHeader>
                {model.cascadeActions.map((cascade, ci) => (
                  <Card key={ci} className="mb-3 border-l-4 border-l-accent">
                    <CardContent className="p-4">
                      <div className="text-[11px] font-bold text-accent uppercase tracking-wide mb-3">
                        Cycle #{cascade.cycleId} — {weekLabel(startWeekOffset + cascade.triggerWeek)}
                      </div>
                      <div className="relative pl-5 border-l-2 border-accent/30 space-y-3">
                        {cascade.events.map((event, ei) => (
                          <div key={ei} className="relative">
                            <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full border-2 border-accent bg-background" />
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-xs font-bold text-foreground">{event.dateLabel}</span>
                                <span className="text-xs text-muted-foreground ml-2">{event.description}</span>
                              </div>
                              {event.amount > 0 && <Badge variant="destructive" className="text-[10px] ml-2">-{fmt(event.amount)}</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}

            <SectionHeader sub="L'Isolina 2.0 decision lens applied to current model">CASH PROTECTION</SectionHeader>
            <Card><CardContent className="p-5 space-y-3">
              <div className={`p-3.5 rounded-lg text-sm leading-relaxed border ${
                model.minCash < 5000 ? "bg-destructive/5 border-destructive" :
                model.minCash < 10000 ? "bg-warning/10 border-warning" :
                "bg-success/5 border-success"
              }`}>
                <strong>{model.minCash < 5000 ? "DANGER" : model.minCash < 10000 ? "TIGHT" : "COVERED"}:</strong>{" "}
                Cash hits {fmt(model.minCash)} on {weekLabel(startWeekOffset + model.minCashWeek - 1)}.
                {model.minCash < 5000 && " Below safety floor. Delay production, reduce run size, or accelerate receivables."}
                {model.minCash >= 5000 && model.minCash < 10000 && " Tight but survivable. Avoid discretionary spend around this window."}
                {model.minCash >= 10000 && " Adequate runway to cover production and maintain buffer."}
              </div>

              <div className="p-3.5 rounded-lg bg-muted text-sm leading-relaxed">
                <strong>Weekly math:</strong> {fmt(model.weeklyContrib)} contribution – {fmt(model.weeklyOpex + model.weeklyWayflier)} fixed costs = <strong>{fmt(model.weeklyContrib - model.weeklyOpex - model.weeklyWayflier)}/week net surplus</strong> before production spend.
              </div>

              <div className="p-3.5 rounded-lg bg-accent/10 text-sm leading-relaxed">
                <strong>2.0 Decision Check:</strong> A {inputs.productionRunSize.toLocaleString()}-unit run sells through in ~{(inputs.productionRunSize / inputs.weeklyVelocity).toFixed(1)} weeks at current velocity. If velocity drops 30%, sell-through extends to ~{(inputs.productionRunSize / (inputs.weeklyVelocity * 0.7)).toFixed(1)} weeks. Blended margin is {(model.blendedMargin * 100).toFixed(1)}% — {model.blendedMargin > 0.50 ? "healthy" : "needs attention"}. Revenue converts in 60-90 days? {inputs.productionRunSize / inputs.weeklyVelocity <= 12 ? "Yes." : "Borderline — consider smaller run."}
              </div>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
