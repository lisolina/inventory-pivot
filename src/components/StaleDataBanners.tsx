import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, X } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const dismissedKey = (k: string) => `dismissed_${k}_${today()}`;

export function StaleDataBanners() {
  const { toast } = useToast();
  const [cashAgeDays, setCashAgeDays] = useState<number | null>(null);
  const [invAgeDays, setInvAgeDays] = useState<number | null>(null);
  const [runsStale, setRunsStale] = useState(false);
  const [newBalance, setNewBalance] = useState("");
  const [dismissedTick, setDismissedTick] = useState(0);

  const load = async () => {
    const [cb, inv, runs] = await Promise.all([
      supabase.from("cash_balance").select("date").order("date", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("inventory_items").select("last_synced").order("last_synced", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("production_runs").select("updated_at").not("stage", "in", "(complete,shipped)").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (cb.data?.date) {
      const days = Math.floor((Date.now() - new Date(cb.data.date).getTime()) / 86_400_000);
      setCashAgeDays(days);
    } else setCashAgeDays(999);
    if (inv.data?.last_synced) {
      const days = Math.floor((Date.now() - new Date(inv.data.last_synced).getTime()) / 86_400_000);
      setInvAgeDays(days);
    } else setInvAgeDays(null);
    if (runs.data?.updated_at) {
      const days = (Date.now() - new Date(runs.data.updated_at).getTime()) / 86_400_000;
      setRunsStale(days > 7);
    } else setRunsStale(false);
  };
  useEffect(() => { load(); }, []);

  const dismiss = (k: string) => {
    localStorage.setItem(dismissedKey(k), "1");
    setDismissedTick((t) => t + 1);
  };
  const isDismissed = (k: string) => {
    void dismissedTick;
    return localStorage.getItem(dismissedKey(k)) === "1";
  };

  const updateCash = async () => {
    const n = parseFloat(newBalance);
    if (isNaN(n)) return;
    const { error } = await supabase.from("cash_balance").insert({ date: today(), balance: n });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setNewBalance("");
    toast({ title: "Bank balance saved" });
    load();
  };

  const isWeekday = [1, 2, 3, 4, 5].includes(new Date().getDay());
  const banners: JSX.Element[] = [];

  if (isWeekday && cashAgeDays !== null && cashAgeDays >= 1 && !isDismissed("cash")) {
    banners.push(
      <Alert key="cash" className="border-amber-500/40">
        <AlertTriangle className="h-4 w-4" />
        <div className="flex-1">
          <AlertTitle>Cash balance last updated {cashAgeDays >= 999 ? "never" : `${cashAgeDays} day${cashAgeDays === 1 ? "" : "s"} ago`}</AlertTitle>
          <AlertDescription>
            <div className="flex gap-2 mt-2">
              <Input type="number" placeholder="$ today's balance" value={newBalance} onChange={(e) => setNewBalance(e.target.value)} className="w-48 h-8" />
              <Button size="sm" onClick={updateCash}>Update</Button>
              <Button size="sm" variant="ghost" onClick={() => dismiss("cash")}><X className="h-4 w-4" /></Button>
            </div>
          </AlertDescription>
        </div>
      </Alert>
    );
  }

  if (invAgeDays !== null && invAgeDays > 7 && !isDismissed("inv")) {
    banners.push(
      <Alert key="inv" className="border-amber-500/40">
        <AlertTriangle className="h-4 w-4" />
        <div className="flex-1 flex items-center justify-between">
          <div>
            <AlertTitle>Inventory counts are {invAgeDays} days old</AlertTitle>
            <AlertDescription>Sync the master Google Sheet from the Inventory tab.</AlertDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={() => dismiss("inv")}><X className="h-4 w-4" /></Button>
        </div>
      </Alert>
    );
  }

  if (runsStale && !isDismissed("runs")) {
    banners.push(
      <Alert key="runs" className="border-amber-500/40">
        <AlertTriangle className="h-4 w-4" />
        <div className="flex-1 flex items-center justify-between">
          <div>
            <AlertTitle>Any production stages to advance this week?</AlertTitle>
            <AlertDescription>No active runs have been touched in over a week.</AlertDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={() => dismiss("runs")}><X className="h-4 w-4" /></Button>
        </div>
      </Alert>
    );
  }

  if (banners.length === 0) return null;
  return <div className="space-y-2">{banners}</div>;
}

export default StaleDataBanners;