import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Package, ShoppingCart, TrendingUp, AlertTriangle, Check, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SourceLink from "@/components/SourceLink";
import { useAiRefresh } from "@/hooks/use-ai-refresh";
import { useCallback } from "react";
import { TasksTile } from "@/components/TasksTile";
import { CashFlowChart } from "@/components/CashFlowChart";
import { StaleDataBanners } from "@/components/StaleDataBanners";

interface DashboardTabProps {
  onNavigate?: (tab: string) => void;
}

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  subtitle?: string;
  onClick?: () => void;
}

const MetricCard = ({ title, value, icon: Icon, subtitle, onClick }: MetricCardProps) => (
  <Card className={onClick ? "cursor-pointer hover:border-accent/50 transition-colors" : ""} onClick={onClick}>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className="h-4 w-4 text-accent" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </CardContent>
  </Card>
);

interface InventorySnapshot {
  product_name: string;
  units_on_hand: string;
  cases_on_hand: string;
}

interface AlertItem {
  id: string;
  text: string;
}

export const DashboardTab = ({ onNavigate }: DashboardTabProps) => {
  const [metrics, setMetrics] = useState({
    cashOnHand: "—",
    inventoryValue: "—",
    openOrders: "0",
    weekRevenue: "—",
  });
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("dismissedAlerts") || "[]"); } catch { return []; }
  });
  const [inventorySnapshot, setInventorySnapshot] = useState<InventorySnapshot[]>([]);

  useEffect(() => {
    localStorage.setItem("dismissedAlerts", JSON.stringify(dismissedAlerts));
  }, [dismissedAlerts]);

  const fetchMetrics = useCallback(async () => {
      const [orderCountRes, cashRes, invRes, revenueRes, dueInvRes] = await Promise.all([
        supabase.from("orders").select("*", { count: "exact", head: true }).in("status", ["new", "processing"]),
        supabase.from("cash_entries").select("date, type, amount, balance_after").order("date", { ascending: false }).limit(500),
        supabase.from("inventory_items").select("product_name, units_on_hand, cases_on_hand, stock_value, category"),
        supabase.from("orders").select("total_value").gte("order_date", new Date(Date.now() - 7 * 86400000).toISOString()),
        supabase.from("invoices").select("id, customer, amount, due_date").eq("status", "pending").lte("due_date", new Date(Date.now() + 7 * 86400000).toISOString()),
      ]);

      const finishedItems = (invRes.data || []).filter((item: any) => {
        const cat = ((item as any).category || "").toLowerCase().trim();
        return cat === "pasta" || cat === "dust";
      });
      setInventorySnapshot(finishedItems.map((i: any) => ({
        product_name: i.product_name,
        units_on_hand: i.units_on_hand || "0",
        cases_on_hand: i.cases_on_hand || "0",
      })));

      let totalInvValue = 0;
      finishedItems.forEach((item: any) => {
        const val = parseFloat(item.stock_value?.replace(/[^0-9.-]/g, "") || "0");
        if (!isNaN(val)) totalInvValue += val;
      });

      let weekRevenue = 0;
      revenueRes.data?.forEach((o) => { weekRevenue += Number(o.total_value || 0); });

      const alertList: AlertItem[] = [];
      dueInvRes.data?.forEach((inv: any) => {
        const days = Math.ceil((new Date(inv.due_date).getTime() - Date.now()) / 86400000);
        let text = "";
        if (days < 0) text = `⚠️ ${inv.customer} invoice ($${inv.amount}) is ${Math.abs(days)} days overdue`;
        else if (days <= 2) text = `🔴 ${inv.customer} invoice ($${inv.amount}) due in ${days} day(s)`;
        else text = `🟡 ${inv.customer} invoice ($${inv.amount}) due in ${days} days`;
        alertList.push({ id: inv.id, text });
      });

      // Cash on hand with pending charges
      let cashOnHand: number | null = null;
      const cashData = cashRes.data || [];
      const withBalance = cashData.find((e: any) => e.balance_after !== null);
      if (withBalance) {
        cashOnHand = Number((withBalance as any).balance_after);
        // Apply pending charges after the last reported balance date
        const balanceDate = new Date((withBalance as any).date).getTime();
        cashData.forEach((e: any) => {
          if (new Date(e.date).getTime() > balanceDate && e.balance_after === null) {
            if (e.type === "in") cashOnHand! += Number(e.amount);
            else if (e.type === "out") cashOnHand! -= Number(e.amount);
          }
        });
      } else if (cashData.length > 0) {
        let running = 0;
        const sorted = [...cashData].reverse();
        sorted.forEach((e: any) => {
          if (e.type === "in") running += Number(e.amount);
          else if (e.type === "out") running -= Number(e.amount);
        });
        cashOnHand = running;
      }

      setMetrics({
        cashOnHand: cashOnHand !== null ? `$${cashOnHand.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—",
        inventoryValue: totalInvValue > 0 ? `$${totalInvValue.toLocaleString()}` : "—",
        openOrders: String(orderCountRes.count || 0),
        weekRevenue: weekRevenue > 0 ? `$${weekRevenue.toLocaleString()}` : "—",
      });
      setAlerts(alertList);
  }, []);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);
  useAiRefresh(fetchMetrics);

  const visibleAlerts = alerts.filter((a) => !dismissedAlerts.includes(a.id));

  const dismissAlert = (id: string) => setDismissedAlerts((prev) => [...prev, id]);
  const deleteAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    dismissAlert(id);
  };

  return (
    <div className="space-y-6">
      <StaleDataBanners />
      <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground">
        <span>Sources:</span>
        <SourceLink source="cash" withLabel /> · <SourceLink source="inventory" withLabel /> · <SourceLink source="orders" withLabel /> · <SourceLink source="qboReports" withLabel />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Cash on Hand" value={metrics.cashOnHand} icon={DollarSign} subtitle="Includes pending charges" onClick={() => onNavigate?.("money")} />
        <MetricCard title="Inventory Value" value={metrics.inventoryValue} icon={Package} subtitle="Finished products only" />
        <MetricCard title="Open Orders" value={metrics.openOrders} icon={ShoppingCart} onClick={() => onNavigate?.("orders")} />
        <MetricCard title="This Week's Revenue" value={metrics.weekRevenue} icon={TrendingUp} subtitle="Revenue booked (not cash in)" onClick={() => onNavigate?.("money")} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-accent" />
            Inventory Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent>
          {inventorySnapshot.length === 0 ? (
            <p className="text-sm text-muted-foreground">No inventory data. Sync from Google Sheets in the Inventory tab.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Cases</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventorySnapshot.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">{item.product_name}</TableCell>
                    <TableCell className="text-right text-sm">{item.units_on_hand}</TableCell>
                    <TableCell className="text-right text-sm">{item.cases_on_hand}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <TasksTile />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Alerts & Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {visibleAlerts.length === 0 ? (
              <p className="text-muted-foreground text-sm">No alerts right now. You're all caught up! 🎉</p>
            ) : (
              <ul className="space-y-2">
                {visibleAlerts.map((alert) => (
                  <li key={alert.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0 group">
                    <span>{alert.text}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => dismissAlert(alert.id)}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteAlert(alert.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <CashFlowChart />
    </div>
  );
};
