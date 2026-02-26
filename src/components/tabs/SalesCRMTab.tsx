import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Mail, Phone, Calendar, AlertCircle, Copy, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CRMAccount {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  status: string;
  last_contact_date: string | null;
  next_followup_date: string | null;
  followup_cadence_days: number;
  notes: string | null;
  created_at: string;
}

interface CRMActivity {
  id: string;
  account_id: string;
  type: string;
  description: string;
  date: string;
}

const statusColors: Record<string, string> = {
  prospect: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  churned: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const EMAIL_TEMPLATE = `Hi [CONTACT_NAME],

Hope you're doing well! I wanted to follow up on our conversation about L'Isolina's [PRODUCT] line.

We'd love to explore a partnership with [COMPANY] — our products are a great fit for your customers who appreciate authentic, high-quality Italian pantry staples.

Would you be open to a quick call this week to discuss?

Best,
[YOUR NAME]
L'Isolina / SpaghettiDust`;

export const SalesCRMTab = () => {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<CRMAccount[]>([]);
  const [activities, setActivities] = useState<CRMActivity[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: "", contact_name: "", contact_email: "", status: "prospect", notes: "" });
  const [newActivity, setNewActivity] = useState({ type: "email", description: "" });

  const fetchAccounts = async () => {
    const { data } = await supabase.from("crm_accounts").select("*").order("next_followup_date", { ascending: true });
    if (data) setAccounts(data as CRMAccount[]);
  };

  const fetchActivities = async (accountId: string) => {
    const { data } = await supabase.from("crm_activities").select("*").eq("account_id", accountId).order("date", { ascending: false });
    if (data) setActivities(data as CRMActivity[]);
  };

  useEffect(() => { fetchAccounts(); }, []);
  useEffect(() => { if (selectedAccount) fetchActivities(selectedAccount); }, [selectedAccount]);

  const handleAddAccount = async () => {
    try {
      const now = new Date();
      const nextFollowup = new Date(now.getTime() + 10 * 86400000);
      const { error } = await supabase.from("crm_accounts").insert({
        name: newAccount.name,
        contact_name: newAccount.contact_name || null,
        contact_email: newAccount.contact_email || null,
        status: newAccount.status,
        notes: newAccount.notes || null,
        last_contact_date: now.toISOString(),
        next_followup_date: nextFollowup.toISOString(),
      });
      if (error) throw error;
      toast({ title: "Account Added" });
      setAddOpen(false);
      setNewAccount({ name: "", contact_name: "", contact_email: "", status: "prospect", notes: "" });
      fetchAccounts();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleAddActivity = async () => {
    if (!selectedAccount) return;
    try {
      const account = accounts.find(a => a.id === selectedAccount);
      const nextFollowup = new Date(Date.now() + (account?.followup_cadence_days || 10) * 86400000);

      await Promise.all([
        supabase.from("crm_activities").insert({
          account_id: selectedAccount,
          type: newActivity.type,
          description: newActivity.description,
        }),
        supabase.from("crm_accounts").update({
          last_contact_date: new Date().toISOString(),
          next_followup_date: nextFollowup.toISOString(),
        }).eq("id", selectedAccount),
      ]);

      toast({ title: "Activity Logged" });
      setActivityOpen(false);
      setNewActivity({ type: "email", description: "" });
      fetchAccounts();
      fetchActivities(selectedAccount);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const getFollowupBadge = (date: string | null) => {
    if (!date) return null;
    const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
    if (days < 0) return <Badge variant="destructive" className="text-xs"><AlertCircle className="h-3 w-3 mr-1" /> {Math.abs(days)}d overdue</Badge>;
    if (days <= 2) return <Badge className="bg-warning text-warning-foreground text-xs">Due in {days}d</Badge>;
    return <Badge variant="outline" className="text-xs">In {days}d</Badge>;
  };

  const copyEmailTemplate = (account: CRMAccount) => {
    const email = EMAIL_TEMPLATE
      .replace("[CONTACT_NAME]", account.contact_name || "there")
      .replace("[COMPANY]", account.name)
      .replace("[PRODUCT]", "SpaghettiDust & pasta");
    navigator.clipboard.writeText(email);
    toast({ title: "Email template copied!" });
  };

  const selected = accounts.find(a => a.id === selectedAccount);

  // Accounts needing follow-up (overdue or due within 2 days)
  const needsFollowup = accounts.filter(a => {
    if (!a.next_followup_date) return false;
    const days = Math.ceil((new Date(a.next_followup_date).getTime() - Date.now()) / 86400000);
    return days <= 2;
  });

  return (
    <div className="space-y-6">
      {/* Follow-up Reminders */}
      {needsFollowup.length > 0 && (
        <Card className="border-warning/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" /> Follow-up Reminders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {needsFollowup.map(a => (
                <div key={a.id} className="flex items-center justify-between p-2 rounded bg-muted/50 cursor-pointer hover:bg-muted" onClick={() => setSelectedAccount(a.id)}>
                  <div>
                    <span className="font-medium text-sm">{a.name}</span>
                    {a.contact_name && <span className="text-xs text-muted-foreground ml-2">({a.contact_name})</span>}
                  </div>
                  {getFollowupBadge(a.next_followup_date)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Account List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Accounts</h3>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Account</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Company Name</Label><Input value={newAccount.name} onChange={e => setNewAccount({ ...newAccount, name: e.target.value })} /></div>
                  <div><Label>Contact Name</Label><Input value={newAccount.contact_name} onChange={e => setNewAccount({ ...newAccount, contact_name: e.target.value })} /></div>
                  <div><Label>Contact Email</Label><Input value={newAccount.contact_email} onChange={e => setNewAccount({ ...newAccount, contact_email: e.target.value })} /></div>
                  <div>
                    <Label>Status</Label>
                    <Select value={newAccount.status} onValueChange={v => setNewAccount({ ...newAccount, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prospect">Prospect</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="churned">Churned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Notes</Label><Textarea value={newAccount.notes} onChange={e => setNewAccount({ ...newAccount, notes: e.target.value })} /></div>
                  <Button onClick={handleAddAccount} className="w-full">Add Account</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-2">
            {accounts.map(a => (
              <Card key={a.id} className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedAccount === a.id ? "ring-2 ring-primary" : ""}`} onClick={() => setSelectedAccount(a.id)}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{a.name}</span>
                    <Badge className={`text-xs ${statusColors[a.status] || ""}`}>{a.status}</Badge>
                  </div>
                  {a.contact_name && <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> {a.contact_name}</p>}
                  <div className="mt-1">{getFollowupBadge(a.next_followup_date)}</div>
                </CardContent>
              </Card>
            ))}
            {accounts.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No accounts yet. Add your first lead!</p>}
          </div>
        </div>

        {/* Account Detail */}
        <div className="lg:col-span-2">
          {selected ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{selected.name}</CardTitle>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    {selected.contact_name && <span className="flex items-center gap-1"><User className="h-3 w-3" /> {selected.contact_name}</span>}
                    {selected.contact_email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {selected.contact_email}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="outline"><Mail className="h-4 w-4 mr-1" /> Email Template</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-96">
                      <pre className="text-xs whitespace-pre-wrap mb-3">{EMAIL_TEMPLATE.replace("[CONTACT_NAME]", selected.contact_name || "there").replace("[COMPANY]", selected.name).replace("[PRODUCT]", "SpaghettiDust & pasta")}</pre>
                      <Button size="sm" onClick={() => copyEmailTemplate(selected)} className="w-full"><Copy className="h-4 w-4 mr-1" /> Copy to Clipboard</Button>
                    </PopoverContent>
                  </Popover>
                  <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
                    <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Log Activity</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Log Activity for {selected.name}</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Type</Label>
                          <Select value={newActivity.type} onValueChange={v => setNewActivity({ ...newActivity, type: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="call">Call</SelectItem>
                              <SelectItem value="meeting">Meeting</SelectItem>
                              <SelectItem value="note">Note</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div><Label>Description</Label><Textarea value={newActivity.description} onChange={e => setNewActivity({ ...newActivity, description: e.target.value })} /></div>
                        <Button onClick={handleAddActivity} className="w-full">Log Activity</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {selected.notes && <p className="text-sm text-muted-foreground mb-4 p-3 bg-muted rounded">{selected.notes}</p>}
                <h4 className="font-medium text-sm mb-3">Activity History</h4>
                {activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
                ) : (
                  <div className="space-y-3">
                    {activities.map(a => (
                      <div key={a.id} className="flex gap-3 border-l-2 border-border pl-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs capitalize">{a.type}</Badge>
                            <span className="text-xs text-muted-foreground">{new Date(a.date).toLocaleDateString()}</span>
                          </div>
                          <p className="text-sm mt-1">{a.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Select an account to view details and activity
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
