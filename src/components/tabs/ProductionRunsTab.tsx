import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Check } from "lucide-react";
import { EditableCell } from "@/components/EditableCell";
import { cn } from "@/lib/utils";

const STAGES = [
  "planning",
  "tubes_ordered",
  "tubes_in_transit",
  "tubes_at_aes",
  "ingredients_staged",
  "packing",
  "finished_goods",
  "shipped",
  "complete",
] as const;
type Stage = typeof STAGES[number];

const STAGE_DATE_FIELD: Partial<Record<Stage, string>> = {
  tubes_ordered: "tubes_ordered_date",
  tubes_in_transit: "tubes_landed_date",
  ingredients_staged: "ingredients_staged_date",
  packing: "aes_pack_start",
  finished_goods: "aes_pack_complete",
  shipped: "shipped_date",
};

type Run = {
  id: string;
  run_id: string;
  run_name: string;
  product_line: string | null;
  skus: string[] | null;
  target_units: number;
  actual_units: number;
  expected_revenue: number;
  stage: Stage;
  notes: string | null;
};

type Cost = {
  id: string;
  run_id: string;
  expense_type: string | null;
  vendor: string | null;
  amount: number;
  date_due: string | null;
  date_paid: string | null;
  status: string | null;
  notes: string | null;
};

function stageBadgeColor(stage: Stage) {
  if (stage === "complete") return "bg-green-600 text-white";
  if (stage === "planning") return "bg-muted text-muted-foreground";
  return "bg-blue-600 text-white";
}

