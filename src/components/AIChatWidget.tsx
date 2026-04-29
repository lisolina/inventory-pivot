import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, ExternalLink, Send, X, GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

type ToolEvent = { name: string; ok: boolean; error?: string };
type Msg = { role: "user" | "assistant" | "system"; content: string; tools?: ToolEvent[] };

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
  onToolEvent,
}: {
  messages: Msg[];
  onDelta: (deltaText: string) => void;
  onDone: () => void;
  onToolEvent?: (ev: ToolEvent) => void;
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
        if (parsed.tool_event && onToolEvent) {
          onToolEvent(parsed.tool_event as ToolEvent);
          continue;
        }
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
        if (parsed.tool_event && onToolEvent) {
          onToolEvent(parsed.tool_event as ToolEvent);
          continue;
        }
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Window position + size (persisted)
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("aiChat.pos") || "null");
      if (saved) return saved;
    } catch {}
    return { x: typeof window !== "undefined" ? window.innerWidth - 480 : 100, y: typeof window !== "undefined" ? window.innerHeight - 620 : 100 };
  });
  const [size, setSize] = useState<{ w: number; h: number }>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("aiChat.size") || "null");
      if (saved) return saved;
    } catch {}
    return { w: 460, h: 600 };
  });

  useEffect(() => { localStorage.setItem("aiChat.pos", JSON.stringify(pos)); }, [pos]);
  useEffect(() => { localStorage.setItem("aiChat.size", JSON.stringify(size)); }, [size]);

  useEffect(() => {
    if (open) document.title = "AI Inventory Chat | Assistant";
    return () => { document.title = "L'Isolina Inventory Management System"; };
  }, [open]);

  useEffect(() => {
    if (open) {
      buildLiveContext().then((s) => { systemRef.current = s; }).catch((e) => console.error("ctx fail", e));
    }
  }, [open]);

  // Auto-scroll to bottom whenever messages update or window opens
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, open, loading]);

  // Dragging
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const onDragStart = (e: React.MouseEvent) => {
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
  };
  const onDragMove = (e: MouseEvent) => {
    const s = dragState.current; if (!s) return;
    const nx = Math.max(0, Math.min(window.innerWidth - 100, s.origX + (e.clientX - s.startX)));
    const ny = Math.max(0, Math.min(window.innerHeight - 60, s.origY + (e.clientY - s.startY)));
    setPos({ x: nx, y: ny });
  };
  const onDragEnd = () => {
    dragState.current = null;
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragEnd);
  };

  // Resizing (bottom-right corner)
  const resizeState = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);
  const onResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    resizeState.current = { startX: e.clientX, startY: e.clientY, origW: size.w, origH: size.h };
    window.addEventListener("mousemove", onResizeMove);
    window.addEventListener("mouseup", onResizeEnd);
  };
  const onResizeMove = (e: MouseEvent) => {
    const s = resizeState.current; if (!s) return;
    const nw = Math.max(320, Math.min(window.innerWidth - 40, s.origW + (e.clientX - s.startX)));
    const nh = Math.max(320, Math.min(window.innerHeight - 40, s.origH + (e.clientY - s.startY)));
    setSize({ w: nw, h: nh });
  };
  const onResizeEnd = () => {
    resizeState.current = null;
    window.removeEventListener("mousemove", onResizeMove);
    window.removeEventListener("mouseup", onResizeEnd);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Msg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    assistantBuffer.current = "";
    const toolBuffer: ToolEvent[] = [];

    const upsertAssistant = (delta: string) => {
      assistantBuffer.current += delta;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantBuffer.current, tools: toolBuffer.length ? [...toolBuffer] : m.tools } : m));
        }
        return [...prev, { role: "assistant", content: assistantBuffer.current, tools: toolBuffer.length ? [...toolBuffer] : undefined }];
      });
    };
    const handleToolEvent = (ev: ToolEvent) => {
      toolBuffer.push(ev);
      // Surface a refresh signal for tabs to re-fetch
      if (ev.ok) {
        try { window.dispatchEvent(new CustomEvent("ai-data-changed", { detail: ev })); } catch {}
      }
      // Make sure the assistant bubble exists so chips show even before text arrives
      upsertAssistant("");
    };

    try {
      const sys: Msg[] = systemRef.current ? [{ role: "system", content: systemRef.current }] : [];
      await streamChat({
        messages: [...sys, ...messages, userMsg],
        onDelta: upsertAssistant,
        onDone: () => setLoading(false),
        onToolEvent: handleToolEvent,
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
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50/80 backdrop-blur px-4 py-3 shadow-md hover:bg-sky-100 focus:outline-none"
          aria-label="Open AI chat"
        >
          <MessageSquare className="h-5 w-5 text-sky-700" />
          <span className="text-sky-900 font-medium">Ask AI</span>
        </button>
      )}

      {open && (
        <div
          className="fixed z-50 flex flex-col rounded-xl border border-sky-200/70 shadow-2xl overflow-hidden"
          style={{
            left: pos.x,
            top: pos.y,
            width: size.w,
            height: size.h,
            background: "linear-gradient(180deg, hsla(200, 90%, 92%, 0.85) 0%, hsla(205, 85%, 88%, 0.78) 100%)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
          }}
        >
          {/* Header (drag handle) */}
          <div
            onMouseDown={onDragStart}
            className="flex items-center justify-between px-4 py-2 cursor-move border-b border-sky-200/60 bg-sky-100/40 select-none"
          >
            <div className="flex items-center gap-2">
              <GripHorizontal className="h-4 w-4 text-sky-700/70" />
              <span className="text-sm font-semibold text-sky-900">AI Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={popout} className="h-7 px-2 text-sky-900 hover:bg-sky-200/50">
                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Pop out
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-7 w-7 text-sky-900 hover:bg-sky-200/50">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => {
              const isUser = m.role === "user";
              return (
                <div key={i} className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap shadow-sm",
                      isUser
                        ? "bg-sky-600 text-white rounded-br-sm"
                        : "bg-white/85 text-slate-800 rounded-bl-sm border border-sky-100"
                    )}
                  >
                    {m.content}
                    {m.tools && m.tools.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.tools.map((t, j) => (
                          <span
                            key={j}
                            className={cn(
                              "inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border",
                              t.ok
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            )}
                            title={t.error ?? "applied"}
                          >
                            {t.ok ? "✓" : "!"} {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/70 text-slate-500 text-xs rounded-2xl px-3 py-2 border border-sky-100">thinking…</div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-sky-200/60 bg-white/40 flex gap-2">
            <Input
              placeholder="Ask about inventory, e.g. 'What should I reorder this week?'"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              className="bg-white/80 border-sky-200 focus-visible:ring-sky-400"
            />
            <Button onClick={send} disabled={loading} className="bg-sky-600 hover:bg-sky-700 text-white">
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Resize handle */}
          <div
            onMouseDown={onResizeStart}
            className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
            style={{
              background:
                "linear-gradient(135deg, transparent 0 50%, hsla(205, 70%, 50%, 0.6) 50% 60%, transparent 60% 70%, hsla(205, 70%, 50%, 0.6) 70% 80%, transparent 80%)",
            }}
            aria-label="Resize"
          />
        </div>
      )}
    </>
  );
}
