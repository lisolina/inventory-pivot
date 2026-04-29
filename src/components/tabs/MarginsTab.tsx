import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import SourceLink from "@/components/SourceLink";
import { useAiRefresh } from "@/hooks/use-ai-refresh";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { EditableCell } from "@/components/EditableCell";
import { cn } from "@/lib/utils";

type Margin = {
  id: string;
  product_line: string;
  channel: string;
  landed_cogs: number;
  net_price_per_unit: number;
  fulfillment_fees_per_unit: number;
  cm_dollars: number;
  cm_percent: number;
  notes: string | null;
};

const PRODUCT_LINES = ["Spaghetti Dust", "Pasta"];

function recompute(net: number, cogs: number, fees: number) {
  const cm = net - cogs - fees;
  const pct = net > 0 ? (cm / net) * 100 : 0;
  return { cm_dollars: Number(cm.toFixed(2)), cm_percent: Number(pct.toFixed(1)) };
}

function cmRowClass(pct: number) {
  if (pct >= 60) return "bg-green-50 dark:bg-green-950/20";
  if (pct >= 45) return "";
  return "bg-amber-50 dark:bg-amber-950/20";
}

export function MarginsTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Margin[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("channel_margins").select("*").order("product_line").order("channel");
    if (error) toast({ title: "Failed to load margins", description: error.message, variant: "destructive" });
    setRows((data as Margin[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useAiRefresh(load);

  const grouped = useMemo(() => {
    const m: Record<string, Margin[]> = {};
    for (const pl of PRODUCT_LINES) m[pl] = [];
    for (const r of rows) (m[r.product_line] ||= []).push(r);
    return m;
  }, [rows]);

  const updateField = async (id: string, patch: Partial<Margin>) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const merged = { ...row, ...patch };
    const recalc = recompute(Number(merged.net_price_per_unit) || 0, Number(merged.landed_cogs) || 0, Number(merged.fulfillment_fees_per_unit) || 0);
    const final = { ...merged, ...recalc, last_updated: new Date().toISOString() };
    setRows((prev) => prev.map((r) => (r.id === id ? final : r)));
    const { error } = await supabase.from("channel_margins").update({
      product_line: final.product_line,
      channel: final.channel,
      landed_cogs: final.landed_cogs,
      net_price_per_unit: final.net_price_per_unit,
      fulfillment_fees_per_unit: final.fulfillment_fees_per_unit,
      cm_dollars: final.cm_dollars,
      cm_percent: final.cm_percent,
      notes: final.notes,
      last_updated: final.last_updated,
    }).eq("id", id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      load();
    }
  };

  const remove = async (id: string) => {
    setRows((p) => p.filter((r) => r.id !== id));
    await supabase.from("channel_margins").delete().eq("id", id);
  };

  const bulkUpdateCogs = async (productLine: string, newCogs: number) => {
    const ids = rows.filter((r) => r.product_line === productLine).map((r) => r.id);
    for (const id of ids) await updateField(id, { landed_cogs: newCogs });
    toast({ title: `COGS updated for ${productLine}`, description: `${ids.length} channels updated` });
  };

  const addRow = async (productLine: string) => {
    const { data, error } = await supabase.from("channel_margins").insert({
      product_line: productLine,
      channel: "New channel",
      landed_cogs: 0,
      net_price_per_unit: 0,
      fulfillment_fees_per_unit: 0,
      cm_dollars: 0,
      cm_percent: 0,
    }).select().single();
    if (error) return toast({ title: "Add failed", description: error.message, variant: "destructive" });
    setRows((p) => [...p, data as Margin]);
  };

  if (loading) return <div className="text-muted-foreground p-8">Loading margins…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground">
        <span>Sources:</span>
        <SourceLink source="margins" withLabel />
      </div>
      {PRODUCT_LINES.map((pl) => (
        <Card key={pl}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{pl}</CardTitle>
            <div className="flex gap-2">
              <BulkCogsButton productLine={pl} onApply={(v) => bulkUpdateCogs(pl, v)} />
              <Button size="sm" variant="outline" onClick={() => addRow(pl)}>
                <Plus className="h-4 w-4 mr-1" /> Add channel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">Net Price</TableHead>
                  <TableHead className="text-right">Fees</TableHead>
                  <TableHead className="text-right">CM $</TableHead>
                  <TableHead className="text-right">CM %</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped[pl].length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-muted-foreground italic">No channels yet</TableCell></TableRow>
                )}
                {grouped[pl].map((r) => (
                  <TableRow key={r.id} className={cn(cmRowClass(r.cm_percent))}>
                    <TableCell><EditableCell value={r.channel} required onSave={(v) => updateField(r.id, { channel: v })} /></TableCell>
                    <TableCell className="text-right"><EditableCell value={r.landed_cogs} type="number" display={(v) => `$${Number(v).toFixed(2)}`} onSave={(v) => updateField(r.id, { landed_cogs: parseFloat(v) || 0 })} /></TableCell>
                    <TableCell className="text-right"><EditableCell value={r.net_price_per_unit} type="number" display={(v) => `$${Number(v).toFixed(2)}`} onSave={(v) => updateField(r.id, { net_price_per_unit: parseFloat(v) || 0 })} /></TableCell>
                    <TableCell className="text-right"><EditableCell value={r.fulfillment_fees_per_unit} type="number" display={(v) => `$${Number(v).toFixed(2)}`} onSave={(v) => updateField(r.id, { fulfillment_fees_per_unit: parseFloat(v) || 0 })} /></TableCell>
                    <TableCell className="text-right font-mono">${Number(r.cm_dollars).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{Number(r.cm_percent).toFixed(1)}%</TableCell>
                    <TableCell><EditableCell value={r.notes ?? ""} onSave={(v) => updateField(r.id, { notes: v })} /></TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function BulkCogsButton({ productLine, onApply }: { productLine: string; onApply: (v: number) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">Update COGS</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Update COGS for all {productLine} channels</DialogTitle></DialogHeader>
        <Input type="number" placeholder="New COGS $/unit" value={val} onChange={(e) => setVal(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { const n = parseFloat(val); if (!isNaN(n)) { onApply(n); setOpen(false); setVal(""); } }}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MarginsTab;