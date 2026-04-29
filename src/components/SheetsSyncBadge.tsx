import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const KEY = "lastSheetsSync";

export function SheetsSyncBadge() {
  const [last, setLast] = useState<number | null>(null);

  useEffect(() => {
    const read = () => {
      const v = localStorage.getItem(KEY);
      setLast(v ? parseInt(v) : null);
    };
    read();
    const t = setInterval(read, 30000);
    window.addEventListener("storage", read);
    return () => { clearInterval(t); window.removeEventListener("storage", read); };
  }, []);

  const ageHours = last ? (Date.now() - last) / 3_600_000 : Infinity;
  const dotClass = ageHours <= 24 ? "bg-green-500" : ageHours <= 72 ? "bg-amber-500" : "bg-red-500";
  const label = !last ? "never synced" : ageHours <= 24 ? `synced ${Math.round(ageHours)}h ago` : `${Math.round(ageHours / 24)}d ago`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors">
          <span className={cn("h-2 w-2 rounded-full", dotClass)} />
          <span className="text-primary-foreground/90">Sheets {label}</span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Google Sheets sync</DialogTitle></DialogHeader>
        <div className="space-y-2 text-sm">
          <p>Inventory data is synced from the master Google Sheet.</p>
          <p>This indicator turns <span className="text-green-600 font-semibold">green</span> if synced within 24h,
            <span className="text-amber-600 font-semibold"> amber</span> within 1-3 days, and
            <span className="text-red-600 font-semibold"> red</span> after 3 days.</p>
          <p className="text-muted-foreground">Trigger a sync from the Inventory tab or Dashboard.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SheetsSyncBadge;