import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { RefreshCw, Trash2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  next_due_date: string | null;
  category: string;
  active: boolean;
}

export const RecurringExpenses = () => {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [detecting, setDetecting] = useState(false);

  const fetchRecurring = async () => {
    const { data } = await supabase.from("recurring_expenses").select("*").order("name");
    if (data) setExpenses(data as any);
  };

  useEffect(() => { fetchRecurring(); }, []);

  const detectRecurring = async () => {
    setDetecting(true);
    try {
      // Fetch all cash entries with descriptions
      const { data: entries } = await supabase.from("cash_entries").select("description, amount, date, type")
        .eq("type", "out").not("description", "is", null).order("date", { ascending: false }).limit(1000);

      if (!entries || entries.length === 0) {
        toast({ title: "No Data", description: "No cash entries to analyze" });
        return;
      }

      // Group by normalized description
      const groups: Record<string, { amounts: number[]; dates: string[] }> = {};
      entries.forEach((e: any) => {
        const key = (e.description || "").toUpperCase().trim().replace(/\s+/g, " ")
          .replace(/\d{1,2}\/\d{1,2}\/?\d{0,4}/g, "").trim(); // strip dates from desc
        if (!key || key.length < 3) return;
        if (!groups[key]) groups[key] = { amounts: [], dates: [] };
        groups[key].amounts.push(Number(e.amount));
        groups[key].dates.push(e.date);
      });

      // Find recurring: appeared 2+ times with similar amounts
      const detected: { name: string; amount: number; frequency: string }[] = [];
      Object.entries(groups).forEach(([name, { amounts, dates }]) => {
        if (amounts.length < 2) return;
        const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
        const maxDev = Math.max(...amounts.map(a => Math.abs(a - avgAmount)));
        if (maxDev > avgAmount * 0.3) return; // amounts vary too much

        // Determine frequency based on date gaps
        const sortedDates = dates.map(d => new Date(d).getTime()).sort((a, b) => a - b);
        const gaps = [];
        for (let i = 1; i < sortedDates.length; i++) {
          gaps.push((sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24));
        }
        const avgGap = gaps.length > 0 ? gaps.reduce((s, g) => s + g, 0) / gaps.length : 30;
        const frequency = avgGap < 14 ? "weekly" : avgGap < 45 ? "monthly" : "quarterly";

        detected.push({ name, amount: Math.round(avgAmount * 100) / 100, frequency });
      });

      // Upsert detected recurring expenses
      for (const d of detected) {
        const { data: existing } = await supabase.from("recurring_expenses")
          .select("id").eq("name", d.name).maybeSingle();
        if (!existing) {
          // Calculate next due date (approximate: today + frequency gap)
          const nextDue = new Date();
          if (d.frequency === "weekly") nextDue.setDate(nextDue.getDate() + 7);
          else if (d.frequency === "monthly") nextDue.setMonth(nextDue.getMonth() + 1);
          else nextDue.setMonth(nextDue.getMonth() + 3);

          await supabase.from("recurring_expenses").insert({
            name: d.name, amount: d.amount, frequency: d.frequency,
            next_due_date: nextDue.toISOString(), category: "subscription",
          });
        }
      }

      toast({ title: "Detection Complete", description: `Found ${detected.length} potential recurring expenses` });
      fetchRecurring();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDetecting(false);
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("recurring_expenses").update({ active: !active }).eq("id", id);
    fetchRecurring();
  };

  const deleteRecurring = async (id: string) => {
    await supabase.from("recurring_expenses").delete().eq("id", id);
    fetchRecurring();
    toast({ title: "Deleted" });
  };

  const totalMonthly = expenses.filter(e => e.active).reduce((sum, e) => {
    if (e.frequency === "weekly") return sum + e.amount * 4.33;
    if (e.frequency === "quarterly") return sum + e.amount / 3;
    return sum + e.amount;
  }, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Recurring Expenses</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline">${Math.round(totalMonthly).toLocaleString()}/mo</Badge>
          <Button size="sm" variant="outline" onClick={detectRecurring} disabled={detecting}>
            <RefreshCw className={`h-4 w-4 mr-1 ${detecting ? "animate-spin" : ""}`} />
            Detect
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {expenses.length === 0 ? (
          <p className="text-center text-muted-foreground py-4 text-sm">
            No recurring expenses detected yet. Click "Detect" to scan your bank statements.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((exp) => (
                <TableRow key={exp.id} className={exp.active ? "" : "opacity-50"}>
                  <TableCell className="font-medium text-sm">{exp.name}</TableCell>
                  <TableCell className="text-right text-sm">${Number(exp.amount).toLocaleString()}</TableCell>
                  <TableCell className="capitalize text-sm">{exp.frequency}</TableCell>
                  <TableCell className="text-sm">
                    {exp.next_due_date ? new Date(exp.next_due_date).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={exp.active ? "default" : "secondary"}>
                      {exp.active ? "Active" : "Paused"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(exp.id, exp.active)}>
                        {exp.active ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteRecurring(exp.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
