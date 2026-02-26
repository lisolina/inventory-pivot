import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";

type TimeRange = "week" | "month" | "quarter" | "year";

interface CashEntry {
  date: string;
  type: string;
  amount: number;
  balance_after: number | null;
}

const chartConfig = {
  cashIn: { label: "Cash In", color: "hsl(var(--success))" },
  cashOut: { label: "Cash Out", color: "hsl(var(--destructive))" },
  balance: { label: "Balance", color: "hsl(var(--accent))" },
};

export const CashFlowChart = () => {
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [range, setRange] = useState<TimeRange>("month");

  useEffect(() => {
    const fetchEntries = async () => {
      const now = new Date();
      const start = new Date();
      if (range === "week") start.setDate(now.getDate() - 7);
      else if (range === "month") start.setDate(now.getDate() - 30);
      else if (range === "quarter") start.setMonth(now.getMonth() - 3);
      else start.setFullYear(now.getFullYear() - 1);

      const { data } = await supabase
        .from("cash_entries")
        .select("date, type, amount, balance_after")
        .gte("date", start.toISOString())
        .order("date", { ascending: true });

      if (data) setEntries(data);
    };
    fetchEntries();
  }, [range]);

  const chartData = useMemo(() => {
    const byDate: Record<string, { cashIn: number; cashOut: number; balance: number | null }> = {};

    entries.forEach((e) => {
      const day = new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (!byDate[day]) byDate[day] = { cashIn: 0, cashOut: 0, balance: null };
      if (e.type === "in") byDate[day].cashIn += Number(e.amount);
      else if (e.type === "out") byDate[day].cashOut += Number(e.amount);
      if (e.balance_after !== null) byDate[day].balance = Number(e.balance_after);
    });

    return Object.entries(byDate).map(([date, vals]) => ({
      date,
      cashIn: vals.cashIn,
      cashOut: vals.cashOut,
      balance: vals.balance,
    }));
  }, [entries]);

  const ranges: { key: TimeRange; label: string }[] = [
    { key: "week", label: "1W" },
    { key: "month", label: "1M" },
    { key: "quarter", label: "3M" },
    { key: "year", label: "1Y" },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">Cash Flow</CardTitle>
        <div className="flex gap-1">
          {ranges.map((r) => (
            <Button
              key={r.key}
              size="sm"
              variant={range === r.key ? "default" : "outline"}
              className="h-7 px-2 text-xs"
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">
            No cash flow data yet. Add entries in the Money tab.
          </p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} className="text-muted-foreground" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="cashIn" fill="var(--color-cashIn)" radius={[2, 2, 0, 0]} barSize={16} />
              <Bar dataKey="cashOut" fill="var(--color-cashOut)" radius={[2, 2, 0, 0]} barSize={16} />
              <Line type="monotone" dataKey="balance" stroke="var(--color-balance)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};
