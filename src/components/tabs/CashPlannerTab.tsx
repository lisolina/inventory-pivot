import { useState, useMemo, useCallback } from "react";
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Customized,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, TrendingUp, Package, DollarSign, ShieldCheck, Save, RotateCcw, ChevronLeft, ChevronRight, CalendarDays, Clock, Truck, Factory, FlaskConical, Plus, Trash2, ChevronDown, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { addWeeks, addDays, format, differenceInWeeks, startOfMonth, getDaysInMonth, getDay } from "date-fns";
import SourceLink from "@/components/SourceLink";

// ── Epoch: weeks start on Sunday Dec 28, 2025 ──────────────────────
const EPOCH = new Date(2025, 11, 28); // Sunday

// ── Known real-world commitments ────────────────────────────────────
const WAYFLYER_FIRST_DRAW = new Date(2026, 1, 17); // Feb 17, 2026
const WAYFLYER_DRAW_INTERVAL_WEEKS = 2;
const WAYFLYER_START_WEEK = differenceInWeeks(WAYFLYER_FIRST_DRAW, EPOCH);

const KNOWN_FIXED_EXPENSES: { dateWeekIdx: number; description: string; amount: number; category: "production" | "fixed" }[] = [
  { dateWeekIdx: differenceInWeeks(new Date(2026, 2, 19), EPOCH), description: "AES Invoice — prior run (completed 2/18)", amount: 9027, category: "production" },
];

function weekToDate(weekIndex: number): Date {
  return addWeeks(EPOCH, weekIndex);
}
function currentWeekIndex(): number {
  return differenceInWeeks(new Date(), EPOCH);
}
function weekLabel(weekIndex: number): string {
  return format(weekToDate(weekIndex), "MMM d");
}
function dateToWeekIndex(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  return differenceInWeeks(d, EPOCH);
}
/** Does the week starting at weekIndex contain the 1st of any month? */
function weekContainsFirstOfMonth(weekIndex: number): boolean {
  const weekStart = weekToDate(weekIndex);
  for (let d = 0; d < 7; d++) {
    const day = addDays(weekStart, d);
    if (day.getDate() === 1) return true;
  }
  return false;
}
/** Get the number of weeks in the month that weekIndex falls in */
function weeksInMonthForWeek(weekIndex: number): number {
  const date = weekToDate(weekIndex);
  const daysInMo = getDaysInMonth(date);
  return daysInMo / 7;
}

// ── Supply Chain Event Types ────────────────────────────────────────
type SCEventType = "tube_order" | "tube_payment" | "tube_arrival" | "production_start" | "production_complete" | "freight_arrival";

type SCProduct = "tubes" | "finished_product";

interface SupplyChainEvent {
  id: string;
  date: string; // YYYY-MM-DD
  type: SCEventType;
  product: SCProduct;
  description: string;
  qty: number;
  cost: number;
}

const SC_PRODUCT_LABELS: Record<SCProduct, string> = {
  tubes: "Tubes",
  finished_product: "Spaghetti Dust",
};

function defaultProductForType(type: SCEventType): SCProduct {
  switch (type) {
    case "tube_order":
    case "tube_payment":
    case "tube_arrival":
    case "production_start":
      return "tubes";
    case "production_complete":
    case "freight_arrival":
      return "finished_product";
  }
}

const SC_EVENT_LABELS: Record<SCEventType, string> = {
  tube_order: "Tube Order",
  tube_payment: "Tube Payment",
  tube_arrival: "Tube Arrival",
  production_start: "Production Start",
  production_complete: "Production Complete",
  freight_arrival: "Freight Arrival",
};

const SC_EVENT_COLORS: Record<SCEventType, string> = {
  tube_order: "text-accent",
  tube_payment: "text-accent",
  tube_arrival: "text-info",
  production_start: "text-warning",
  production_complete: "text-warning",
  freight_arrival: "text-success",
};

// ── Production Order Types ──────────────────────────────────────────
interface FundingTranche {
  id: string;
  pct: number;
  date: string;
}

interface ProductionOrder {
  id: string;
  tubesQty: number;
  tubeCostTotal: number;
  fundingTranches: FundingTranche[];
  shipDate: string;
  shippingMethod: "air" | "ocean";
  landedDateAES: string;
  productionRunDate: string;
  runSize: number;
  freightToSabahDate: string;
  arrivalDateSabah: string;
}

interface ProductionHistoryEntry {
  id: string;
  date: string;
  qty: number;
}

const PROD_ORDERS_STORAGE_KEY = "lisolina-prod-orders";
const PROD_HISTORY_STORAGE_KEY = "lisolina-prod-history";
const MANUAL_EXPENSES_STORAGE_KEY = "lisolina-manual-expenses";
const EXPENSE_OVERRIDES_STORAGE_KEY = "lisolina-expense-overrides";

interface ManualExpense {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  category: "tubes" | "ingredients" | "production" | "freight" | "fixed" | "wayflyer";
}

