import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer, DrawerContent, DrawerTrigger, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, ExternalLink, Send } from "lucide-react";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

type Msg = { role: "user" | "assistant" | "system"; content: string };

async function buildLiveContext(): Promise<string> {
  const today = new Date();
  const eight = new Date(today); eight.setDate(today.getDate() + 56);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  const [bal, flows, inv, runs, monthRev] = await Promise.all([
    supabase.from("cash_balance").select("date,balance").order("date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("cash_flows").select("week_starting,description,inflow,outflow,status")
      .gte("week_starting", today.toISOString().slice(0, 10))
      .lte("week_starting", eight.toISOString().slice(0, 10))
      .order("week_starting"),
    supabase.from("inventory_items").select("product_name,units_on_hand,reorder_level").limit(200),
    supabase.from("production_runs").select("run_id,run_name,stage,target_units").not("stage", "in", "(complete,shipped)"),
    supabase.from("cash_entries").select("amount,type,date").gte("date", monthStart),
  ]);

  const balance = bal.data?.balance ?? 0;
  const balanceDate = bal.data?.date ?? "n/a";

  const lowInv = (inv.data ?? []).filter((r: any) => {
    const oh = parseFloat(String(r.units_on_hand ?? "").replace(/[^0-9.-]/g, "")) || 0;
    const rp = parseFloat(String(r.reorder_level ?? "").replace(/[^0-9.-]/g, "")) || 0;
    return rp > 0 && oh < rp;
  }).slice(0, 20).map((r: any) => `${r.product_name} (on hand ${r.units_on_hand}, reorder ${r.reorder_level})`).join("; ") || "none";

  const activeRuns = (runs.data ?? []).map((r: any) => `${r.run_id} ${r.run_name} — ${r.stage} (target ${r.target_units})`).join("; ") || "none";

  const upcoming = (flows.data ?? []).slice(0, 30).map((f: any) =>
    `${f.week_starting}: ${f.description ?? "(no desc)"} +$${Number(f.inflow || 0).toLocaleString()} -$${Number(f.outflow || 0).toLocaleString()} [${f.status ?? "forecast"}]`
  ).join("; ") || "none";

  const monthRevenue = (monthRev.data ?? [])
    .filter((e: any) => e.type === "inflow" || e.type === "in" || e.type === "income")
    .reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

  return `You are Dylan's business operating system for L'Isolina Pasta LLC, a Brooklyn-based specialty food brand. You have access to live operational data pulled from the database. Your job is to help Dylan make fast, high-quality decisions as a solo founder managing cash flow, inventory, production, wholesale accounts, and DTC.

LIVE DATA AS OF ${today.toISOString()}:
- Cash balance: $${Number(balance).toLocaleString()} (as of ${balanceDate})
- Operating floor: $15,000 — never drop below this
- Current month revenue (cash inflows MTD): $${monthRevenue.toLocaleString()}
- Inventory alerts: ${lowInv}
- Active production runs: ${activeRuns}
- Upcoming cash obligations (next 8 weeks): ${upcoming}

Business context:
- Faire is 77% of revenue, pays next-day after fulfillment
- Misfits Market is strategically most important retail account
- Run #1 (12,000 units SD) ships ~May 4, inventory arrives ~May 11
- Run #2 (18,000 units SD) targets AES pack May 18-25, ship June 1
- Three new SKUs launching Fall 2026: Porcini, Cacio e Pepe, Assassina
- Key vendor contacts: Raina Dutton (RMSC ingredients), AES (co-packer), Jemstone (tubes), Rolando (warehouse Sabah)
- Three active loans: Original Wayflyer ($1,078 biweekly ~Sep 2026), New Wayflyer ($1,459-3,311 biweekly Nov 2026), GoodBread ($450.65 semi-monthly Apr 2027)

Answer questions about cash position, inventory risk, production timing, channel margins, and help draft vendor/customer emails when asked. Be direct, specific, and commercially minded.`;
}

async function streamChat({
  messages,
  onDelta,
  onDone,
}: {
  messages: Msg[];
  onDelta: (deltaText: string) => void;
  onDone: () => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok || !resp.body) {
    const text = await resp.text();
    throw new Error(text || "Failed to start stream");
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

export default function AIChatWidget() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! Ask me anything about inventory, sales velocity, or pending orders." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const assistantBuffer = useRef("");
  const systemRef = useRef<string>("");

  useEffect(() => {
    if (open) document.title = "AI Inventory Chat | Assistant";
    return () => { document.title = "L'Isolina Inventory Management System"; };
  }, [open]);

  useEffect(() => {
    if (open) {
      buildLiveContext().then((s) => { systemRef.current = s; }).catch((e) => console.error("ctx fail", e));
    }
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Msg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    assistantBuffer.current = "";

    const upsertAssistant = (delta: string) => {
      assistantBuffer.current += delta;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantBuffer.current } : m));
        }
        return [...prev, { role: "assistant", content: assistantBuffer.current }];
      });
    };

    try {
      const sys: Msg[] = systemRef.current ? [{ role: "system", content: systemRef.current }] : [];
      await streamChat({
        messages: [...sys, ...messages, userMsg],
        onDelta: upsertAssistant,
        onDone: () => setLoading(false),
      });
    } catch (e) {
      console.error(e);
      setLoading(false);
      toast({ title: "Chat error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    }
  };

  const popout = () => {
    window.open("/chat", "ai-chat", "width=480,height=720");
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          className="fixed bottom-6 right-6 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-3 shadow-sm hover:bg-accent focus:outline-none"
          aria-label="Open AI chat"
        >
          <MessageSquare className="h-5 w-5" />
          <span>Ask AI</span>
        </button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[80vh]">
        <DrawerHeader className="flex items-center justify-between">
          <DrawerTitle>AI Assistant</DrawerTitle>
          <Button variant="ghost" size="sm" onClick={popout}>
            <ExternalLink className="h-4 w-4 mr-2" /> Pop out
          </Button>
        </DrawerHeader>
        <div className="px-4 pb-4 flex flex-col gap-3">
          <div className="h-72 overflow-y-auto rounded-md border p-3 bg-background">
            {messages.map((m, i) => (
              <div key={i} className="mb-2">
                <div className="text-xs text-muted-foreground mb-1">{m.role === "user" ? "You" : "Assistant"}</div>
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Ask about inventory, e.g. 'What should I reorder this week?'"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <Button onClick={send} disabled={loading}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
