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
import { Plus, Package, Calendar, DollarSign, Clock, Trash2, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SourceLink from "@/components/SourceLink";
import { useAiRefresh } from "@/hooks/use-ai-refresh";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, isSameDay, isSameMonth, getDay } from "date-fns";

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
  order_placed_date: string | null;
  arrived_date: string | null;
}

const categoryColors: Record<string, string> = {
  ordering: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  production: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  packaging: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "go-to-market": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const categoryDotColors: Record<string, string> = {
  ordering: "bg-blue-500",
  production: "bg-amber-500",
  packaging: "bg-purple-500",
  "go-to-market": "bg-green-500",
};

interface ParsedTask {
  title: string;
  category: string;
  product_name?: string;
  notes?: string;
}

export const DustLaunchTab = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<LaunchProduct[]>([]);
  const [milestones, setMilestones] = useState<LaunchMilestone[]>([]);
  const [cashBalance, setCashBalance] = useState<number>(0);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", unit_price: "", tube_cost: "", ingredient_cost: "", production_cost: "", target_launch_date: "", notes: "" });
  const [newMilestone, setNewMilestone] = useState({ product_id: "", title: "", category: "ordering", deadline: "", cash_impact: "", lead_time_days: "", payment_terms: "", notes: "" });
  const [calendarStart, setCalendarStart] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [nlInput, setNlInput] = useState("");
  const [nlParsing, setNlParsing] = useState(false);
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([]);

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
  useAiRefresh(fetchData);

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

  const updateLeadTimeField = async (id: string, field: "order_placed_date" | "arrived_date", value: string) => {
    await supabase.from("launch_milestones").update({ [field]: value || null } as any).eq("id", id);
    fetchData();
  };

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

  // NL Input handler
  const handleNlSubmit = async () => {
    if (!nlInput.trim()) return;
    setNlParsing(true);
    try {
      const productNames = products.map(p => p.name).join(", ");
      const systemPrompt = `You are a task extraction assistant for a product launch tracker. Extract actionable tasks from the user's freeform input. Return ONLY valid JSON array of tasks. Each task: {"title": "...", "category": "ordering|production|packaging|go-to-market", "product_name": "..." or null, "notes": "..."}. Available products: ${productNames || "none yet"}. Be specific and actionable.`;
      
      const res = await supabase.functions.invoke("chat", {
        body: {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: nlInput },
          ],
        },
      });

      if (res.error) throw res.error;

      // Parse SSE response
      const reader = res.data instanceof ReadableStream ? res.data.getReader() : null;
      let fullText = "";
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const json = JSON.parse(line.slice(6));
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) fullText += delta;
              } catch {}
            }
          }
        }
      }

      // Extract JSON from response
      const jsonMatch = fullText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const tasks: ParsedTask[] = JSON.parse(jsonMatch[0]);
        setParsedTasks(tasks);
      } else {
        toast({ title: "Couldn't parse tasks", description: "Try rephrasing your input", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setNlParsing(false);
    }
  };

  const confirmParsedTasks = async () => {
    try {
      for (const task of parsedTasks) {
        const product = products.find(p => p.name.toLowerCase().includes((task.product_name || "").toLowerCase()));
        await supabase.from("launch_milestones").insert({
          title: task.title,
          category: task.category || "ordering",
          product_id: product?.id || null,
          notes: task.notes || null,
        } as any);
      }
      toast({ title: `${parsedTasks.length} tasks added` });
      setParsedTasks([]);
      setNlInput("");
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  // Calendar helpers
  const calendarMonths = [calendarStart, addMonths(calendarStart, 1), addMonths(calendarStart, 2)];

  const getMilestonesForDate = (date: Date) => {
    return milestones.filter(m => m.deadline && isSameDay(new Date(m.deadline), date));
  };

  const getLaunchDatesForDate = (date: Date) => {
    return products.filter(p => p.target_launch_date && isSameDay(new Date(p.target_launch_date), date));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground">
        <span>Sources:</span>
        <SourceLink source="dust" withLabel /> · <SourceLink source="production" withLabel />
      </div>
      {/* NL Input */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex gap-2">
            <Textarea
              value={nlInput}
              onChange={(e) => setNlInput(e.target.value)}
              placeholder="Type a freeform update... e.g. 'Porcini dust packaging designs are nearly finished. Need to send to Gemstone and figure out unit count. Order alongside next aglio packaging run.'"
              className="min-h-[60px] flex-1"
            />
            <Button onClick={handleNlSubmit} disabled={nlParsing || !nlInput.trim()} className="self-end">
              {nlParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          {parsedTasks.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium">Extracted tasks — confirm to add:</p>
              {parsedTasks.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-sm bg-muted rounded px-3 py-2">
                  <Badge className={categoryColors[t.category] || ""} variant="outline">{t.category}</Badge>
                  <span className="flex-1">{t.title}</span>
                  {t.product_name && <Badge variant="secondary">{t.product_name}</Badge>}
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setParsedTasks(parsedTasks.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Button size="sm" onClick={confirmParsedTasks}>Add {parsedTasks.length} Tasks</Button>
                <Button size="sm" variant="outline" onClick={() => setParsedTasks([])}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3-Month Calendar */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-5 w-5" /> Launch Calendar</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCalendarStart(subMonths(calendarStart, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCalendarStart(startOfMonth(new Date()))}>Today</Button>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCalendarStart(addMonths(calendarStart, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex gap-4 text-xs mt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Ordering</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Production</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" />Packaging</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Go-to-Market</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Launch Date</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {calendarMonths.map((monthStart) => {
              const monthEnd = endOfMonth(monthStart);
              const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
              const startDow = getDay(monthStart);
              return (
                <div key={monthStart.toISOString()}>
                  <p className="text-sm font-semibold text-center mb-2">{format(monthStart, "MMMM yyyy")}</p>
                  <div className="grid grid-cols-7 gap-0 text-center text-[10px] text-muted-foreground mb-1">
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-0">
                    {Array.from({ length: startDow }).map((_, i) => <div key={`empty-${i}`} />)}
                    {days.map((day) => {
                      const dayMilestones = getMilestonesForDate(day);
                      const dayLaunches = getLaunchDatesForDate(day);
                      const isToday = isSameDay(day, new Date());
                      const isSelected = selectedDate && isSameDay(day, selectedDate);
                      const hasDots = dayMilestones.length > 0 || dayLaunches.length > 0;
                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => setSelectedDate(isSelected ? null : day)}
                          className={`p-1 text-xs rounded hover:bg-muted transition-colors relative ${isToday ? "font-bold ring-1 ring-primary" : ""} ${isSelected ? "bg-primary/10" : ""}`}
                        >
                          {day.getDate()}
                          {hasDots && (
                            <div className="flex justify-center gap-[2px] mt-[1px]">
                              {[...new Set(dayMilestones.map(m => m.category))].map((cat) => (
                                <span key={cat} className={`w-1.5 h-1.5 rounded-full ${categoryDotColors[cat] || "bg-muted-foreground"}`} />
                              ))}
                              {dayLaunches.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {selectedDate && (
            <div className="mt-4 border-t pt-3">
              <p className="text-sm font-medium mb-2">{format(selectedDate, "MMMM d, yyyy")}</p>
              {getMilestonesForDate(selectedDate).map(m => (
                <div key={m.id} className="flex items-center gap-2 text-sm mb-1">
                  <Badge className={categoryColors[m.category] || ""} variant="outline">{m.category}</Badge>
                  <span>{m.title}</span>
                </div>
              ))}
              {getLaunchDatesForDate(selectedDate).map(p => (
                <div key={p.id} className="flex items-center gap-2 text-sm mb-1">
                  <Badge variant="destructive">🚀 Launch</Badge>
                  <span>{p.name}</span>
                </div>
              ))}
              {getMilestonesForDate(selectedDate).length === 0 && getLaunchDatesForDate(selectedDate).length === 0 && (
                <p className="text-sm text-muted-foreground">No events on this date.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
            const actualLeadTime = m.order_placed_date && m.arrived_date
              ? differenceInDays(new Date(m.arrived_date), new Date(m.order_placed_date))
              : null;

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
                      {/* Lead time tracking */}
                      <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Ordered:</span>
                          <Input
                            type="date"
                            className="h-6 w-[130px] text-xs px-1"
                            value={m.order_placed_date ? m.order_placed_date.split("T")[0] : ""}
                            onChange={(e) => updateLeadTimeField(m.id, "order_placed_date", e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Arrived:</span>
                          <Input
                            type="date"
                            className="h-6 w-[130px] text-xs px-1"
                            value={m.arrived_date ? m.arrived_date.split("T")[0] : ""}
                            onChange={(e) => updateLeadTimeField(m.id, "arrived_date", e.target.value)}
                          />
                        </div>
                        {actualLeadTime !== null && (
                          <Badge variant="outline" className="text-xs">
                            Actual: {actualLeadTime}d {m.lead_time_days ? `(est. ${m.lead_time_days}d)` : ""}
                          </Badge>
                        )}
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
