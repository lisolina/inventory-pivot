import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Package, Calendar, DollarSign, Clock, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";

interface LaunchProduct {
  id: string;
  name: string;
  unit_price: number;
  tube_cost: number;
  ingredient_cost: number;
  production_cost: number;
  target_launch_date: string | null;
  notes: string | null;
}

interface LaunchMilestone {
  id: string;
  product_id: string | null;
  title: string;
  category: string;
  deadline: string | null;
  status: string;
  cash_impact: number;
  lead_time_days: number;
  payment_terms: string | null;
  notes: string | null;
}

const categoryColors: Record<string, string> = {
  ordering: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  production: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  packaging: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "go-to-market": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export const DustLaunchTab = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<LaunchProduct[]>([]);
  const [milestones, setMilestones] = useState<LaunchMilestone[]>([]);
  const [cashBalance, setCashBalance] = useState<number>(0);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", unit_price: "", tube_cost: "", ingredient_cost: "", production_cost: "", target_launch_date: "", notes: "" });
  const [newMilestone, setNewMilestone] = useState({ product_id: "", title: "", category: "ordering", deadline: "", cash_impact: "", lead_time_days: "", payment_terms: "", notes: "" });

  const fetchData = async () => {
    const [prodRes, mileRes, cashRes] = await Promise.all([
      supabase.from("launch_products").select("*").order("created_at"),
      supabase.from("launch_milestones").select("*").order("deadline", { ascending: true }),
      supabase.from("cash_entries").select("*").order("date", { ascending: false }).limit(100),
    ]);
    if (prodRes.data) setProducts(prodRes.data as any);
    if (mileRes.data) setMilestones(mileRes.data as any);
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
        setCashBalance(bal);
      }
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddProduct = async () => {
    try {
      const { error } = await supabase.from("launch_products").insert({
        name: newProduct.name,
        unit_price: parseFloat(newProduct.unit_price) || 0,
        tube_cost: parseFloat(newProduct.tube_cost) || 0,
        ingredient_cost: parseFloat(newProduct.ingredient_cost) || 0,
        production_cost: parseFloat(newProduct.production_cost) || 0,
        target_launch_date: newProduct.target_launch_date || null,
        notes: newProduct.notes || null,
      } as any);
      if (error) throw error;
      toast({ title: "Product Added" });
      setAddProductOpen(false);
      setNewProduct({ name: "", unit_price: "", tube_cost: "", ingredient_cost: "", production_cost: "", target_launch_date: "", notes: "" });
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleAddMilestone = async () => {
    try {
      const { error } = await supabase.from("launch_milestones").insert({
        product_id: newMilestone.product_id || null,
        title: newMilestone.title,
        category: newMilestone.category,
        deadline: newMilestone.deadline || null,
        cash_impact: parseFloat(newMilestone.cash_impact) || 0,
        lead_time_days: parseInt(newMilestone.lead_time_days) || 0,
        payment_terms: newMilestone.payment_terms || null,
        notes: newMilestone.notes || null,
      } as any);
      if (error) throw error;
      toast({ title: "Milestone Added" });
      setAddMilestoneOpen(false);
      setNewMilestone({ product_id: "", title: "", category: "ordering", deadline: "", cash_impact: "", lead_time_days: "", payment_terms: "", notes: "" });
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const toggleMilestone = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "done" ? "pending" : "done";
    await supabase.from("launch_milestones").update({ status: newStatus } as any).eq("id", id);
    fetchData();
  };

  const deleteMilestone = async (id: string) => {
    await supabase.from("launch_milestones").delete().eq("id", id);
    fetchData();
    toast({ title: "Milestone Deleted" });
  };

  const deleteProduct = async (id: string) => {
    await supabase.from("launch_milestones").delete().eq("product_id", id);
    await supabase.from("launch_products").delete().eq("id", id);
    fetchData();
    toast({ title: "Product Deleted" });
  };

  // Compute cumulative cash impact at each milestone deadline
  const getCashAtDeadline = (deadline: string | null) => {
    if (!deadline) return cashBalance;
    const target = new Date(deadline);
    let projected = cashBalance;
    milestones.forEach((m) => {
      if (m.deadline && new Date(m.deadline) <= target && m.status !== "done") {
        projected -= Number(m.cash_impact);
      }
    });
    return projected;
  };

  return (
    <div className="space-y-6">
      {/* Product Cards */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2"><Package className="h-5 w-5" /> New SKU Products</h2>
        <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Product</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Launch Product</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Product Name</Label><Input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="e.g. Porcini Dust" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Unit Price ($)</Label><Input type="number" value={newProduct.unit_price} onChange={(e) => setNewProduct({ ...newProduct, unit_price: e.target.value })} /></div>
                <div><Label>Tube Cost ($)</Label><Input type="number" value={newProduct.tube_cost} onChange={(e) => setNewProduct({ ...newProduct, tube_cost: e.target.value })} /></div>
                <div><Label>Ingredient Cost ($)</Label><Input type="number" value={newProduct.ingredient_cost} onChange={(e) => setNewProduct({ ...newProduct, ingredient_cost: e.target.value })} /></div>
                <div><Label>Production Cost ($)</Label><Input type="number" value={newProduct.production_cost} onChange={(e) => setNewProduct({ ...newProduct, production_cost: e.target.value })} /></div>
              </div>
              <div><Label>Target Launch Date</Label><Input type="date" value={newProduct.target_launch_date} onChange={(e) => setNewProduct({ ...newProduct, target_launch_date: e.target.value })} /></div>
              <div><Label>Notes</Label><Textarea value={newProduct.notes} onChange={(e) => setNewProduct({ ...newProduct, notes: e.target.value })} /></div>
              <Button onClick={handleAddProduct} className="w-full">Add Product</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {products.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No launch products yet. Add Porcini, Assassina, or Cacio e Pepe to get started.</CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {products.map((p) => {
            const totalCost = Number(p.tube_cost) + Number(p.ingredient_cost) + Number(p.production_cost);
            const margin = Number(p.unit_price) - totalCost;
            const marginPct = Number(p.unit_price) > 0 ? (margin / Number(p.unit_price) * 100) : 0;
            const daysToLaunch = p.target_launch_date ? differenceInDays(new Date(p.target_launch_date), new Date()) : null;
            return (
              <Card key={p.id} className="relative">
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 text-destructive" onClick={() => deleteProduct(p.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{p.name}</CardTitle>
                  {daysToLaunch !== null && (
                    <Badge variant={daysToLaunch < 14 ? "destructive" : "outline"} className="w-fit">
                      <Calendar className="h-3 w-3 mr-1" />
                      {daysToLaunch > 0 ? `${daysToLaunch} days to launch` : "Launch date passed"}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Unit Price</span><span className="font-medium">${Number(p.unit_price).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Tube Cost</span><span>${Number(p.tube_cost).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Ingredients</span><span>${Number(p.ingredient_cost).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Production</span><span>${Number(p.production_cost).toFixed(2)}</span></div>
                    <hr className="border-border" />
                    <div className="flex justify-between font-medium">
                      <span>Margin</span>
                      <span className={margin > 0 ? "text-success" : "text-destructive"}>
                        ${margin.toFixed(2)} ({marginPct.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                  {p.notes && <p className="text-xs text-muted-foreground mt-2">{p.notes}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Milestone Timeline */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2"><Clock className="h-5 w-5" /> Milestone Timeline</h2>
        <Dialog open={addMilestoneOpen} onOpenChange={setAddMilestoneOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Milestone</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Milestone</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={newMilestone.title} onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })} placeholder="e.g. Order tubes from Jemstone" /></div>
              <div>
                <Label>Product</Label>
                <Select value={newMilestone.product_id} onValueChange={(v) => setNewMilestone({ ...newMilestone, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="All products" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={newMilestone.category} onValueChange={(v) => setNewMilestone({ ...newMilestone, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ordering">Ordering</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="packaging">Packaging</SelectItem>
                    <SelectItem value="go-to-market">Go-to-Market</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Deadline</Label><Input type="date" value={newMilestone.deadline} onChange={(e) => setNewMilestone({ ...newMilestone, deadline: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Cash Impact ($)</Label><Input type="number" value={newMilestone.cash_impact} onChange={(e) => setNewMilestone({ ...newMilestone, cash_impact: e.target.value })} /></div>
                <div><Label>Lead Time (days)</Label><Input type="number" value={newMilestone.lead_time_days} onChange={(e) => setNewMilestone({ ...newMilestone, lead_time_days: e.target.value })} /></div>
              </div>
              <div><Label>Payment Terms</Label><Input value={newMilestone.payment_terms} onChange={(e) => setNewMilestone({ ...newMilestone, payment_terms: e.target.value })} placeholder="e.g. Net 30" /></div>
              <div><Label>Notes</Label><Textarea value={newMilestone.notes} onChange={(e) => setNewMilestone({ ...newMilestone, notes: e.target.value })} /></div>
              <Button onClick={handleAddMilestone} className="w-full">Add Milestone</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {milestones.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No milestones yet. Add key dates for ordering, production, and launch.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {milestones.map((m) => {
            const product = products.find((p) => p.id === m.product_id);
            const daysLeft = m.deadline ? differenceInDays(new Date(m.deadline), new Date()) : null;
            const orderByDate = m.deadline && m.lead_time_days ? format(new Date(new Date(m.deadline).getTime() - m.lead_time_days * 86400000), "MMM d, yyyy") : null;
            const projectedCash = getCashAtDeadline(m.deadline);
            const canAfford = projectedCash >= Number(m.cash_impact);

            return (
              <Card key={m.id} className={`${m.status === "done" ? "opacity-60" : ""}`}>
                <CardContent className="py-3">
                  <div className="flex items-start gap-3">
                    <Checkbox checked={m.status === "done"} onCheckedChange={() => toggleMilestone(m.id, m.status)} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium ${m.status === "done" ? "line-through" : ""}`}>{m.title}</span>
                        <Badge className={categoryColors[m.category] || ""} variant="outline">{m.category}</Badge>
                        {product && <Badge variant="secondary" className="text-xs">{product.name}</Badge>}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                        {m.deadline && (
                          <span className={daysLeft !== null && daysLeft < 7 ? "text-destructive font-medium" : ""}>
                            <Calendar className="h-3 w-3 inline mr-1" />
                            {format(new Date(m.deadline), "MMM d, yyyy")}
                            {daysLeft !== null && ` (${daysLeft > 0 ? `${daysLeft}d left` : "overdue"})`}
                          </span>
                        )}
                        {orderByDate && <span><Clock className="h-3 w-3 inline mr-1" />Order by: {orderByDate}</span>}
                        {m.payment_terms && <span>Terms: {m.payment_terms}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {Number(m.cash_impact) > 0 && (
                        <div className="text-right">
                          <div className="text-sm font-medium">${Number(m.cash_impact).toLocaleString()}</div>
                          <div className={`text-xs flex items-center gap-1 ${canAfford ? "text-success" : "text-destructive"}`}>
                            {canAfford ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                            ${Math.round(projectedCash).toLocaleString()} projected
                          </div>
                        </div>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMilestone(m.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {m.notes && <p className="text-xs text-muted-foreground mt-1 ml-8">{m.notes}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Cash Impact Summary */}
      <Card className="border-accent/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-5 w-5 text-accent" /> Cash Impact Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">${cashBalance.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Current Cash</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">
                ${milestones.filter(m => m.status !== "done").reduce((s, m) => s + Number(m.cash_impact), 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Total Launch Cost</p>
            </div>
            <div>
              {(() => {
                const remaining = cashBalance - milestones.filter(m => m.status !== "done").reduce((s, m) => s + Number(m.cash_impact), 0);
                return (
                  <>
                    <p className={`text-2xl font-bold ${remaining >= 0 ? "text-success" : "text-destructive"}`}>
                      ${Math.round(remaining).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">After All Milestones</p>
                  </>
                );
              })()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
