import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, DollarSign, TrendingUp, TrendingDown, Link2, Loader2, CheckCircle2, ExternalLink, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CSVUploader } from "@/components/CSVUploader";
import { InvoiceDropZone } from "@/components/InvoiceDropZone";
import { CashFlowChart } from "@/components/CashFlowChart";
import { CashFlowProjection } from "@/components/CashFlowProjection";
import { NLExpenseInput } from "@/components/NLExpenseInput";
import { RecurringExpenses } from "@/components/RecurringExpenses";
import { SortableTableHead, useSort, sortData } from "@/components/SortableTableHead";

type TimeRange = "week" | "month" | "quarter" | "year";

interface Invoice {
  id: string; invoice_number: string | null; customer: string; amount: number; date_issued: string; due_date: string; status: string; file_url?: string | null; direction?: string;
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
  const [newInvoice, setNewInvoice] = useState({ customer: "", amount: "", due_date: "", invoice_number: "", direction: "receivable" });
  const [newExpense, setNewExpense] = useState({ description: "", amount: "", category: "other", type: "one-time", status: "upcoming" });
  const [qbStatus, setQbStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");
  const [qbConnecting, setQbConnecting] = useState(false);
  const invoiceSort = useSort();
  const expenseSort = useSort();
  const cashSort = useSort();

  const fetchAll = async () => {
    const [invRes, expRes, cashRes] = await Promise.all([
      supabase.from("invoices").select("*").order("due_date", { ascending: true }),
      supabase.from("expenses").select("*").order("date", { ascending: false }),
      supabase.from("cash_entries").select("*").order("date", { ascending: false }).limit(500),
    ]);
    if (invRes.data) setInvoices(invRes.data as any);
    if (expRes.data) setExpenses(expRes.data);
    if (cashRes.data) {
      setCashEntries(cashRes.data);
      // Find the most recent entry with balance_after
      const withBalance = cashRes.data.find((e: any) => e.balance_after !== null);
      if (withBalance) {
        let bal = Number(withBalance.balance_after);
        const balanceDate = new Date(withBalance.date).getTime();
        // Apply pending charges after the last reported balance
        cashRes.data.forEach((e: any) => {
          if (new Date(e.date).getTime() > balanceDate && e.balance_after === null) {
            if (e.type === "in") bal += Number(e.amount);
            else if (e.type === "out") bal -= Number(e.amount);
          }
        });
        setCashBalance(bal);
      } else if (cashRes.data.length > 0) {
        let running = 0;
        const sorted = [...cashRes.data].reverse();
        sorted.forEach((e: any) => {
          if (e.type === "in") running += Number(e.amount);
          else if (e.type === "out") running -= Number(e.amount);
        });
        setCashBalance(running);
      }
    }
  };

  useEffect(() => { fetchAll(); checkQbStatus(); }, []);

  const checkQbStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("quickbooks-api", { body: { endpoint: "status" } });
      if (!error && data?.connected) {
        setQbStatus("connected");
      } else {
        setQbStatus("disconnected");
      }
    } catch {
      setQbStatus("disconnected");
    }
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
        direction: newInvoice.direction,
      } as any);
      if (error) throw error;
      toast({ title: "Invoice Added" });
      setAddInvoiceOpen(false);
      setNewInvoice({ customer: "", amount: "", due_date: "", invoice_number: "", direction: "receivable" });
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

  const handleDeleteInvoice = async (id: string) => {
    try {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
      fetchAll();
      toast({ title: "Invoice Deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
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

  const invGetVal = (item: Invoice, key: string) => {
    switch (key) {
      case "invoice_number": return item.invoice_number;
      case "customer": return item.customer;
      case "amount": return item.amount;
      case "direction": return item.direction;
      case "due_date": return item.due_date;
      case "status": return item.status;
      default: return "";
    }
  };
  const expGetVal = (item: Expense, key: string) => {
    switch (key) {
      case "date": return item.date;
      case "description": return item.description;
      case "category": return item.category;
      case "amount": return item.amount;
      case "type": return item.type;
      default: return "";
    }
  };
  const cashGetVal = (item: CashEntry, key: string) => {
    switch (key) {
      case "date": return item.date;
      case "type": return item.type;
      case "description": return item.description;
      case "amount": return item.amount;
      case "balance_after": return item.balance_after;
      default: return "";
    }
  };

  const sortedInvoices = sortData(invoices, invoiceSort.sort, invGetVal);
  const sortedPaidExpenses = sortData(paidExpenses, expenseSort.sort, expGetVal);
  const sortedCash = sortData(filteredCash, cashSort.sort, cashGetVal);

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
            <div className="text-4xl font-bold">{cashBalance !== null ? `$${cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "— Not set yet"}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {cashEntries.length > 0 ? `Includes pending charges through ${new Date(cashEntries[0].date).toLocaleDateString()}` : "Click 'Update Cash' to set your starting balance"}
            </p>
          </CardContent>
        </Card>
        <CSVUploader onUploadComplete={fetchAll} />
      </div>

      {/* Cash Flow Chart */}
      <CashFlowChart />

      {/* Cash Flow Projection */}
      <CashFlowProjection />

      {/* NL Expense Input */}
      <NLExpenseInput onExpenseCreated={fetchAll} />

      {/* Recurring Expenses */}
      <RecurringExpenses />

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
                  <div>
                    <Label>Direction</Label>
                    <Select value={newInvoice.direction} onValueChange={(v) => setNewInvoice({ ...newInvoice, direction: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receivable">Receivable (owed to you)</SelectItem>
                        <SelectItem value="payable">Payable (you owe)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddInvoice} className="w-full">Add Invoice</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <InvoiceDropZone onInvoiceCreated={fetchAll} />
          <Card>
            <CardContent className="pt-6">
              {invoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No invoices tracked yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                     <SortableTableHead label="Invoice #" sortKey="invoice_number" currentSort={invoiceSort.sort} onSort={invoiceSort.handleSort} />
                      <SortableTableHead label="Customer" sortKey="customer" currentSort={invoiceSort.sort} onSort={invoiceSort.handleSort} />
                      <SortableTableHead label="Type" sortKey="direction" currentSort={invoiceSort.sort} onSort={invoiceSort.handleSort} />
                      <SortableTableHead label="Amount" sortKey="amount" currentSort={invoiceSort.sort} onSort={invoiceSort.handleSort} className="text-right" />
                      <SortableTableHead label="Due" sortKey="due_date" currentSort={invoiceSort.sort} onSort={invoiceSort.handleSort} />
                      <SortableTableHead label="Status" sortKey="status" currentSort={invoiceSort.sort} onSort={invoiceSort.handleSort} />
                      <TableCell className="font-medium text-muted-foreground text-sm">Doc</TableCell>
                      <TableCell className="font-medium text-muted-foreground text-sm">Action</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedInvoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>{inv.invoice_number || "—"}</TableCell>
                        <TableCell className="font-medium">{inv.customer}</TableCell>
                        <TableCell>
                          <Badge variant={inv.direction === "payable" ? "destructive" : "default"} className="text-xs">
                            {inv.direction === "payable" ? "Payable" : "Receivable"}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right ${inv.direction === "payable" ? "text-destructive" : "text-success"}`}>
                          {inv.direction === "payable" ? "-" : "+"}${Number(inv.amount).toLocaleString()}
                        </TableCell>
                        <TableCell>{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                        <TableCell>{getDueBadge(inv.due_date, inv.status)}</TableCell>
                        <TableCell>
                          {inv.file_url ? (
                            <a href={inv.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {inv.status !== "paid" && (
                              <Button size="sm" variant="outline" onClick={() => handleMarkInvoicePaid(inv.id)}>Mark Paid</Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteInvoice(inv.id)}>
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
                      <SortableTableHead label="Description" sortKey="description" currentSort={expenseSort.sort} onSort={expenseSort.handleSort} />
                      <SortableTableHead label="Category" sortKey="category" currentSort={expenseSort.sort} onSort={expenseSort.handleSort} />
                      <SortableTableHead label="Amount" sortKey="amount" currentSort={expenseSort.sort} onSort={expenseSort.handleSort} className="text-right" />
                      <SortableTableHead label="Type" sortKey="type" currentSort={expenseSort.sort} onSort={expenseSort.handleSort} />
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
              {sortedPaidExpenses.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No expenses in this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead label="Date" sortKey="date" currentSort={expenseSort.sort} onSort={expenseSort.handleSort} />
                      <SortableTableHead label="Description" sortKey="description" currentSort={expenseSort.sort} onSort={expenseSort.handleSort} />
                      <SortableTableHead label="Category" sortKey="category" currentSort={expenseSort.sort} onSort={expenseSort.handleSort} />
                      <SortableTableHead label="Amount" sortKey="amount" currentSort={expenseSort.sort} onSort={expenseSort.handleSort} className="text-right" />
                      <SortableTableHead label="Type" sortKey="type" currentSort={expenseSort.sort} onSort={expenseSort.handleSort} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPaidExpenses.map((exp) => (
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
              {sortedCash.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No cash entries in this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead label="Date" sortKey="date" currentSort={cashSort.sort} onSort={cashSort.handleSort} />
                      <SortableTableHead label="Type" sortKey="type" currentSort={cashSort.sort} onSort={cashSort.handleSort} />
                      <SortableTableHead label="Description" sortKey="description" currentSort={cashSort.sort} onSort={cashSort.handleSort} />
                      <SortableTableHead label="Amount" sortKey="amount" currentSort={cashSort.sort} onSort={cashSort.handleSort} className="text-right" />
                      <SortableTableHead label="Balance" sortKey="balance_after" currentSort={cashSort.sort} onSort={cashSort.handleSort} className="text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCash.map((entry) => (
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
