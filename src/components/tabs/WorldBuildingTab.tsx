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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Send, Loader2, Globe, BookOpen, Code, Palette, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface WorldTask {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  deadline: string | null;
  priority: string;
  notes: string | null;
  created_at: string;
}

const categoryIcons: Record<string, any> = {
  substack: BookOpen,
  lovable: Code,
  website: Globe,
  artifacts: Palette,
  merch: ShoppingBag,
};

const priorityColors: Record<string, string> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
};

export const WorldBuildingTab = () => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<WorldTask[]>([]);
  const [filter, setFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", category: "substack", deadline: "", priority: "medium", notes: "" });
  const [nlInput, setNlInput] = useState("");
  const [nlParsing, setNlParsing] = useState(false);
  const [parsedTasks, setParsedTasks] = useState<{ title: string; category: string; priority?: string }[]>([]);

  const fetchTasks = async () => {
    const { data } = await supabase.from("world_tasks").select("*").order("created_at", { ascending: false });
    if (data) setTasks(data as any);
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleAdd = async () => {
    try {
      const { error } = await supabase.from("world_tasks").insert({
        title: newTask.title,
        description: newTask.description || null,
        category: newTask.category,
        deadline: newTask.deadline || null,
        priority: newTask.priority,
        notes: newTask.notes || null,
      } as any);
      if (error) throw error;
      toast({ title: "Task Added" });
      setAddOpen(false);
      setNewTask({ title: "", description: "", category: "substack", deadline: "", priority: "medium", notes: "" });
      fetchTasks();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const toggleStatus = async (id: string, current: string) => {
    const next = current === "done" ? "pending" : current === "pending" ? "in-progress" : "done";
    await supabase.from("world_tasks").update({ status: next } as any).eq("id", id);
    fetchTasks();
  };

  const deleteTask = async (id: string) => {
    await supabase.from("world_tasks").delete().eq("id", id);
    fetchTasks();
    toast({ title: "Task Deleted" });
  };

  const handleNlSubmit = async () => {
    if (!nlInput.trim()) return;
    setNlParsing(true);
    try {
      const res = await supabase.functions.invoke("chat", {
        body: {
          messages: [
            { role: "system", content: `Extract tasks from the user's input for a "World Building" tracker. Categories: substack, lovable, website, artifacts, merch. Return ONLY a JSON array: [{"title":"...","category":"...","priority":"high|medium|low"}]` },
            { role: "user", content: nlInput },
          ],
        },
      });
      if (res.error) throw res.error;
      const reader = res.data instanceof ReadableStream ? res.data.getReader() : null;
      let fullText = "";
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try { const j = JSON.parse(line.slice(6)); const d = j.choices?.[0]?.delta?.content; if (d) fullText += d; } catch {}
            }
          }
        }
      }
      const m = fullText.match(/\[[\s\S]*\]/);
      if (m) setParsedTasks(JSON.parse(m[0]));
      else toast({ title: "Couldn't parse tasks", variant: "destructive" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setNlParsing(false); }
  };

  const confirmParsed = async () => {
    for (const t of parsedTasks) {
      await supabase.from("world_tasks").insert({ title: t.title, category: t.category || "substack", priority: t.priority || "medium" } as any);
    }
    toast({ title: `${parsedTasks.length} tasks added` });
    setParsedTasks([]);
    setNlInput("");
    fetchTasks();
  };

  const filtered = filter === "all" ? tasks : tasks.filter(t => t.category === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold flex items-center gap-2"><Globe className="h-6 w-6" /> World Building</h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Task</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add World Building Task</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="e.g. Write Substack post on pasta history" /></div>
              <div><Label>Description</Label><Textarea value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select value={newTask.category} onValueChange={(v) => setNewTask({ ...newTask, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="substack">Substack</SelectItem>
                      <SelectItem value="lovable">Lovable</SelectItem>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="artifacts">Artifacts</SelectItem>
                      <SelectItem value="merch">Merch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Deadline</Label><Input type="date" value={newTask.deadline} onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })} /></div>
              <div><Label>Notes</Label><Textarea value={newTask.notes} onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })} /></div>
              <Button onClick={handleAdd} className="w-full" disabled={!newTask.title}>Add Task</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* NL Input */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex gap-2">
            <Textarea
              value={nlInput}
              onChange={(e) => setNlInput(e.target.value)}
              placeholder="Type a freeform update... e.g. 'Need to write a Substack post about the porcini launch story, update the .world site with new product photos, and design merch stickers.'"
              className="min-h-[60px] flex-1"
            />
            <Button onClick={handleNlSubmit} disabled={nlParsing || !nlInput.trim()} className="self-end">
              {nlParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          {parsedTasks.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium">Extracted tasks:</p>
              {parsedTasks.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-sm bg-muted rounded px-3 py-2">
                  <Badge variant="outline">{t.category}</Badge>
                  <span className="flex-1">{t.title}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setParsedTasks(parsedTasks.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Button size="sm" onClick={confirmParsed}>Add {parsedTasks.length} Tasks</Button>
                <Button size="sm" variant="outline" onClick={() => setParsedTasks([])}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="substack">Substack</TabsTrigger>
          <TabsTrigger value="lovable">Lovable</TabsTrigger>
          <TabsTrigger value="website">Website</TabsTrigger>
          <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
          <TabsTrigger value="merch">Merch</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Task List */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No tasks yet. Add one above or use natural language input.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const Icon = categoryIcons[t.category] || Globe;
            return (
              <Card key={t.id} className={t.status === "done" ? "opacity-60" : ""}>
                <CardContent className="py-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={t.status === "done"}
                      onCheckedChange={() => toggleStatus(t.id, t.status)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className={`font-medium ${t.status === "done" ? "line-through" : ""}`}>{t.title}</span>
                        <Badge variant="outline" className="text-xs capitalize">{t.category}</Badge>
                        <Badge variant={priorityColors[t.priority] as any} className="text-xs">{t.priority}</Badge>
                        {t.status === "in-progress" && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs">In Progress</Badge>}
                      </div>
                      {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {t.deadline && <span>Due: {format(new Date(t.deadline), "MMM d, yyyy")}</span>}
                        {t.notes && <span>Notes: {t.notes}</span>}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => deleteTask(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