function loadSavedManualExpenses(): ManualExpense[] {
  try {
    const saved = localStorage.getItem(MANUAL_EXPENSES_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

type ExpenseOverride = Partial<Pick<ScheduledExpense, "dateLabel" | "description" | "amount" | "category">>;

function loadSavedExpenseOverrides(): Record<string, ExpenseOverride> {
  try {
    const saved = localStorage.getItem(EXPENSE_OVERRIDES_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {};
}

const defaultProductionOrders: ProductionOrder[] = [
  {
    id: "po-1",
    tubesQty: 15000,
    tubeCostTotal: 9300,
    fundingTranches: [
      { id: "t1", pct: 25, date: "2026-03-02" },
      { id: "t2", pct: 25, date: "2026-03-16" },
      { id: "t3", pct: 50, date: "2026-04-05" },
    ],
    shipDate: "2026-04-05",
    shippingMethod: "air",
    landedDateAES: "2026-04-12",
    productionRunDate: "2026-05-10",
    runSize: 15000,
    freightToSabahDate: "2026-05-17",
    arrivalDateSabah: "2026-05-24",
  },
  {
    id: "po-2",
    tubesQty: 15000,
    tubeCostTotal: 0,
    fundingTranches: [],
    shipDate: "2026-04-20",
    shippingMethod: "ocean",
    landedDateAES: "2026-05-03",
    productionRunDate: "2026-05-17",
    runSize: 15000,
    freightToSabahDate: "2026-05-24",
    arrivalDateSabah: "2026-05-31",
  },
];

const defaultProductionHistory: ProductionHistoryEntry[] = [
  { id: "ph-1", date: "2026-02-16", qty: 10000 },
];

function loadSavedProductionOrders(): ProductionOrder[] {
  try {
    const saved = localStorage.getItem(PROD_ORDERS_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return defaultProductionOrders;
}

function loadSavedProductionHistory(): ProductionHistoryEntry[] {
  try {
    const saved = localStorage.getItem(PROD_HISTORY_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return defaultProductionHistory;
}

function productionOrdersToSCEvents(orders: ProductionOrder[]): SupplyChainEvent[] {
  const events: SupplyChainEvent[] = [];
  for (let oi = 0; oi < orders.length; oi++) {
    const order = orders[oi];
    const orderLabel = orders.length > 1 ? ` (Order ${oi + 1})` : "";
    // Funding tranches → tube payments
    order.fundingTranches.forEach((tranche, i) => {
      const cost = Math.round(order.tubeCostTotal * tranche.pct / 100);
      if (cost > 0 || (i === 0 && order.tubesQty > 0)) {
        events.push({
          id: `po-${order.id}-tr-${tranche.id}`,
          date: tranche.date,
          type: i === 0 ? "tube_order" : "tube_payment",
          product: "tubes",
          description: i === 0
            ? `${order.tubesQty.toLocaleString()} tubes, ${tranche.pct}% deposit${orderLabel}`
            : `Tube payment ${tranche.pct}%${orderLabel}`,
          qty: i === 0 ? order.tubesQty : 0,
          cost,
        });
      }
    });

    // Tube arrival at AES
    if (order.landedDateAES && order.tubesQty > 0) {
      events.push({
        id: `po-${order.id}-land`,
        date: order.landedDateAES,
        type: "tube_arrival",
        product: "tubes",
        description: `${order.shippingMethod === "air" ? "Air" : "Ocean"} — ${order.tubesQty.toLocaleString()} tubes${orderLabel}`,
        qty: order.tubesQty,
        cost: 0,
      });
    }

    // Production start (consumes tubes)
    if (order.productionRunDate && order.runSize > 0) {
      events.push({
        id: `po-${order.id}-prod`,
        date: order.productionRunDate,
        type: "production_start",
        product: "tubes",
        description: `Run — ${order.runSize.toLocaleString()} tubes consumed${orderLabel}`,
        qty: order.runSize,
        cost: 0,
      });
    }

    // Freight arrival at Sabah
    if (order.arrivalDateSabah && order.runSize > 0) {
      events.push({
        id: `po-${order.id}-arr`,
        date: order.arrivalDateSabah,
        type: "freight_arrival",
        product: "finished_product",
        description: `${order.runSize.toLocaleString()} units at Sabah${orderLabel}`,
        qty: order.runSize,
        cost: 0,
      });
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
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
  monthlyOpex: 7500,
  monthlySalary: 2500,
  wayflierBiweekly: 1155,
  inventoryOnHand: 3400,
  tubeLeadWeeks: 5,
  productionLeadWeeks: 4,
  freightToSabahWeeks: 1,
  minWeeksStock: 8,
  productionRunSize: 10000,
  tubeOrderSize: 30000,
  tubeCostPer: 0.31,
  ingredientCostPerUnit: 0.35,
  productionCostPerUnit: 0.75,
  freightPerRun: 350,
  tubesOnHand: 0,
  // Phase 1 payment inputs
  tubePaymentPct1: 25,
  tubePaymentPct2: 25,
  ingredientLeadWeeks: 2,
  aesNetDays: 30,
  // Funding date overrides (YYYY-MM-DD or empty for auto)
  ingredientFundingDate: "2026-04-15",
  productionFundingDate: "2026-05-31",
  freightFundingDate: "",
  // Tube order & production history
  tubeOrderDate: "",
  lastProductionRunDate: "2026-02-16",
  // Dual buffer & PO timing
  tubeBufferWeeks: 9,
  poToProductionWeeks: 4,
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
  category: "tubes" | "ingredients" | "production" | "freight" | "fixed" | "wayflyer";
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

interface ProductionTriggerAnnotation {
  relWeek: number;
  absWeek: number;
  label: string;
  runSize: number;
  poType: "production" | "tube_order";
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

function DateInputField({
  label, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="mb-2.5">
      <Label className="text-[11px] font-semibold tracking-wide text-muted-foreground">{label}</Label>
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-xs font-mono font-semibold mt-1"
      />
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
const C_PURPLE = "hsl(280, 60%, 55%)";

// ── Production run arrow annotations for inventory chart ────────────
function ProductionRunArrows({ xAxisMap, yAxisMap, annotations }: { xAxisMap: any; yAxisMap: any; annotations: ProductionTriggerAnnotation[] }) {
  if (!xAxisMap || !yAxisMap || !annotations.length) return null;
  const xAxis = Object.values(xAxisMap)[0] as any;
  const yAxis = Object.values(yAxisMap)[0] as any;
  if (!xAxis || !yAxis) return null;

  return (
    <g>
      {annotations.map((ann, i) => {
        const xVal = xAxis.scale(ann.label);
        if (xVal === undefined || isNaN(xVal)) return null;
        const xPos = xVal + (xAxis.bandSize ? xAxis.bandSize / 2 : 0);
        const yTop = yAxis.y || 5;
        const arrowSize = 6;
        const isProd = ann.poType === "production";
        const color = isProd ? C_PURPLE : C_GOLD;
        const emoji = isProd ? "🏭" : "📦";
        const tooltipText = isProd
          ? `Recommended PO submission — Production (${ann.runSize.toLocaleString()} units)`
          : `Recommended PO submission — Tube Order (${ann.runSize.toLocaleString()} tubes)`;
        return (
          <g key={i}>
            <line x1={xPos} y1={yTop + 2} x2={xPos} y2={yTop + 22} stroke={color} strokeWidth={2} />
            <polygon
              points={`${xPos},${yTop + 22} ${xPos - arrowSize},${yTop + 14} ${xPos + arrowSize},${yTop + 14}`}
              fill={color}
            />
            <text x={xPos} y={yTop} textAnchor="middle" fontSize={9} fontWeight="bold" fill={color}>
              {emoji}
            </text>
            <rect x={xPos - 15} y={yTop} width={30} height={25} fill="transparent" style={{ cursor: "pointer" }}>
              <title>{tooltipText}</title>
            </rect>
          </g>
        );
      })}
    </g>
  );
}

// ── Core planner model (full-year simulation with sliding 16-week view) ──
function useModel(inputs: Inputs, startWeekOffset: number, todayWeekOffset: number, approvals: Record<string, boolean>, scEvents: SupplyChainEvent[], manualExpenses: ManualExpense[], expenseOverrides: Record<string, ExpenseOverride>) {
  return useMemo(() => {
    const yearEndAbsWeek = differenceInWeeks(new Date(2026, 11, 31), EPOCH);
    const totalSimWeeks = Math.max(16, yearEndAbsWeek - todayWeekOffset + 1);

    const {
      cashOnHand, weeklyVelocity, faireShare, wbcShare, dtcShare,
      faireRevPerUnit, wbcRevPerUnit, dtcRevPerUnit, cogsPerUnit,
      dtcFulfillmentPerUnit, wbcPaymentDays,
      monthlyOpex, monthlySalary, wayflierBiweekly, inventoryOnHand,
      tubeLeadWeeks, productionLeadWeeks, freightToSabahWeeks,
      minWeeksStock, productionRunSize, tubeOrderSize, tubeCostPer,
      ingredientCostPerUnit, productionCostPerUnit, freightPerRun, tubesOnHand,
      tubePaymentPct1, tubePaymentPct2, ingredientLeadWeeks, aesNetDays,
      ingredientFundingDate, productionFundingDate, freightFundingDate,
      tubeOrderDate, lastProductionRunDate,
      tubeBufferWeeks, poToProductionWeeks,
    } = inputs;

    const faireUnits = Math.round(weeklyVelocity * faireShare / 100);
    const wbcUnits = Math.round(weeklyVelocity * wbcShare / 100);
    const dtcUnits = Math.round(weeklyVelocity * dtcShare / 100);

    const faireContrib = faireRevPerUnit - cogsPerUnit;
    const wbcContrib = wbcRevPerUnit - cogsPerUnit;
    const dtcContrib = dtcRevPerUnit - cogsPerUnit - dtcFulfillmentPerUnit;

    const avgWeeklyWayflier = wayflierBiweekly / 2;

    const totalLeadWeeks = tubeLeadWeeks + productionLeadWeeks + freightToSabahWeeks;
    const weeksOfStock = inventoryOnHand / weeklyVelocity;

    const tubePct1 = tubePaymentPct1 / 100;
    const tubePct2 = tubePaymentPct2 / 100;
    const tubeBufferThreshold = weeklyVelocity * tubeBufferWeeks;
    const tubePct3 = Math.max(0, 1 - tubePct1 - tubePct2);
    const tubeMidpointWeek = Math.round(tubeLeadWeeks / 2);
    const aesNetWeeks = Math.ceil(aesNetDays / 7);

    // ── Convert SC events to relative week indices ──
    const hasScheduledEvents = scEvents.length > 0;
    const scEventsByRelWeek: Map<number, SupplyChainEvent[]> = new Map();
    let lastScheduledRelWeek = -1;

    if (hasScheduledEvents) {
      for (const ev of scEvents) {
        const absWeek = dateToWeekIndex(ev.date);
        const relWeek = absWeek - todayWeekOffset;
        if (relWeek >= 0 && relWeek < totalSimWeeks) {
          if (!scEventsByRelWeek.has(relWeek)) scEventsByRelWeek.set(relWeek, []);
          scEventsByRelWeek.get(relWeek)!.push(ev);
          if (relWeek > lastScheduledRelWeek) lastScheduledRelWeek = relWeek;
        }
      }
    }

    // Funding date overrides → absolute week indices
    const ingredientFundingAbsWeek = ingredientFundingDate ? dateToWeekIndex(ingredientFundingDate) : -1;
    const productionFundingAbsWeek = productionFundingDate ? dateToWeekIndex(productionFundingDate) : -1;
    const freightFundingAbsWeek = freightFundingDate ? dateToWeekIndex(freightFundingDate) : -1;

    // Tube order date override → relative to todayWeekOffset
    const tubeOrderAbsWeek = tubeOrderDate ? dateToWeekIndex(tubeOrderDate) : -1;
    const tubeOrderRelWeek = tubeOrderAbsWeek >= 0 ? tubeOrderAbsWeek - todayWeekOffset : -1;

    // Last production run → compute cooldown relative to todayWeekOffset
    const lastProdAbsWeek = lastProductionRunDate ? dateToWeekIndex(lastProductionRunDate) : -1;
    const lastProdCooldownEnd = lastProdAbsWeek >= 0 ? lastProdAbsWeek + totalLeadWeeks - todayWeekOffset : 0;

    const deferredPayments: { week: number; amount: number; label: string; category: string; expenseId: string; cycleId: number }[] = [];
    const scheduledExpenses: ScheduledExpense[] = [];
    const pipelineItems: PipelineItem[] = [];
    const cascadeActions: CascadeAction[] = [];
    const productionAnnotations: ProductionTriggerAnnotation[] = [];

    let cashBalance = cashOnHand;
    let inventory = inventoryOnHand;
    let tubes = tubesOnHand;
    const pendingCashIn: { week: number; amount: number }[] = [];
    const productionScheduled: { arriveWeek: number; type: string; qty: number }[] = [];
    const weeklyData: any[] = [];
    const actions: { week: number; type: string; text: string; cost: number; sanityNote?: string }[] = [];

    let nextEligibleProductionWeek = 0;
    let nextEligibleTubeOrderWeek = 0;
    let cycleCounter = 0;

    // ── First pass: process scheduled events + auto-trigger fallback ──
    let simInventory = inventoryOnHand;
    let simTubes = tubesOnHand;
    const triggers: { week: number; type: "production" | "tube_order"; cycleId: number }[] = [];
    let simNextProd = Math.max(0, lastProdCooldownEnd);
    let simNextTube = 0;
    let tubeOrderPlaced = false;
    let simCycle = 0;

    // Build SC event cash impacts (tube_order, tube_payment costs)
    const scCashOutByRelWeek: Map<number, { amount: number; label: string; category: string }[]> = new Map();

    if (hasScheduledEvents) {
      for (const ev of scEvents) {
        const absWeek = dateToWeekIndex(ev.date);
        const relWeek = absWeek - todayWeekOffset;
        if (relWeek < 0 || relWeek >= totalSimWeeks) continue;

        if (ev.cost > 0) {
          const id = `sc-pay-${ev.id}`;
          scheduledExpenses.push({
            id, weekIndex: relWeek, absWeek, dateLabel: weekLabel(absWeek),
            description: ev.description, amount: ev.cost,
            category: ev.type.startsWith("tube") ? "tubes" : ev.type === "freight_arrival" ? "freight" : "production",
            approved: approvals[id] !== false, cycleId: 0,
          });
          deferredPayments.push({
            week: relWeek, amount: ev.cost, label: ev.description,
            category: ev.type.startsWith("tube") ? "tubes" : "production",
            expenseId: id, cycleId: 0,
          });
        }
      }
    }

    // First-pass simulation: handle SC events for inventory/tube effects, then auto-trigger after last scheduled event
    for (let w = 0; w < totalSimWeeks; w++) {
      const unitsSold = Math.min(weeklyVelocity, simInventory);
      simInventory -= unitsSold;

      // Process scheduled production arrivals (from auto-trigger)
      productionScheduled.forEach((ps) => {
        if (ps.arriveWeek === w && ps.type === "tubes") simTubes += ps.qty;
        if (ps.arriveWeek === w && ps.type === "finished") simInventory += ps.qty;
      });

      // Process SC events at this week
      const eventsThisWeek = scEventsByRelWeek.get(w);
      if (eventsThisWeek) {
        for (const ev of eventsThisWeek) {
          switch (ev.type) {
            case "tube_arrival":
              simTubes += ev.qty;
              break;
            case "production_start":
              simTubes = Math.max(0, simTubes - ev.qty);
              break;
            case "freight_arrival":
              simInventory += ev.qty;
              break;
            // tube_order, tube_payment, production_complete are cash-only events handled above
          }
        }
      }

      // Auto-trigger fallback: only for weeks beyond the last scheduled event
      const useAutoTrigger = !hasScheduledEvents || w > lastScheduledRelWeek;

      // Check if user has scheduled tube events — if so, skip tube auto-trigger entirely
      const hasScheduledTubeEvents = hasScheduledEvents && scEvents.some(e => e.type === "tube_order" || e.type === "tube_arrival");

      if (useAutoTrigger) {
        // Tube ordering: only auto-trigger if user hasn't scheduled tube events
        if (!hasScheduledTubeEvents) {
          if (tubeOrderRelWeek >= 0) {
            if (w === tubeOrderRelWeek && !tubeOrderPlaced) {
              simCycle++;
              triggers.push({ week: w, type: "tube_order", cycleId: simCycle });
              simNextTube = w + tubeLeadWeeks + 2;
              productionScheduled.push({ arriveWeek: w + tubeLeadWeeks, type: "tubes", qty: tubeOrderSize });
              tubeOrderPlaced = true;
              productionAnnotations.push({
                relWeek: w, absWeek: todayWeekOffset + w,
                label: weekLabel(todayWeekOffset + w), runSize: tubeOrderSize, poType: "tube_order",
              });
            }
          } else {
            if (w >= simNextTube && simTubes < tubeBufferThreshold) {
              simCycle++;
              triggers.push({ week: w, type: "tube_order", cycleId: simCycle });
              simNextTube = w + tubeLeadWeeks + 2;
              productionScheduled.push({ arriveWeek: w + tubeLeadWeeks, type: "tubes", qty: tubeOrderSize });
              productionAnnotations.push({
                relWeek: w, absWeek: todayWeekOffset + w,
                label: weekLabel(todayWeekOffset + w), runSize: tubeOrderSize, poType: "tube_order",
              });
            }
          }
        }

        const bufferThreshold = weeklyVelocity * minWeeksStock;
        if (w >= simNextProd && simInventory <= bufferThreshold) {
          const thisCycle = simCycle > 0 ? simCycle : ++simCycle;
          const poWeek = w;
          const actualProductionStart = w + poToProductionWeeks;
          triggers.push({ week: actualProductionStart, type: "production", cycleId: thisCycle });
          simNextProd = actualProductionStart + totalLeadWeeks;
          simTubes = Math.max(0, simTubes - productionRunSize);
          productionScheduled.push({ arriveWeek: actualProductionStart + productionLeadWeeks + freightToSabahWeeks, type: "finished", qty: productionRunSize });

          productionAnnotations.push({
            relWeek: poWeek, absWeek: todayWeekOffset + poWeek,
            label: weekLabel(todayWeekOffset + poWeek), runSize: productionRunSize, poType: "production",
          });
        }
      }
    }

    productionScheduled.length = 0;

    // Build scheduled expenses from auto-triggers (only for cycles beyond scheduled events)
    for (const trigger of triggers) {
      const w = trigger.week;
      const absW = todayWeekOffset + w;
      const cid = trigger.cycleId;

      if (trigger.type === "tube_order") {
        const totalCost = tubeOrderSize * tubeCostPer;
        const amt1 = Math.round(totalCost * tubePct1);
        const amt2 = Math.round(totalCost * tubePct2);
        const amt3 = Math.round(totalCost * tubePct3);
        const midWeek = w + tubeMidpointWeek;
        const deliveryWeek = w + tubeLeadWeeks;

        const id1 = `tube-t1-c${cid}-w${w}`;
        const id2 = `tube-t2-c${cid}-w${midWeek}`;
        const id3 = `tube-t3-c${cid}-w${deliveryWeek}`;

        scheduledExpenses.push({
          id: id1, weekIndex: w, absWeek: absW, dateLabel: weekLabel(absW),
          description: `Tube deposit (${tubePaymentPct1}%) — ${tubeOrderSize.toLocaleString()} tubes`,
          amount: amt1, category: "tubes", approved: approvals[id1] !== false, cycleId: cid,
        });
        deferredPayments.push({ week: w, amount: amt1, label: `Tubes Deposit (${tubePaymentPct1}%)`, category: "tubes", expenseId: id1, cycleId: cid });

        if (midWeek < totalSimWeeks && tubePct2 > 0) {
          scheduledExpenses.push({
            id: id2, weekIndex: midWeek, absWeek: todayWeekOffset + midWeek,
            dateLabel: weekLabel(todayWeekOffset + midWeek),
            description: `Tube printing complete (${tubePaymentPct2}%)`,
            amount: amt2, category: "tubes", approved: approvals[id2] !== false, cycleId: cid,
          });
          deferredPayments.push({ week: midWeek, amount: amt2, label: `Tubes Printing (${tubePaymentPct2}%)`, category: "tubes", expenseId: id2, cycleId: cid });
        }

        if (deliveryWeek < totalSimWeeks && tubePct3 > 0) {
          scheduledExpenses.push({
            id: id3, weekIndex: deliveryWeek, absWeek: todayWeekOffset + deliveryWeek,
            dateLabel: weekLabel(todayWeekOffset + deliveryWeek),
            description: `Tube balance before ship (${Math.round(tubePct3 * 100)}%)`,
            amount: amt3, category: "tubes", approved: approvals[id3] !== false, cycleId: cid,
          });
          deferredPayments.push({ week: deliveryWeek, amount: amt3, label: `Tubes Ship Balance (${Math.round(tubePct3 * 100)}%)`, category: "tubes", expenseId: id3, cycleId: cid });
        }

        productionScheduled.push({ arriveWeek: deliveryWeek, type: "tubes", qty: tubeOrderSize });
        pipelineItems.push({ type: "tubes", description: `${tubeOrderSize.toLocaleString()} tubes en route to AES`, startWeek: absW, arriveWeek: todayWeekOffset + deliveryWeek, qty: tubeOrderSize, cost: totalCost, cycleId: cid });
        actions.push({ week: w, type: "tube_order", text: `Order ${tubeOrderSize.toLocaleString()} tubes — ${fmt(totalCost)} across 3 tranches`, cost: totalCost });
      }

      if (trigger.type === "production") {
        const ingredientCost = Math.round(productionRunSize * ingredientCostPerUnit);
        const aesCost = Math.round(productionRunSize * productionCostPerUnit);
        const freightCost = Math.round(freightPerRun);
        const productionStartWeek = w;

        const ingredientOrderWeekRel = ingredientFundingAbsWeek >= 0
          ? ingredientFundingAbsWeek - todayWeekOffset
          : Math.max(0, productionStartWeek - ingredientLeadWeeks);

        const productionCompleteWeek = productionStartWeek + productionLeadWeeks;

        const aesInvoiceDueWeekRel = productionFundingAbsWeek >= 0
          ? productionFundingAbsWeek - todayWeekOffset
          : productionCompleteWeek + aesNetWeeks;

        const freightWeekRel = freightFundingAbsWeek >= 0
          ? freightFundingAbsWeek - todayWeekOffset
          : productionCompleteWeek;

        const freightArriveWeek = productionCompleteWeek + freightToSabahWeeks;

        const idIng = `ingredients-c${cid}-w${ingredientOrderWeekRel}`;
        const idAes = `aes-invoice-c${cid}-w${aesInvoiceDueWeekRel}`;
        const idFrt = `freight-c${cid}-w${freightWeekRel}`;

        if (ingredientOrderWeekRel >= 0 && ingredientOrderWeekRel < totalSimWeeks) {
          const ingAbsWeek = todayWeekOffset + ingredientOrderWeekRel;
          scheduledExpenses.push({
            id: idIng, weekIndex: ingredientOrderWeekRel, absWeek: ingAbsWeek,
            dateLabel: weekLabel(ingAbsWeek),
            description: `Ingredients for ${productionRunSize.toLocaleString()} unit run`,
            amount: ingredientCost, category: "ingredients", approved: approvals[idIng] !== false, cycleId: cid,
          });
          deferredPayments.push({ week: ingredientOrderWeekRel, amount: ingredientCost, label: "Ingredients", category: "ingredients", expenseId: idIng, cycleId: cid });
        }

        if (aesInvoiceDueWeekRel >= 0 && aesInvoiceDueWeekRel < totalSimWeeks) {
          const aesAbsWeek = todayWeekOffset + aesInvoiceDueWeekRel;
          scheduledExpenses.push({
            id: idAes, weekIndex: aesInvoiceDueWeekRel, absWeek: aesAbsWeek,
            dateLabel: weekLabel(aesAbsWeek),
            description: `AES production invoice (Net ${aesNetDays}) — ${productionRunSize.toLocaleString()} units`,
            amount: aesCost, category: "production", approved: approvals[idAes] !== false, cycleId: cid,
          });
          deferredPayments.push({ week: aesInvoiceDueWeekRel, amount: aesCost, label: `AES Invoice (Net ${aesNetDays})`, category: "production", expenseId: idAes, cycleId: cid });
        }

        if (freightWeekRel >= 0 && freightWeekRel < totalSimWeeks) {
          const frtAbsWeek = todayWeekOffset + freightWeekRel;
          scheduledExpenses.push({
            id: idFrt, weekIndex: freightWeekRel, absWeek: frtAbsWeek,
            dateLabel: weekLabel(frtAbsWeek),
            description: `Freight to Sabah — ${productionRunSize.toLocaleString()} units`,
            amount: freightCost, category: "freight", approved: approvals[idFrt] !== false, cycleId: cid,
          });
          deferredPayments.push({ week: freightWeekRel, amount: freightCost, label: "Freight to Sabah", category: "freight", expenseId: idFrt, cycleId: cid });
        }

        productionScheduled.push({ arriveWeek: freightArriveWeek, type: "finished", qty: productionRunSize });

        pipelineItems.push({ type: "ingredients", description: `Ingredients for ${productionRunSize.toLocaleString()} units`, startWeek: todayWeekOffset + ingredientOrderWeekRel, arriveWeek: todayWeekOffset + productionStartWeek, cost: ingredientCost, cycleId: cid });
        pipelineItems.push({ type: "production", description: `AES production — ${productionRunSize.toLocaleString()} units`, startWeek: todayWeekOffset + productionStartWeek, arriveWeek: todayWeekOffset + productionCompleteWeek, qty: productionRunSize, cost: aesCost, cycleId: cid });
        pipelineItems.push({ type: "freight", description: `Freight to Sabah`, startWeek: todayWeekOffset + freightWeekRel, arriveWeek: todayWeekOffset + freightArriveWeek, qty: productionRunSize, cost: freightCost, cycleId: cid });

        const totalProdCost = ingredientCost + aesCost + freightCost;
        actions.push({ week: w, type: "production", text: `Production run — ${productionRunSize.toLocaleString()} units — ${fmt(totalProdCost)} across 3 payments`, cost: totalProdCost });

        const cascadeEvents = [
          { weekIndex: ingredientOrderWeekRel, absWeek: todayWeekOffset + ingredientOrderWeekRel, dateLabel: weekLabel(todayWeekOffset + ingredientOrderWeekRel), description: `Order ingredients`, amount: ingredientCost, type: "ingredients" },
          { weekIndex: productionStartWeek, absWeek: todayWeekOffset + productionStartWeek, dateLabel: weekLabel(todayWeekOffset + productionStartWeek), description: `Production starts at AES`, amount: 0, type: "production_start" },
          { weekIndex: productionCompleteWeek, absWeek: todayWeekOffset + productionCompleteWeek, dateLabel: weekLabel(todayWeekOffset + productionCompleteWeek), description: `Production completes → Freight ships`, amount: freightCost, type: "freight" },
          { weekIndex: aesInvoiceDueWeekRel, absWeek: todayWeekOffset + aesInvoiceDueWeekRel, dateLabel: weekLabel(todayWeekOffset + aesInvoiceDueWeekRel), description: `AES invoice due (Net ${aesNetDays})`, amount: aesCost, type: "aes_invoice" },
          { weekIndex: freightArriveWeek, absWeek: todayWeekOffset + freightArriveWeek, dateLabel: weekLabel(todayWeekOffset + freightArriveWeek), description: `+${productionRunSize.toLocaleString()} units arrive at Sabah`, amount: 0, type: "arrival" },
        ].filter(e => e.weekIndex >= 0 && e.weekIndex < totalSimWeeks).sort((a, b) => a.weekIndex - b.weekIndex);

        cascadeActions.push({ cycleId: cid, triggerWeek: todayWeekOffset + w, events: cascadeEvents });
      }
    }

    // ── Build pipeline items from SC events ──
    if (hasScheduledEvents) {
      // Group by type for pipeline visualization
      const tubeArrivals = scEvents.filter(e => e.type === "tube_arrival");
      for (const ev of tubeArrivals) {
        const absWeek = dateToWeekIndex(ev.date);
        // Find the tube order event as start
        const tubeOrder = scEvents.find(e => e.type === "tube_order");
        const orderAbsWeek = tubeOrder ? dateToWeekIndex(tubeOrder.date) : absWeek - 5;
        pipelineItems.push({
          type: "tubes", description: ev.description,
          startWeek: orderAbsWeek, arriveWeek: absWeek,
          qty: ev.qty, cost: 0, cycleId: 0,
        });
      }
      const prodStarts = scEvents.filter(e => e.type === "production_start");
      const prodCompletes = scEvents.filter(e => e.type === "production_complete");
      const freightArrivals = scEvents.filter(e => e.type === "freight_arrival");
      for (let i = 0; i < prodStarts.length; i++) {
        const start = prodStarts[i];
        const complete = prodCompletes[i];
        const freight = freightArrivals[i];
        if (start && complete) {
          pipelineItems.push({
            type: "production", description: start.description,
            startWeek: dateToWeekIndex(start.date), arriveWeek: dateToWeekIndex(complete.date),
            qty: start.qty, cycleId: 0,
          });
        }
        if (complete && freight) {
          pipelineItems.push({
            type: "freight", description: freight.description,
            startWeek: dateToWeekIndex(complete.date), arriveWeek: dateToWeekIndex(freight.date),
            qty: freight.qty, cycleId: 0,
          });
        }
      }
    }

    // ── Inject known fixed expenses ──
    for (const kfe of KNOWN_FIXED_EXPENSES) {
      const relWeek = kfe.dateWeekIdx - todayWeekOffset;
      if (relWeek >= 0 && relWeek < totalSimWeeks) {
        const id = `fixed-${kfe.description.slice(0, 12).replace(/\s/g, "")}-w${relWeek}`;
        scheduledExpenses.push({
          id, weekIndex: relWeek, absWeek: kfe.dateWeekIdx, dateLabel: weekLabel(kfe.dateWeekIdx),
          description: kfe.description, amount: kfe.amount, category: kfe.category as any,
          approved: approvals[id] !== false, cycleId: 0,
        });
        deferredPayments.push({ week: relWeek, amount: kfe.amount, label: kfe.description, category: kfe.category, expenseId: id, cycleId: 0 });
      }
    }

    // ── Inject manual expenses ──
    for (const me of manualExpenses) {
      const absWeek = dateToWeekIndex(me.date);
      const relWeek = absWeek - todayWeekOffset;
      if (relWeek >= 0 && relWeek < totalSimWeeks) {
        const id = `manual-${me.id}`;
        scheduledExpenses.push({
          id, weekIndex: relWeek, absWeek, dateLabel: weekLabel(absWeek),
          description: me.description, amount: me.amount, category: me.category,
          approved: approvals[id] !== false, cycleId: 0,
        });
        deferredPayments.push({ week: relWeek, amount: me.amount, label: me.description, category: me.category, expenseId: id, cycleId: 0 });
      }
    }

    // ── Deduplicate scheduled expenses by ID ──
    const seenIds = new Set<string>();
    const deduped: ScheduledExpense[] = [];
    for (const exp of scheduledExpenses) {
      if (!seenIds.has(exp.id)) {
        seenIds.add(exp.id);
        deduped.push(exp);
      }
    }
    scheduledExpenses.length = 0;
    scheduledExpenses.push(...deduped);

    // ── Apply expense overrides (user edits to auto-generated rows) ──
    for (const exp of scheduledExpenses) {
      const ov = expenseOverrides[exp.id];
      if (ov) {
        if (ov.amount !== undefined) exp.amount = ov.amount;
        if (ov.description !== undefined) exp.description = ov.description;
        if (ov.category !== undefined) exp.category = ov.category as any;
        if (ov.dateLabel !== undefined) exp.dateLabel = ov.dateLabel;
      }
    }
    // Also update deferred payments to use overridden amounts
    for (const dp of deferredPayments) {
      const ov = expenseOverrides[dp.expenseId];
      if (ov?.amount !== undefined) dp.amount = ov.amount;
    }

    tubes = tubesOnHand;
    cashBalance = cashOnHand;
    const arrivals2: typeof productionScheduled = [];
    // Add auto-trigger arrivals
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
    let oosWeek = -1;
    let tubeBufferHitWeek = -1;

    for (let w = 0; w < totalSimWeeks; w++) {
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
      if (wbcPayWeek < totalSimWeeks) {
        pendingCashIn.push({ week: wbcPayWeek, amount: wbcRev });
      }
      pendingCashIn.forEach((p) => {
        if (p.week === w) { weekCashIn += p.amount; cashInBreakdown.push({ label: "Wholesale (delayed)", amount: Math.round(p.amount) }); }
      });

      // ── OpEx: salary on 1st of month, remaining spread weekly ──
      const thisAbsWeek = todayWeekOffset + w;
      const isSalaryWeek = weekContainsFirstOfMonth(thisAbsWeek);
      const salaryAmt = isSalaryWeek ? monthlySalary : 0;
      const weeksInMo = weeksInMonthForWeek(thisAbsWeek);
      const weeklyOpexSpread = Math.round(monthlyOpex / weeksInMo);

      const dtcFulfill = Math.round(dtcSold * dtcFulfillmentPerUnit);

      // Wayflyer
      const isWayflyerWeek = thisAbsWeek >= WAYFLYER_START_WEEK && (thisAbsWeek - WAYFLYER_START_WEEK) % WAYFLYER_DRAW_INTERVAL_WEEKS === 0;
      const wayAmt = isWayflyerWeek ? wayflierBiweekly : 0;

      weekCashOut += weeklyOpexSpread + salaryAmt + wayAmt + dtcSold * dtcFulfillmentPerUnit;
      cashOutBreakdown.push({ label: "OpEx (excl. salary)", amount: weeklyOpexSpread });
      if (isSalaryWeek) cashOutBreakdown.push({ label: "Salary (1st of month)", amount: salaryAmt });
      if (isWayflyerWeek) cashOutBreakdown.push({ label: "Wayflyer Draw", amount: wayflierBiweekly });
      if (dtcFulfill > 0) cashOutBreakdown.push({ label: "DTC Fulfillment", amount: dtcFulfill });

      inventory -= unitsSold;

      // Deferred payments
      deferredPayments.forEach((dp) => {
        if (dp.week === w) {
          const expense = scheduledExpenses.find(e => e.id === dp.expenseId);
          if (expense && expense.approved) {
            weekCashOut += dp.amount;
            cashOutBreakdown.push({ label: dp.label, amount: dp.amount });
          } else {
            cashOutBreakdown.push({ label: `⏸ ${dp.label} (pending)`, amount: 0 });
          }
        }
      });

      // Arrivals from auto-triggers
      arrivals2.forEach((ps) => {
        if (ps.arriveWeek === w && ps.type === "tubes") tubes += ps.qty;
        if (ps.arriveWeek === w && ps.type === "finished") inventory += ps.qty;
      });

      // SC event arrivals (second pass)
      const eventsThisWeek2 = scEventsByRelWeek.get(w);
      if (eventsThisWeek2) {
        for (const ev of eventsThisWeek2) {
          switch (ev.type) {
            case "tube_arrival":
              tubes += ev.qty;
              break;
            case "production_start":
              tubes = Math.max(0, tubes - ev.qty);
              break;
            case "freight_arrival":
              inventory += ev.qty;
              break;
          }
        }
      }

      // Auto-trigger tube consumption
      triggers.forEach(t => {
        if (t.type === "production" && t.week === w) tubes = Math.max(0, tubes - productionRunSize);
      });
      tubes = Math.max(0, tubes);

      if (bufferHitWeek < 0 && inventory <= weeklyVelocity * minWeeksStock) {
        bufferHitWeek = w;
      }
      if (oosWeek < 0 && inventory <= 0) {
        oosWeek = w;
      }
      if (tubeBufferHitWeek < 0 && tubes <= tubeBufferThreshold) {
        tubeBufferHitWeek = w;
      }

      cashBalance += weekCashIn - weekCashOut;
      const absWeek = todayWeekOffset + w;
      weeklyData.push({
        week: absWeek + 1, label: weekLabel(absWeek), isCurrent: absWeek === currentWeekIndex(),
        cashIn: Math.round(weekCashIn), cashOut: Math.round(weekCashOut),
        netCash: Math.round(weekCashIn - weekCashOut), cashBalance: Math.round(cashBalance),
        inventory, tubes, unitsSold, revenue: Math.round(weekRevenue),
        weeksOfStock: inventory > 0 ? +(inventory / weeklyVelocity).toFixed(1) : 0,
        cashInBreakdown, cashOutBreakdown,
        bufferLevel: weeklyVelocity * minWeeksStock,
        tubeBufferLevel: tubeBufferThreshold,
      });
    }

    // ── Full-sim metrics ──
    const minCash = Math.min(...weeklyData.map((d: any) => d.cashBalance));
    const minCashIdx = weeklyData.findIndex((d: any) => d.cashBalance === minCash);
    const stockoutAt = weeklyData.findIndex((d: any) => d.inventory <= 0);
    const weeklyContrib = faireUnits * faireContrib + wbcUnits * wbcContrib + dtcUnits * dtcContrib;
    const blendedContribPerUnit = weeklyContrib / weeklyVelocity;
    const blendedRevPerUnit = (faireShare / 100 * faireRevPerUnit) + (wbcShare / 100 * wbcRevPerUnit) + (dtcShare / 100 * dtcRevPerUnit);
    const blendedMargin = blendedContribPerUnit / blendedRevPerUnit;
    const weeklyOpex = (monthlyOpex + monthlySalary) / 4.33;

    // ── Slice for display (16-week sliding window) ──
    const viewStart = Math.max(0, startWeekOffset - todayWeekOffset);
    const displayData = weeklyData.slice(viewStart, viewStart + 16);

    // Filter annotations to visible 16-week window
    const visibleAnnotations = productionAnnotations.filter(a =>
      a.absWeek >= startWeekOffset && a.absWeek < startWeekOffset + 16
    );

    return {
      weeklyData: displayData, actions, minCash,
      minCashAbsWeek: todayWeekOffset + minCashIdx,
      stockoutAt,
      faireContrib, wbcContrib, dtcContrib, blendedContribPerUnit, blendedMargin,
      weeksOfStock, totalLeadWeeks, weeklyContrib,
      faireUnits, wbcUnits, dtcUnits, weeklyOpex, weeklyWayflier: avgWeeklyWayflier, blendedRevPerUnit,
      scheduledExpenses, pipelineItems, cascadeActions,
      bufferHitAbsWeek: bufferHitWeek >= 0 ? todayWeekOffset + bufferHitWeek : -1,
      oosAbsWeek: oosWeek >= 0 ? todayWeekOffset + oosWeek : -1,
      tubeBufferHitAbsWeek: tubeBufferHitWeek >= 0 ? todayWeekOffset + tubeBufferHitWeek : -1,
      productionAnnotations: visibleAnnotations,
    };
  }, [inputs, startWeekOffset, todayWeekOffset, approvals, scEvents, manualExpenses, expenseOverrides]);
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
  fixed: { icon: DollarSign, color: "text-destructive", bg: "bg-destructive/10" },
  wayflyer: { icon: DollarSign, color: "text-muted-foreground", bg: "bg-muted" },
};

// ═══════════════════════════════════════════════════════════════════
export function CashPlannerTab() {
  const [inputs, setInputs] = useState<Inputs>(loadSavedInputs);
  const [startWeekOffset, setStartWeekOffset] = useState(() => currentWeekIndex());
  const [approvals, setApprovals] = useState<Record<string, boolean>>(loadSavedApprovals);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>(loadSavedProductionOrders);
  const [productionHistory, setProductionHistory] = useState<ProductionHistoryEntry[]>(loadSavedProductionHistory);
  const [manualExpenses, setManualExpenses] = useState<ManualExpense[]>(loadSavedManualExpenses);
  const [expenseOverrides, setExpenseOverrides] = useState<Record<string, ExpenseOverride>>(loadSavedExpenseOverrides);
  const [ordersOpen, setOrdersOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const set = useCallback((key: keyof Inputs) => (val: number) => setInputs((p) => ({ ...p, [key]: val })), []);
  const setStr = useCallback((key: keyof Inputs) => (val: string) => setInputs((p) => ({ ...p, [key]: val })), []);
  const todayWeek = useMemo(() => currentWeekIndex(), []);
  const yearEndAbsWeek = useMemo(() => differenceInWeeks(new Date(2026, 11, 31), EPOCH), []);
  const scEvents = useMemo(() => productionOrdersToSCEvents(productionOrders), [productionOrders]);

  // Derive lastProductionRunDate from production history
  const latestHistoryDate = useMemo(() => {
    if (productionHistory.length === 0) return inputs.lastProductionRunDate;
    return productionHistory.reduce((latest, e) => e.date > latest ? e.date : latest, "");
  }, [productionHistory, inputs.lastProductionRunDate]);

  const effectiveInputs = useMemo(() => ({
    ...inputs,
    lastProductionRunDate: latestHistoryDate,
  }), [inputs, latestHistoryDate]);

  const model = useModel(effectiveInputs, startWeekOffset, todayWeek, approvals, scEvents, manualExpenses, expenseOverrides);

  const goBack = () => setStartWeekOffset((o) => Math.max(todayWeek, o - 4));
  const goForward = () => setStartWeekOffset((o) => Math.min(yearEndAbsWeek - 15, o + 4));
  const goToNow = () => setStartWeekOffset(currentWeekIndex());

  const handleSave = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
    localStorage.setItem(APPROVALS_KEY, JSON.stringify(approvals));
    localStorage.setItem(PROD_ORDERS_STORAGE_KEY, JSON.stringify(productionOrders));
    localStorage.setItem(PROD_HISTORY_STORAGE_KEY, JSON.stringify(productionHistory));
    localStorage.setItem(MANUAL_EXPENSES_STORAGE_KEY, JSON.stringify(manualExpenses));
    localStorage.setItem(EXPENSE_OVERRIDES_STORAGE_KEY, JSON.stringify(expenseOverrides));
    toast({ title: "Inputs saved", description: "Model inputs, approvals, and expenses saved." });
  }, [inputs, approvals, productionOrders, productionHistory, manualExpenses, expenseOverrides]);

  const handleReset = useCallback(() => {
    setInputs(loadSavedInputs());
    setApprovals(loadSavedApprovals());
    setProductionOrders(loadSavedProductionOrders());
    setProductionHistory(loadSavedProductionHistory());
    setManualExpenses(loadSavedManualExpenses());
    setExpenseOverrides(loadSavedExpenseOverrides());
    toast({ title: "Inputs refreshed", description: "Restored from last save." });
  }, []);

  const toggleApproval = useCallback((id: string) => {
    setApprovals(prev => ({ ...prev, [id]: prev[id] === false ? true : false }));
  }, []);

  // Manual expense CRUD
  const addManualExpense = useCallback(() => {
    setManualExpenses(prev => [...prev, {
      id: `me-${Date.now()}`,
      date: format(new Date(), "yyyy-MM-dd"),
      description: "",
      amount: 0,
      category: "fixed",
    }]);
  }, []);

  const updateManualExpense = useCallback((id: string, field: keyof ManualExpense, value: any) => {
    setManualExpenses(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  }, []);

  const deleteManualExpense = useCallback((id: string) => {
    setManualExpenses(prev => prev.filter(e => e.id !== id));
  }, []);

  const deleteExpense = useCallback((expenseId: string) => {
    // For manual expenses, remove from state
    if (expenseId.startsWith("manual-")) {
      const realId = expenseId.replace("manual-", "");
      setManualExpenses(prev => prev.filter(e => e.id !== realId));
    } else {
      // For generated expenses, set approval to false (hide)
      setApprovals(prev => ({ ...prev, [expenseId]: false }));
    }
  }, []);

  const updateExpenseOverride = useCallback((id: string, field: keyof ExpenseOverride, value: any) => {
    setExpenseOverrides(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value },
    }));
  }, []);

  const resetExpenseOverride = useCallback((id: string) => {
    setExpenseOverrides(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);


  const addProductionOrder = useCallback(() => {
    setProductionOrders(prev => [...prev, {
      id: `po-${Date.now()}`,
      tubesQty: 0, tubeCostTotal: 0,
      fundingTranches: [],
      shipDate: "", shippingMethod: "ocean",
      landedDateAES: "", productionRunDate: "",
      runSize: 0, freightToSabahDate: "", arrivalDateSabah: "",
    }]);
  }, []);

  const updateOrder = useCallback((id: string, field: keyof ProductionOrder, value: any) => {
    setProductionOrders(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o));
  }, []);

  const removeOrder = useCallback((id: string) => {
    setProductionOrders(prev => prev.filter(o => o.id !== id));
  }, []);

  const addTranche = useCallback((orderId: string) => {
    setProductionOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return { ...o, fundingTranches: [...o.fundingTranches, { id: `tr-${Date.now()}`, pct: 0, date: format(new Date(), "yyyy-MM-dd") }] };
    }));
  }, []);

  const updateTranche = useCallback((orderId: string, trancheId: string, field: keyof FundingTranche, value: any) => {
    setProductionOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return { ...o, fundingTranches: o.fundingTranches.map(t => t.id === trancheId ? { ...t, [field]: value } : t) };
    }));
  }, []);

  const removeTranche = useCallback((orderId: string, trancheId: string) => {
    setProductionOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return { ...o, fundingTranches: o.fundingTranches.filter(t => t.id !== trancheId) };
    }));
  }, []);

  // Production history CRUD
  const addHistoryEntry = useCallback(() => {
    setProductionHistory(prev => [...prev, { id: `ph-${Date.now()}`, date: format(new Date(), "yyyy-MM-dd"), qty: 0 }]);
  }, []);

  const updateHistoryEntry = useCallback((id: string, field: keyof ProductionHistoryEntry, value: any) => {
    setProductionHistory(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  }, []);

  const removeHistoryEntry = useCallback((id: string) => {
    setProductionHistory(prev => prev.filter(e => e.id !== id));
  }, []);
  return (
    <div className="-mx-6 -mt-2" style={{ height: "calc(100vh - 140px)" }}>
      <ResizablePanelGroup direction="horizontal">
      {/* ── LEFT SIDEBAR ──────────────────────────────────────── */}
      <ResizablePanel defaultSize={20} minSize={15} maxSize={45}>
      <ScrollArea className="h-full border-r border-border bg-card px-3.5 py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold tracking-widest text-accent flex items-center gap-2">
            MODEL INPUTS <SourceLink source="cash" />
          </span>
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
        <InputField label="Monthly OpEx (excl. salary)" value={inputs.monthlyOpex} onChange={set("monthlyOpex")} prefix="$" step={500} />
        <InputField label="Monthly Salary" value={inputs.monthlySalary} onChange={set("monthlySalary")} prefix="$" step={100} />
        <InputField label="Wayflyer Draw (every 2wk)" value={inputs.wayflierBiweekly} onChange={set("wayflierBiweekly")} prefix="$" step={50} />

        {/* ── Production & Packaging Orders ──────────────── */}
        <Collapsible open={ordersOpen} onOpenChange={setOrdersOpen}>
          <CollapsibleTrigger asChild>
            <div className="text-[10px] font-bold tracking-widest text-accent uppercase border-b border-accent/30 pb-1 mb-2 mt-4 flex items-center justify-between cursor-pointer hover:text-accent/80">
              Production Orders
              <ChevronDown className={`h-3 w-3 transition-transform ${ordersOpen ? "rotate-180" : ""}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3">
            {productionOrders.map((order, idx) => (
              <Card key={order.id} className="p-2.5 border-accent/20">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-accent">Order {idx + 1}</span>
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => removeOrder(order.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
                <InputField label="Tubes Ordered" value={order.tubesQty} onChange={v => updateOrder(order.id, "tubesQty", v)} suffix="tubes" step={1000} />
                <InputField label="Tube Cost (Total)" value={order.tubeCostTotal} onChange={v => updateOrder(order.id, "tubeCostTotal", v)} prefix="$" step={100} />

                {/* Funding Tranches */}
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Funding Tranches</Label>
                    <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px]" onClick={() => addTranche(order.id)}>
                      <Plus className="h-2.5 w-2.5 mr-0.5" /> Add
                    </Button>
                  </div>
                  {order.fundingTranches.map(tr => (
                    <div key={tr.id} className="flex items-center gap-1 mb-1">
                      <Input type="number" value={tr.pct} onChange={e => updateTranche(order.id, tr.id, "pct", parseFloat(e.target.value) || 0)} className="h-6 text-[10px] font-mono w-12" />
                      <span className="text-[10px] text-muted-foreground">%</span>
                      <Input type="date" value={tr.date} onChange={e => updateTranche(order.id, tr.id, "date", e.target.value)} className="h-6 text-[10px] font-mono flex-1" />
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => removeTranche(order.id, tr.id)}>
                        <Trash2 className="h-2.5 w-2.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>

                <DateInputField label="Ship Date" value={order.shipDate} onChange={v => updateOrder(order.id, "shipDate", v)} />
                <div className="mb-2.5">
                  <Label className="text-[11px] font-semibold tracking-wide text-muted-foreground">Shipping Method</Label>
                  <Select value={order.shippingMethod} onValueChange={v => updateOrder(order.id, "shippingMethod", v)}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="air" className="text-xs">Air Freight</SelectItem>
                      <SelectItem value="ocean" className="text-xs">Ocean</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DateInputField label="Landed at AES" value={order.landedDateAES} onChange={v => updateOrder(order.id, "landedDateAES", v)} />
                <DateInputField label="Production Run Date" value={order.productionRunDate} onChange={v => updateOrder(order.id, "productionRunDate", v)} />
                <InputField label="Run Size" value={order.runSize} onChange={v => updateOrder(order.id, "runSize", v)} suffix="units" step={500} />
                <DateInputField label="Freight Ships from AES" value={order.freightToSabahDate} onChange={v => updateOrder(order.id, "freightToSabahDate", v)} />
                <DateInputField label="Arrives at Sabah" value={order.arrivalDateSabah} onChange={v => updateOrder(order.id, "arrivalDateSabah", v)} />
              </Card>
            ))}
            <Button size="sm" variant="outline" className="w-full mt-1" onClick={addProductionOrder}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Order
            </Button>
          </CollapsibleContent>
        </Collapsible>

        {/* ── Production History ──────────────────────────── */}
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger asChild>
            <div className="text-[10px] font-bold tracking-widest text-accent uppercase border-b border-accent/30 pb-1 mb-2 mt-4 flex items-center justify-between cursor-pointer hover:text-accent/80">
              Production History
              <ChevronDown className={`h-3 w-3 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1.5">
            {productionHistory.map(entry => (
              <div key={entry.id} className="flex items-center gap-1">
                <Input type="date" value={entry.date} onChange={e => updateHistoryEntry(entry.id, "date", e.target.value)} className="h-7 text-[10px] font-mono flex-1" />
                <Input type="number" value={entry.qty} onChange={e => updateHistoryEntry(entry.id, "qty", parseInt(e.target.value) || 0)} className="h-7 text-[10px] font-mono w-16 text-right" />
                <span className="text-[10px] text-muted-foreground">u</span>
                <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => removeHistoryEntry(entry.id)}>
                  <Trash2 className="h-2.5 w-2.5 text-destructive" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full mt-1" onClick={addHistoryEntry}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Entry
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </ScrollArea>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* ── MAIN CONTENT ──────────────────────────────────────── */}
      <ResizablePanel defaultSize={80}>
      <div className="h-full px-6 py-4 overflow-y-auto">
        {/* Week navigation */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex flex-col items-center">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={goToNow}>
                <CalendarDays className="h-3.5 w-3.5 mr-1" /> Today
              </Button>
              <span className="text-[10px] text-muted-foreground mt-0.5 font-medium">{format(new Date(), "MMM d, yyyy")}</span>
            </div>
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
            sub={weekLabel(model.minCashAbsWeek)}
            variant={model.minCash < 5000 ? "danger" : model.minCash < 10000 ? "warning" : "default"}
          />
          <MetricCard icon={TrendingUp} label="Blended Contribution" value={`$${model.blendedContribPerUnit.toFixed(2)}/unit`} sub={`${(model.blendedMargin * 100).toFixed(1)}% margin`} />
          <MetricCard icon={DollarSign} label="Weekly Contribution" value={fmtK(model.weeklyContrib)} sub={`${inputs.weeklyVelocity.toLocaleString()} units/wk`} variant="success" />
          <MetricCard
            icon={Package} label="Buffer Hit"
            value={model.bufferHitAbsWeek >= 0 ? weekLabel(model.bufferHitAbsWeek) : "None in forecast"}
            sub={model.bufferHitAbsWeek >= 0 ? `Hits ${inputs.minWeeksStock}wk buffer` : "Buffer maintained"}
            variant={model.bufferHitAbsWeek >= 0 && model.bufferHitAbsWeek - todayWeek < 6 ? "danger" : model.bufferHitAbsWeek >= 0 ? "warning" : "success"}
          />
          <MetricCard
            icon={Package} label="Tube Buffer Hit"
            value={model.tubeBufferHitAbsWeek >= 0 ? weekLabel(model.tubeBufferHitAbsWeek) : "None in forecast"}
            sub={model.tubeBufferHitAbsWeek >= 0 ? `Tubes below ${inputs.tubeBufferWeeks}wk buffer` : "Tube buffer maintained"}
            variant={model.tubeBufferHitAbsWeek >= 0 && model.tubeBufferHitAbsWeek - todayWeek < 4 ? "danger" : model.tubeBufferHitAbsWeek >= 0 ? "warning" : "success"}
          />
          <MetricCard
            icon={AlertTriangle} label="Out of Stock"
            value={model.oosAbsWeek >= 0 ? weekLabel(model.oosAbsWeek) : "None in forecast"}
            sub={model.oosAbsWeek >= 0 ? "Inventory hits zero" : "Stock maintained"}
            variant={model.oosAbsWeek >= 0 && model.oosAbsWeek - todayWeek < 8 ? "danger" : model.oosAbsWeek >= 0 ? "warning" : "success"}
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
            <SectionHeader sub="Finished product and tube stock — production run arrows mark forecast dates">INVENTORY RUNWAY</SectionHeader>
            <Card><CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={model.weeklyData} margin={{ top: 30, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 50000]} tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v / 1000}k`} label={{ value: "Units", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <ReferenceLine y={inputs.weeklyVelocity * inputs.minWeeksStock} stroke={C_ORANGE} strokeDasharray="4 4" label={{ value: `${inputs.minWeeksStock}wk buffer`, fill: C_ORANGE, fontSize: 10 }} />
                  <ReferenceLine y={inputs.weeklyVelocity * inputs.tubeBufferWeeks} stroke={C_GOLD} strokeDasharray="4 4" label={{ value: `Tube ${inputs.tubeBufferWeeks}wk buffer`, fill: C_GOLD, fontSize: 10, position: "right" }} />
                  <ReferenceLine y={0} stroke={C_RED} strokeWidth={2} />
                  <Line dataKey="inventory" name="Finished Product" stroke={C_NAVY} strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line dataKey="tubes" name="Tubes at AES" stroke={C_GOLD} strokeWidth={2} dot={{ r: 2 }} strokeDasharray="5 3" />
                  <Customized component={(props: any) => (
                    <ProductionRunArrows
                      xAxisMap={props.xAxisMap}
                      yAxisMap={props.yAxisMap}
                      annotations={model.productionAnnotations}
                    />
                  )} />
                </ComposedChart>
              </ResponsiveContainer>
              {model.productionAnnotations.length > 0 && (
                <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span style={{ color: C_PURPLE }}>🏭</span>
                    <span>= Production PO recommendation</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span style={{ color: C_GOLD }}>📦</span>
                    <span>= Tube PO recommendation</span>
                  </div>
                  <span className="italic">(hover for details)</span>
                </div>
              )}
            </CardContent></Card>

            {/* Buffer hit annotation */}
            {model.bufferHitAbsWeek >= 0 && (
              <Card className="border-l-4 border-l-warning mt-3">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-foreground">
                        {weekLabel(model.bufferHitAbsWeek)} — Hits {inputs.minWeeksStock}-week buffer level
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Inventory drops to {(inputs.weeklyVelocity * inputs.minWeeksStock).toLocaleString()} units ({inputs.minWeeksStock} weeks at {inputs.weeklyVelocity.toLocaleString()}/wk). Reorder cycle initiated to maintain stock.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {model.oosAbsWeek >= 0 && (
              <Card className="border-l-4 border-l-destructive mt-3">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-destructive">
                        {weekLabel(model.oosAbsWeek)} — OUT OF STOCK
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Inventory hits zero at current velocity of {inputs.weeklyVelocity.toLocaleString()} units/wk.
                        {model.oosAbsWeek - todayWeek > model.totalLeadWeeks
                          ? ` Production must be initiated by ${weekLabel(model.oosAbsWeek - model.totalLeadWeeks)} to avoid stockout.`
                          : " Immediate action required — lead time exceeds runway."}
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
                                {weekLabel(item.startWeek)} → {weekLabel(item.arriveWeek)}
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
                          Production Cycle #{cascade.cycleId} — triggered {weekLabel(cascade.triggerWeek)}
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



          {/* ── Tab 5: Action Plan ───────────────────────────── */}
          <TabsContent value="actions">
            <SectionHeader sub="Approve or defer each expense — only approved items flow into the cash simulation. Add your own line items.">EXPENSE FORECAST</SectionHeader>
            <Card><CardContent className="pt-4 pb-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 px-2 font-bold text-muted-foreground">Date</th>
                    <th className="text-left py-1.5 px-2 font-bold text-muted-foreground">Description</th>
                    <th className="text-left py-1.5 px-2 font-bold text-muted-foreground">Category</th>
                    <th className="text-right py-1.5 px-2 font-bold text-muted-foreground">Amount</th>
                    <th className="text-center py-1.5 px-2 font-bold text-muted-foreground">Approved</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {model.scheduledExpenses.sort((a, b) => a.weekIndex - b.weekIndex).map((exp) => {
                    const override = expenseOverrides[exp.id];
                    const isManual = exp.id.startsWith("manual-");
                    const manualId = isManual ? exp.id.replace("manual-", "") : "";
                    const manualData = isManual ? manualExpenses.find(me => me.id === manualId) : null;
                    const hasOverride = !isManual && override && Object.keys(override).length > 0;

                    // Effective values (override > original)
                    const effDescription = isManual ? (manualData?.description ?? "") : (override?.description ?? exp.description);
                    const effAmount = isManual ? (manualData?.amount ?? 0) : (override?.amount ?? exp.amount);
                    const effCategory = isManual ? (manualData?.category ?? exp.category) : (override?.category ?? exp.category);
                    const effDateLabel = isManual ? (manualData?.date ?? exp.dateLabel) : (override?.dateLabel ?? exp.dateLabel);

                    const style = CATEGORY_STYLE[effCategory] || CATEGORY_STYLE.tubes;
                    const Icon = style.icon;

                    return (
                      <tr key={exp.id} className={`border-b border-border/50 ${!exp.approved ? "opacity-50" : ""}`}>
                        <td className="py-2 px-2 font-semibold text-foreground">
                          {isManual && manualData ? (
                            <Input type="date" value={manualData.date}
                              onChange={(e) => updateManualExpense(manualId, "date", e.target.value)}
                              className="h-6 text-xs px-1 w-28" />
                          ) : (
                            <Input type="text" value={effDateLabel}
                              onChange={(e) => updateExpenseOverride(exp.id, "dateLabel", e.target.value)}
                              className="h-6 text-xs px-1 w-24" />
                          )}
                        </td>
                        <td className="py-2 px-2 text-foreground">
                          {isManual && manualData ? (
                            <Input value={manualData.description}
                              onChange={(e) => updateManualExpense(manualId, "description", e.target.value)}
                              className="h-6 text-xs px-1" placeholder="Description" />
                          ) : (
                            <Input value={effDescription}
                              onChange={(e) => updateExpenseOverride(exp.id, "description", e.target.value)}
                              className="h-6 text-xs px-1" />
                          )}
                        </td>
                        <td className="py-2 px-2">
                          <Select value={effCategory} onValueChange={(v) => isManual ? updateManualExpense(manualId, "category", v) : updateExpenseOverride(exp.id, "category", v)}>
                            <SelectTrigger className="h-6 text-xs px-1 w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.keys(CATEGORY_STYLE).map(cat => (
                                <SelectItem key={cat} value={cat} className="text-xs capitalize">{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-semibold text-destructive">
                          {isManual && manualData ? (
                            <Input type="number" value={manualData.amount || ""}
                              onChange={(e) => updateManualExpense(manualId, "amount", Number(e.target.value))}
                              className="h-6 text-xs px-1 w-20 text-right font-mono" placeholder="$0" />
                          ) : (
                            <Input type="number" value={effAmount || ""}
                              onChange={(e) => updateExpenseOverride(exp.id, "amount", Number(e.target.value))}
                              className="h-6 text-xs px-1 w-20 text-right font-mono" />
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Switch
                            checked={exp.approved}
                            onCheckedChange={() => toggleApproval(exp.id)}
                            className="scale-75"
                          />
                        </td>
                        <td className="py-1 px-1 flex items-center gap-0.5">
                          {hasOverride && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-accent"
                              onClick={() => resetExpenseOverride(exp.id)} title="Reset to original">
                              <Undo2 className="h-3 w-3" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteExpense(exp.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
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
                    <td></td>
                  </tr>
                </tfoot>
              </table>
              <Button variant="outline" size="sm" className="mt-3 gap-1 text-xs" onClick={addManualExpense}>
                <Plus className="h-3 w-3" /> Add Expense
              </Button>
            </CardContent></Card>

            {model.cascadeActions.length > 0 && (
              <>
                <SectionHeader sub="Full cascade of events for each production cycle">PRODUCTION CASCADES</SectionHeader>
                {model.cascadeActions.map((cascade, ci) => (
                  <Card key={ci} className="mb-3 border-l-4 border-l-accent">
                    <CardContent className="p-4">
                      <div className="text-[11px] font-bold text-accent uppercase tracking-wide mb-3">
                        Cycle #{cascade.cycleId} — {weekLabel(cascade.triggerWeek)}
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
                Cash hits {fmt(model.minCash)} on {weekLabel(model.minCashAbsWeek)}.
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
      </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
