import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, DollarSign, TrendingUp, TrendingDown, Link2, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CSVUploader } from "@/components/CSVUploader";
import { InvoiceDropZone } from "@/components/InvoiceDropZone";

type TimeRange = "week" | "month" | "quarter" | "year";

interface Invoice {
  id: string; invoice_number: string | null; customer: string; amount: number; date_issued: string; due_date: string; status: string;
}
interface Expense {
  id: string; date: string; category: string; description: string; amount: number; type: string; status: string;
}
interface CashEntry {
  id: string; date: string; type: string; amount: number; category: string | null; description: string | null; balance_after: number | null;
}

export const MoneyTab = () => {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [cashBalance, setCashBalance] = useState<number | null>(null);
  const [expenseRange, setExpenseRange] = useState<TimeRange>("month");
  const [cashRange, setCashRange] = useState<TimeRange>("month");
  const [addCashOpen, setAddCashOpen] = useState(false);
  const [addInvoiceOpen, setAddInvoiceOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [newCash, setNewCash] = useState({ amount: "", description: "", type: "balance_update" });
  const [newInvoice, setNewInvoice] = useState({ customer: "", amount: "", due_date: "", invoice_number: "" });
  const [newExpense, setNewExpense] = useState({ description: "", amount: "", category: "other", type: "one-time", status: "upcoming" });
  const [qbStatus, setQbStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");
  const [qbConnecting, setQbConnecting] = useState(false);

  const fetchAll = async () => {
    const [invRes, expRes, cashRes] = await Promise.all([
      supabase.from("invoices").select("*").order("due_date", { ascending: true }),
      supabase.from("expenses").select("*").order("date", { ascending: false }),
      supabase.from("cash_entries").select("*").order("date", { ascending: false }).limit(200),
    ]);
    if (invRes.data) setInvoices(invRes.data);
    if (expRes.data) setExpenses(expRes.data);
    if (cashRes.data) {
      setCashEntries(cashRes.data);
      if (cashRes.data.length > 0 && cashRes.data[0].balance_after !== null) setCashBalance(Number(cashRes.data[0].balance_after));
    }
  };

  useEffect(() => { fetchAll(); checkQbStatus(); }, []);

  const checkQbStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("quickbooks-api", { body: { endpoint: "status" } });
      setQbStatus((!error && data?.connected) ? "connected" : "disconnected");
    } catch { setQbStatus("disconnected"); }
  };

  const handleConnectQB = async () => {
    setQbConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/quickbooks/callback`;
      const { data, error } = await supabase.functions.invoke("quickbooks-auth", { body: { action: "authorize", redirectUri } });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setQbConnecting(false);
    }
  };

  const getStartDate = (range: TimeRange) => {
    const d = new Date();
    if (range === "week") d.setDate(d.getDate() - 7);
    else if (range === "month") d.setDate(d.getDate() - 30);
    else if (range === "quarter") d.setMonth(d.getMonth() - 3);
    else d.setFullYear(d.getFullYear() - 1);
    return d;
  };

  const filteredExpenses = useMemo(() => {
    const start = getStartDate(expenseRange);
    return expenses.filter((e) => new Date(e.date) >= start);
  }, [expenses, expenseRange]);

  const upcomingExpenses = expenses.filter((e) => e.status === "upcoming");
  const paidExpenses = filteredExpenses.filter((e) => e.status === "paid");

  const filteredCash = useMemo(() => {
    const start = getStartDate(cashRange);
    return cashEntries.filter((e) => new Date(e.date) >= start);
  }, [cashEntries, cashRange]);

  const handleUpdateCash = async () => {
    try {
      const amount = parseFloat(newCash.amount);
      const { error } = await supabase.from("cash_entries").insert({
        type: newCash.type, amount,
        description: newCash.description || null,
        balance_after: newCash.type === "balance_update" ? amount : (cashBalance || 0) + (newCash.type === "in" ? amount : -amount),
      });
      if (error) throw error;
      toast({ title: "Cash Updated" });
      setAddCashOpen(false);
      setNewCash({ amount: "", description: "", type: "balance_update" });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleAddInvoice = async () => {
    try {
      const { error } = await supabase.from("invoices").insert({
        customer: newInvoice.customer, amount: parseFloat(newInvoice.amount),
        due_date: newInvoice.due_date, invoice_number: newInvoice.invoice_number || null,
      });
      if (error) throw error;
      toast({ title: "Invoice Added" });
      setAddInvoiceOpen(false);
      setNewInvoice({ customer: "", amount: "", due_date: "", invoice_number: "" });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleAddExpense = async () => {
    try {
      const { error } = await supabase.from("expenses").insert({
        description: newExpense.description, amount: parseFloat(newExpense.amount),
        category: newExpense.category, type: newExpense.type, status: newExpense.status,
      });
      if (error) throw error;
      toast({ title: "Expense Added" });
      setAddExpenseOpen(false);
      setNewExpense({ description: "", amount: "", category: "other", type: "one-time", status: "upcoming" });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleMarkInvoicePaid = async (id: string) => {
    await supabase.from("invoices").update({ status: "paid", payment_date: new Date().toISOString() }).eq("id", id);
    fetchAll();
    toast({ title: "Invoice Marked as Paid" });
  };

  const getDueBadge = (dueDate: string, status: string) => {
    if (status === "paid") return <Badge className="bg-success text-success-foreground">Paid</Badge>;
    const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
    if (days < 0) return <Badge variant="destructive">Overdue ({Math.abs(days)}d)</Badge>;
    if (days <= 3) return <Badge className="bg-warning text-warning-foreground">Due in {days}d</Badge>;
    return <Badge variant="outline">Due in {days}d</Badge>;
  };

  const rangeButtons = (current: TimeRange, setter: (r: TimeRange) => void) => (
    <div className="flex gap-1">
      {([["week", "1W"], ["month", "1M"], ["quarter", "3M"], ["year", "1Y"]] as [TimeRange, string][]).map(([key, label]) => (
        <Button key={key} size="sm" variant={current === key ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => setter(key)}>
          {label}
        </Button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* QuickBooks Connection */}
      <Card className="border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Link2 className="h-5 w-5 text-primary" /></div>
              <div>
                <h3 className="font-semibold">QuickBooks Online</h3>
                <p className="text-sm text-muted-foreground">
                  {qbStatus === "connected" ? "Connected — syncing bank balance, invoices & expenses" : "Connect to pull live financial data"}
                </p>
              </div>
            </div>
            {qbStatus === "connected" ? (
              <Badge className="bg-success/20 text-success"><CheckCircle2 className="h-3 w-3 mr-1" /> Connected</Badge>
            ) : (
              <Button onClick={handleConnectQB} disabled={qbConnecting} size="sm">
                {qbConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Link2 className="h-4 w-4 mr-1" />}
                Connect QuickBooks
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cash Position + CSV Upload */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-accent/30">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-accent" /> Cash Position</CardTitle>
            <Dialog open={addCashOpen} onOpenChange={setAddCashOpen}>
              <DialogTrigger asChild><Button size="sm">Update Cash</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Update Cash</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Type</Label>
                    <Select value={newCash.type} onValueChange={(v) => setNewCash({ ...newCash, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="balance_update">Set Balance</SelectItem>
                        <SelectItem value="in">Cash In</SelectItem>
                        <SelectItem value="out">Cash Out</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Amount ($)</Label><Input type="number" value={newCash.amount} onChange={(e) => setNewCash({ ...newCash, amount: e.target.value })} /></div>
                  <div><Label>Description</Label><Input value={newCash.description} onChange={(e) => setNewCash({ ...newCash, description: e.target.value })} /></div>
                  <Button onClick={handleUpdateCash} className="w-full">Save</Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{cashBalance !== null ? `$${cashBalance.toLocaleString()}` : "— Not set yet"}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {cashEntries.length > 0 ? `Last updated: ${new Date(cashEntries[0].date).toLocaleDateString()}` : "Click 'Update Cash' to set your starting balance"}
            </p>
          </CardContent>
        </Card>
        <CSVUploader onUploadComplete={fetchAll} />
      </div>

      <Tabs defaultValue="receivables">
        <TabsList>
          <TabsTrigger value="receivables">Receivables</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="history">Cash History</TabsTrigger>
        </TabsList>

        {/* Receivables */}
        <TabsContent value="receivables" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Invoices Due</h3>
            <Dialog open={addInvoiceOpen} onOpenChange={setAddInvoiceOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Invoice</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Invoice</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Customer</Label><Input value={newInvoice.customer} onChange={(e) => setNewInvoice({ ...newInvoice, customer: e.target.value })} /></div>
                  <div><Label>Amount ($)</Label><Input type="number" value={newInvoice.amount} onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })} /></div>
                  <div><Label>Due Date</Label><Input type="date" value={newInvoice.due_date} onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })} /></div>
                  <div><Label>Invoice #</Label><Input value={newInvoice.invoice_number} onChange={(e) => setNewInvoice({ ...newInvoice, invoice_number: e.target.value })} /></div>
                  <Button onClick={handleAddInvoice} className="w-full">Add Invoice</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {/* Invoice Drop Zone */}
          <InvoiceDropZone onInvoiceCreated={fetchAll} />
          <Card>
            <CardContent className="pt-6">
              {invoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No invoices tracked yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead><TableHead>Customer</TableHead>
                      <TableHead className="text-right">Amount</TableHead><TableHead>Due</TableHead>
                      <TableHead>Status</TableHead><TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>{inv.invoice_number || "—"}</TableCell>
                        <TableCell className="font-medium">{inv.customer}</TableCell>
                        <TableCell className="text-right">${Number(inv.amount).toLocaleString()}</TableCell>
                        <TableCell>{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                        <TableCell>{getDueBadge(inv.due_date, inv.status)}</TableCell>
                        <TableCell>
                          {inv.status !== "paid" && (
                            <Button size="sm" variant="outline" onClick={() => handleMarkInvoicePaid(inv.id)}>Mark Paid</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses */}
        <TabsContent value="expenses" className="space-y-4">
          {upcomingExpenses.length > 0 && (
            <Card className="border-warning/30">
              <CardHeader className="pb-2"><CardTitle className="text-base">Upcoming Expenses</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead><TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead><TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingExpenses.map((exp) => (
                      <TableRow key={exp.id}>
                        <TableCell className="font-medium">{exp.description}</TableCell>
                        <TableCell className="capitalize">{exp.category}</TableCell>
                        <TableCell className="text-right">${Number(exp.amount).toLocaleString()}</TableCell>
                        <TableCell className="capitalize">{exp.type}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Expense History</h3>
            <div className="flex items-center gap-2">
              {rangeButtons(expenseRange, setExpenseRange)}
              <Dialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Description</Label><Input value={newExpense.description} onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })} /></div>
                    <div><Label>Amount ($)</Label><Input type="number" value={newExpense.amount} onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })} /></div>
                    <div>
                      <Label>Category</Label>
                      <Select value={newExpense.category} onValueChange={(v) => setNewExpense({ ...newExpense, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cogs">COGS</SelectItem><SelectItem value="packaging">Packaging</SelectItem>
                          <SelectItem value="shipping">Shipping</SelectItem><SelectItem value="marketing">Marketing</SelectItem>
                          <SelectItem value="warehouse">Warehouse</SelectItem><SelectItem value="subscription">Subscriptions</SelectItem>
                          <SelectItem value="insurance">Insurance</SelectItem><SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Select value={newExpense.type} onValueChange={(v) => setNewExpense({ ...newExpense, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="one-time">One-time</SelectItem><SelectItem value="recurring">Recurring</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select value={newExpense.status} onValueChange={(v) => setNewExpense({ ...newExpense, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="upcoming">Upcoming</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAddExpense} className="w-full">Add Expense</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <Card>
            <CardContent className="pt-6">
              {paidExpenses.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No expenses in this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead><TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paidExpenses.map((exp) => (
                      <TableRow key={exp.id}>
                        <TableCell>{new Date(exp.date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium">{exp.description}</TableCell>
                        <TableCell className="capitalize">{exp.category}</TableCell>
                        <TableCell className="text-right">${Number(exp.amount).toLocaleString()}</TableCell>
                        <TableCell className="capitalize">{exp.type}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cash History */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Cash History</h3>
            {rangeButtons(cashRange, setCashRange)}
          </div>
          <Card>
            <CardContent className="pt-6">
              {filteredCash.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No cash entries in this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCash.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {entry.type === "in" && <TrendingUp className="h-4 w-4 text-success inline mr-1" />}
                          {entry.type === "out" && <TrendingDown className="h-4 w-4 text-destructive inline mr-1" />}
                          <span className="capitalize">{entry.type.replace("_", " ")}</span>
                        </TableCell>
                        <TableCell>{entry.description || "—"}</TableCell>
                        <TableCell className="text-right">${Number(entry.amount).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">{entry.balance_after !== null ? `$${Number(entry.balance_after).toLocaleString()}` : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
