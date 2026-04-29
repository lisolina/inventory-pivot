import { Fragment, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { EditableCell } from "@/components/EditableCell";
import { cn } from "@/lib/utils";

type Balance = { id: string; date: string; balance: number; notes: string | null };
type Flow = {
  id: string; week_starting: string; description: string | null; category: string | null;
  inflow: number; outflow: number; status: string | null; notes: string | null;
};

const FLOOR_KEY = "operating_floor_usd";

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function rowColor(ending: number, floor: number) {
  if (ending < 0) return "bg-red-50 dark:bg-red-950/20";
  if (ending < floor) return "bg-red-50 dark:bg-red-950/20";
  if (ending < floor + 5000) return "bg-amber-50 dark:bg-amber-950/20";
  return "bg-green-50 dark:bg-green-950/20";
}

export function BankWeeklyTab() {
  const { toast } = useToast();
  const [latestBalance, setLatestBalance] = useState<Balance | null>(null);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [floor, setFloor] = useState<number>(() => {
    const v = typeof window !== "undefined" ? localStorage.getItem(FLOOR_KEY) : null;
    return v ? parseFloat(v) : 15000;
  });
  const [newBalance, setNewBalance] = useState("");
  const [newBalanceDate, setNewBalanceDate] = useState(fmtDate(new Date()));

  const load = async () => {
    setLoading(true);
    const today = new Date();
    const eightWeeksOut = new Date(today);
    eightWeeksOut.setDate(today.getDate() + 56);
    const [b, f] = await Promise.all([
      supabase.from("cash_balance").select("*").order("date", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("cash_flows").select("*")
        .gte("week_starting", fmtDate(startOfWeek(today)))
        .lte("week_starting", fmtDate(eightWeeksOut))
        .order("week_starting"),
    ]);
    if (b.error) toast({ title: "Failed to load balance", description: b.error.message, variant: "destructive" });
    if (f.error) toast({ title: "Failed to load flows", description: f.error.message, variant: "destructive" });
    setLatestBalance(b.data as Balance | null);
    setFlows((f.data as Flow[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => { localStorage.setItem(FLOOR_KEY, String(floor)); }, [floor]);

  const updateBalance = async () => {
    const n = parseFloat(newBalance);
    if (isNaN(n)) return;
    const { data, error } = await supabase.from("cash_balance").insert({
      date: newBalanceDate, balance: n,
    }).select().single();
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    setLatestBalance(data as Balance);
    setNewBalance("");
    toast({ title: "Bank balance updated" });
  };

  const updateFlow = async (id: string, patch: Partial<Flow>) => {
    setFlows((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("cash_flows").update(patch).eq("id", id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
  };
  const removeFlow = async (id: string) => {
    setFlows((p) => p.filter((r) => r.id !== id));
    await supabase.from("cash_flows").delete().eq("id", id);
  };

  const weeks = useMemo(() => {
    const start = startOfWeek(new Date());
    const arr: { week: string; rows: Flow[] }[] = [];
    for (let i = 0; i < 8; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i * 7);
      const key = fmtDate(d);
      arr.push({ week: key, rows: flows.filter((f) => f.week_starting === key) });
    }
    return arr;
  }, [flows]);

  const startBalance = latestBalance?.balance ?? 0;

  const weeklyTotals = useMemo(() => {
    let running = startBalance;
    return weeks.map(({ week, rows }) => {
      const inflow = rows.reduce((s, r) => s + Number(r.inflow || 0), 0);
      const outflow = rows.reduce((s, r) => s + Number(r.outflow || 0), 0);
      running = running + inflow - outflow;
      return { week, rows, inflow, outflow, ending: running };
    });
  }, [weeks, startBalance]);

  if (loading) return <div className="text-muted-foreground p-8">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Bank Balance</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${(latestBalance?.balance ?? 0).toLocaleString()}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {latestBalance ? `As of ${latestBalance.date}` : "No balance recorded yet"}
            </div>
            <div className="flex gap-2 mt-4">
              <Input type="date" value={newBalanceDate} onChange={(e) => setNewBalanceDate(e.target.value)} className="w-40" />
              <Input type="number" placeholder="$" value={newBalance} onChange={(e) => setNewBalance(e.target.value)} />
              <Button onClick={updateBalance}>Update</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Operating Floor</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${floor.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground mt-1">Never drop below this</div>
            <div className="flex gap-2 mt-4 items-center">
              <Label>Set floor:</Label>
              <Input type="number" value={floor} onChange={(e) => setFloor(parseFloat(e.target.value) || 0)} className="w-40" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>8-Week Cash Projection</CardTitle>
          <NewFlowDialog onCreated={load} />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week of</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Inflow</TableHead>
                <TableHead className="text-right">Outflow</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ending</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weeklyTotals.map(({ week, rows, inflow, outflow, ending }) => (
                <Fragment key={week}>
                  <TableRow className={cn("font-semibold", rowColor(ending, floor))}>
                    <TableCell>{week}</TableCell>
                    <TableCell colSpan={2} className="text-muted-foreground">Week summary</TableCell>
                    <TableCell className="text-right font-mono">${inflow.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">${outflow.toLocaleString()}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-mono">${ending.toLocaleString()}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell></TableCell>
                      <TableCell><EditableCell value={r.description ?? ""} onSave={(v) => updateFlow(r.id, { description: v })} /></TableCell>
                      <TableCell><EditableCell value={r.category ?? ""} onSave={(v) => updateFlow(r.id, { category: v })} /></TableCell>
                      <TableCell className="text-right"><EditableCell value={r.inflow} type="number" display={(v) => `$${Number(v).toLocaleString()}`} onSave={(v) => updateFlow(r.id, { inflow: parseFloat(v) || 0 })} /></TableCell>
                      <TableCell className="text-right"><EditableCell value={r.outflow} type="number" display={(v) => `$${Number(v).toLocaleString()}`} onSave={(v) => updateFlow(r.id, { outflow: parseFloat(v) || 0 })} /></TableCell>
                      <TableCell><EditableCell value={r.status ?? ""} onSave={(v) => updateFlow(r.id, { status: v })} /></TableCell>
                      <TableCell></TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => removeFlow(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function NewFlowDialog({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [week, setWeek] = useState(fmtDate(startOfWeek(new Date())));
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("");
  const [inflow, setInflow] = useState("");
  const [outflow, setOutflow] = useState("");
  const [status, setStatus] = useState("forecast");

  const submit = async () => {
    const { error } = await supabase.from("cash_flows").insert({
      week_starting: week, description: desc || null, category: cat || null,
      inflow: parseFloat(inflow) || 0, outflow: parseFloat(outflow) || 0, status,
    });
    if (error) return toast({ title: "Create failed", description: error.message, variant: "destructive" });
    setOpen(false);
    setDesc(""); setCat(""); setInflow(""); setOutflow("");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add entry</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add cash flow entry</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Week starting</Label><Input type="date" value={week} onChange={(e) => setWeek(e.target.value)} /></div>
          <div><Label>Description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div><Label>Category</Label><Input value={cat} onChange={(e) => setCat(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Inflow $</Label><Input type="number" value={inflow} onChange={(e) => setInflow(e.target.value)} /></div>
            <div><Label>Outflow $</Label><Input type="number" value={outflow} onChange={(e) => setOutflow(e.target.value)} /></div>
          </div>
          <div><Label>Status</Label><Input value={status} onChange={(e) => setStatus(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BankWeeklyTab;