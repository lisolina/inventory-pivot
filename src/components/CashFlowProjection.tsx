import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, isSameDay } from "date-fns";

const chartConfig = {
  projected: { label: "Projected Balance", color: "hsl(var(--accent))" },
};

interface CalendarEvent {
  date: Date;
  type: "inflow" | "outflow";
  description: string;
  amount: number;
}

export const CashFlowProjection = () => {
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [recurring, setRecurring] = useState<any[]>([]);
  const [days, setDays] = useState<30 | 60 | 90>(30);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [cashRes, invRes, expRes, recRes] = await Promise.all([
        supabase.from("cash_entries").select("*").order("date", { ascending: false }).limit(500),
        supabase.from("invoices").select("*").eq("status", "pending"),
        supabase.from("expenses").select("*").eq("status", "upcoming"),
        supabase.from("recurring_expenses").select("*").eq("active", true),
      ]);

      // Calculate current balance
      if (cashRes.data) {
        const withBal = cashRes.data.find((e: any) => e.balance_after !== null);
        if (withBal) {
          let bal = Number(withBal.balance_after);
          const balDate = new Date(withBal.date).getTime();
          cashRes.data.forEach((e: any) => {
            if (new Date(e.date).getTime() > balDate && e.balance_after === null) {
              if (e.type === "in") bal += Number(e.amount);
              else if (e.type === "out") bal -= Number(e.amount);
            }
          });
          setCurrentBalance(bal);
        }
      }

      if (invRes.data) setInvoices(invRes.data);
      if (expRes.data) setExpenses(expRes.data);
      if (recRes.data) setRecurring(recRes.data);
    };
    fetchData();
  }, []);

  const projectionData = useMemo(() => {
    const today = new Date();
    const events: CalendarEvent[] = [];
    const dailyFlows: Record<string, { inflow: number; outflow: number }> = {};

    const addFlow = (dateStr: string, type: "inflow" | "outflow", amount: number, desc: string) => {
      const key = dateStr.slice(0, 10);
      if (!dailyFlows[key]) dailyFlows[key] = { inflow: 0, outflow: 0 };
      dailyFlows[key][type] += amount;
      events.push({ date: new Date(key + "T00:00:00"), type, description: desc, amount });
    };

    // Pending invoices (inflows)
    invoices.forEach((inv) => {
      if (inv.due_date) addFlow(inv.due_date, "inflow", Number(inv.amount), `Invoice: ${inv.customer}`);
    });

    // Upcoming expenses (outflows)
    expenses.forEach((exp) => {
      if (exp.date) addFlow(exp.date, "outflow", Number(exp.amount), exp.description);
    });

    // Recurring expenses projected forward
    recurring.forEach((rec) => {
      let nextDate = rec.next_due_date ? new Date(rec.next_due_date) : new Date();
      const endDate = addDays(today, days);
      while (nextDate <= endDate) {
        if (nextDate >= today) {
          addFlow(nextDate.toISOString(), "outflow", Number(rec.amount), `Recurring: ${rec.name}`);
        }
        if (rec.frequency === "weekly") nextDate = addDays(nextDate, 7);
        else if (rec.frequency === "monthly") { nextDate = new Date(nextDate); nextDate.setMonth(nextDate.getMonth() + 1); }
        else { nextDate = new Date(nextDate); nextDate.setMonth(nextDate.getMonth() + 3); }
      }
    });

    setCalendarEvents(events);

    // Build daily projection
    const data: { date: string; projected: number }[] = [];
    let runningBalance = currentBalance;
    for (let i = 0; i <= days; i++) {
      const d = addDays(today, i);
      const key = format(d, "yyyy-MM-dd");
      const flow = dailyFlows[key];
      if (flow) {
        runningBalance += flow.inflow - flow.outflow;
      }
      data.push({ date: format(d, "MMM d"), projected: Math.round(runningBalance) });
    }
    return data;
  }, [currentBalance, invoices, expenses, recurring, days]);

  const selectedDateEvents = selectedDate
    ? calendarEvents.filter((e) => isSameDay(e.date, selectedDate))
    : [];

  // Dates with events for calendar modifiers
  const inflowDates = calendarEvents.filter((e) => e.type === "inflow").map((e) => e.date);
  const outflowDates = calendarEvents.filter((e) => e.type === "outflow").map((e) => e.date);

  return (
    <div className="space-y-4">
      {/* Projection Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Cash Flow Projection</CardTitle>
          <div className="flex gap-1">
            {([30, 60, 90] as const).map((d) => (
              <Button key={d} size="sm" variant={days === d ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => setDays(d)}>
                {d}d
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {projectionData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No projection data available.</p>
          ) : (
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <LineChart data={projectionData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(days / 8)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="projected" stroke="var(--color-projected)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Inflow/Outflow Calendar */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Inflow / Outflow Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              modifiers={{ inflow: inflowDates, outflow: outflowDates }}
              modifiersClassNames={{
                inflow: "bg-success/20 text-success font-bold",
                outflow: "bg-destructive/20 text-destructive font-bold",
              }}
              className="rounded-md border"
            />
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-success/40" /> Inflow</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-destructive/40" /> Outflow</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {selectedDate ? format(selectedDate, "MMM d, yyyy") : "Select a date"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDateEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                {selectedDate ? "No events on this date" : "Click a date to see expected inflows and outflows"}
              </p>
            ) : (
              <div className="space-y-2">
                {selectedDateEvents.map((evt, i) => (
                  <div key={i} className="flex items-center justify-between border rounded p-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={evt.type === "inflow" ? "default" : "destructive"} className="text-xs">
                        {evt.type === "inflow" ? "IN" : "OUT"}
                      </Badge>
                      <span className="text-sm">{evt.description}</span>
                    </div>
                    <span className={`text-sm font-medium ${evt.type === "inflow" ? "text-success" : "text-destructive"}`}>
                      {evt.type === "inflow" ? "+" : "-"}${Number(evt.amount).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