export function ProductionRunsTab() {
  const { toast } = useToast();
  const [runs, setRuns] = useState<Run[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [r, c] = await Promise.all([
      supabase.from("production_runs").select("*").order("created_at"),
      supabase.from("production_run_costs").select("*").order("date_due"),
    ]);
    if (r.error) toast({ title: "Failed to load runs", description: r.error.message, variant: "destructive" });
    if (c.error) toast({ title: "Failed to load costs", description: c.error.message, variant: "destructive" });
    setRuns((r.data as Run[]) ?? []);
    setCosts((c.data as Cost[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const advanceStage = async (run: Run, target: Stage) => {
    const patch: any = { stage: target };
    const dateField = STAGE_DATE_FIELD[target];
    if (dateField) patch[dateField] = new Date().toISOString();
    setRuns((prev) => prev.map((r) => (r.id === run.id ? { ...r, stage: target } : r)));
    const { error } = await supabase.from("production_runs").update(patch).eq("id", run.id);
    if (error) {
      toast({ title: "Failed to advance", description: error.message, variant: "destructive" });
      load();
    }
  };

  const updateRun = async (id: string, patch: Partial<Run>) => {
    setRuns((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("production_runs").update(patch).eq("id", id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
  };

  const deleteRun = async (id: string, run_id: string) => {
    if (!confirm(`Delete run ${run_id}? This removes all its costs too.`)) return;
    setRuns((p) => p.filter((r) => r.id !== id));
    setCosts((p) => p.filter((c) => c.run_id !== run_id));
    await supabase.from("production_runs").delete().eq("id", id);
  };

  const addCost = async (runId: string) => {
    const { data, error } = await supabase.from("production_run_costs").insert({
      run_id: runId, expense_type: "New cost", amount: 0, status: "pending",
    }).select().single();
    if (error) return toast({ title: "Add failed", description: error.message, variant: "destructive" });
    setCosts((p) => [...p, data as Cost]);
  };

  const updateCost = async (id: string, patch: Partial<Cost>) => {
    setCosts((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const { error } = await supabase.from("production_run_costs").update(patch).eq("id", id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
  };

  const removeCost = async (id: string) => {
    setCosts((p) => p.filter((c) => c.id !== id));
    await supabase.from("production_run_costs").delete().eq("id", id);
  };

  const costsByRun = useMemo(() => {
    const m: Record<string, Cost[]> = {};
    for (const c of costs) (m[c.run_id] ||= []).push(c);
    return m;
  }, [costs]);

  if (loading) return <div className="text-muted-foreground p-8">Loading production runs…</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Production Runs</h2>
        <NewRunDialog onCreated={load} />
      </div>

      {runs.length === 0 && <div className="text-muted-foreground italic">No production runs yet — add one to get started.</div>}

      {runs.map((run) => {
        const stageIdx = STAGES.indexOf(run.stage);
        return (
          <Card key={run.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="font-mono text-base">{run.run_id}</span>
                    <span className="text-muted-foreground">·</span>
                    <EditableCell value={run.run_name} required onSave={(v) => updateRun(run.id, { run_name: v })} />
                    <Badge className={stageBadgeColor(run.stage)}>{run.stage.replace(/_/g, " ")}</Badge>
                  </CardTitle>
                  <div className="text-sm text-muted-foreground mt-1">
                    {run.product_line || "—"}
                    {run.skus && run.skus.length > 0 && <> · SKUs: {run.skus.join(", ")}</>}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => deleteRun(run.id, run.run_id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Target units</Label>
                  <EditableCell value={run.target_units} type="number" onSave={(v) => updateRun(run.id, { target_units: parseInt(v) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Actual units</Label>
                  <EditableCell value={run.actual_units} type="number" onSave={(v) => updateRun(run.id, { actual_units: parseInt(v) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Expected revenue</Label>
                  <EditableCell value={run.expected_revenue} type="number" display={(v) => `$${Number(v).toLocaleString()}`} onSave={(v) => updateRun(run.id, { expected_revenue: parseFloat(v) || 0 })} />
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Stage progress</Label>
                <div className="flex flex-wrap gap-1 mt-2">
                  {STAGES.map((s, i) => {
                    const reached = i <= stageIdx;
                    const current = i === stageIdx;
                    return (
                      <button
                        key={s}
                        onClick={() => advanceStage(run, s)}
                        className={cn(
                          "text-xs px-2 py-1 rounded border transition-colors",
                          current && "bg-primary text-primary-foreground border-primary",
                          !current && reached && "bg-blue-100 dark:bg-blue-950/40 border-blue-300",
                          !reached && "bg-muted/50 border-border text-muted-foreground hover:bg-accent/40"
                        )}
                      >
                        {reached && <Check className="h-3 w-3 inline mr-1" />}
                        {s.replace(/_/g, " ")}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs text-muted-foreground">Costs</Label>
                  <Button size="sm" variant="outline" onClick={() => addCost(run.run_id)}>
                    <Plus className="h-3 w-3 mr-1" /> Add cost
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(costsByRun[run.run_id] ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-muted-foreground italic">No costs logged</TableCell></TableRow>
                    )}
                    {(costsByRun[run.run_id] ?? []).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell><EditableCell value={c.expense_type ?? ""} onSave={(v) => updateCost(c.id, { expense_type: v })} /></TableCell>
                        <TableCell><EditableCell value={c.vendor ?? ""} onSave={(v) => updateCost(c.id, { vendor: v })} /></TableCell>
                        <TableCell className="text-right"><EditableCell value={c.amount} type="number" display={(v) => `$${Number(v).toLocaleString()}`} onSave={(v) => updateCost(c.id, { amount: parseFloat(v) || 0 })} /></TableCell>
                        <TableCell><EditableCell value={c.date_due ? c.date_due.slice(0, 10) : ""} onSave={(v) => updateCost(c.id, { date_due: v ? new Date(v).toISOString() : null })} /></TableCell>
                        <TableCell><EditableCell value={c.status ?? ""} onSave={(v) => updateCost(c.id, { status: v })} /></TableCell>
                        <TableCell><Button size="icon" variant="ghost" onClick={() => removeCost(c.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function NewRunDialog({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [runId, setRunId] = useState("");
  const [name, setName] = useState("");
  const [productLine, setProductLine] = useState("");
  const [target, setTarget] = useState("");
  const [revenue, setRevenue] = useState("");

  const submit = async () => {
    if (!runId.trim() || !name.trim()) {
      toast({ title: "Run ID and name are required", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("production_runs").insert({
      run_id: runId.trim(),
      run_name: name.trim(),
      product_line: productLine.trim() || null,
      target_units: parseInt(target) || 0,
      expected_revenue: parseFloat(revenue) || 0,
      stage: "planning",
    });
    if (error) return toast({ title: "Create failed", description: error.message, variant: "destructive" });
    setOpen(false);
    setRunId(""); setName(""); setProductLine(""); setTarget(""); setRevenue("");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New run</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New production run</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Run ID (e.g. SD0010)</Label><Input value={runId} onChange={(e) => setRunId(e.target.value)} /></div>
          <div><Label>Run name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Product line</Label><Input value={productLine} onChange={(e) => setProductLine(e.target.value)} placeholder="e.g. Spaghetti Dust" /></div>
          <div><Label>Target units</Label><Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
          <div><Label>Expected revenue</Label><Input type="number" value={revenue} onChange={(e) => setRevenue(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ProductionRunsTab;