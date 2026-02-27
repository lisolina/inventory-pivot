import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  CheckSquare, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Loader2,
  Check,
  Trash2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  source: string | null;
  source_id: string | null;
  created_at: string;
}

interface TasksTileProps {
  initialShowAll?: boolean;
}

export function TasksTile({ initialShowAll = false }: TasksTileProps) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(initialShowAll);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .neq('status', 'completed')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, []);

  const addTask = async (title: string, description?: string, source?: string, sourceId?: string) => {
    const { data, error } = await supabase
      .from('tasks')
      .insert({ title, description: description || null, source: source || null, source_id: sourceId || null, status: 'pending', priority: 'medium' })
      .select()
      .single();
    if (error) throw error;
    setTasks(prev => [data, ...prev]);
    return data;
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    setIsAdding(true);
    try {
      await addTask(newTaskTitle.trim());
      setNewTaskTitle("");
      toast({ title: "Task Added", description: newTaskTitle.trim() });
    } catch {
      toast({ title: "Error", description: "Failed to add task", variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  const completeTask = async (taskId: string) => {
    try {
      const { error } = await supabase.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', taskId);
      if (error) throw error;
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast({ title: "Task Completed" });
    } catch {
      toast({ title: "Error", description: "Failed to complete task", variant: "destructive" });
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast({ title: "Task Deleted" });
    } catch {
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
    }
  };

  const displayedTasks = showAll ? tasks : tasks.slice(0, 5);
  const hasMoreTasks = tasks.length > 5;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-warning text-warning-foreground';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getSourceBadge = (source: string | null) => {
    if (!source) return null;
    switch (source) {
      case 'email': return <Badge variant="outline" className="text-xs">Email PO</Badge>;
      case 'po_upload': return <Badge variant="outline" className="text-xs">Uploaded PO</Badge>;
      default: return <Badge variant="outline" className="text-xs">{source}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5" />
          Tasks
          {tasks.length > 0 && <Badge variant="secondary" className="ml-2">{tasks.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Add a new task..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
            disabled={isAdding}
          />
          <Button onClick={handleAddTask} disabled={!newTaskTitle.trim() || isAdding} size="icon">
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No tasks yet. Add one above!</div>
        ) : (
          <Collapsible open={showAll} onOpenChange={setShowAll}>
            <div className="space-y-2">
              {displayedTasks.map((task) => (
                <div 
                  key={task.id} 
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 rounded-full border border-muted-foreground/30 hover:bg-primary hover:text-primary-foreground"
                      onClick={() => completeTask(task.id)}
                    >
                      <Check className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Button>
                    
                    <div 
                      className="flex-1 min-w-0 cursor-pointer" 
                      onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                    >
                      <p className="font-medium text-sm">{task.title}</p>
                      {task.description && expandedTask !== task.id && (
                        <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {getSourceBadge(task.source)}
                      <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>{task.priority}</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                        onClick={() => deleteTask(task.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {expandedTask === task.id && task.description && (
                    <div className="mt-2 ml-9 p-2 bg-muted rounded text-sm text-muted-foreground whitespace-pre-wrap">
                      {task.description}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {hasMoreTasks && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full mt-2" size="sm">
                  {showAll ? (
                    <><ChevronUp className="h-4 w-4 mr-2" /> Show Less</>
                  ) : (
                    <><ChevronDown className="h-4 w-4 mr-2" /> Show {tasks.length - 5} More Tasks</>
                  )}
                </Button>
              </CollapsibleTrigger>
            )}

            <CollapsibleContent />
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

export const useTaskActions = () => {
  const { toast } = useToast();
  const addTask = async (title: string, description?: string, source?: string, sourceId?: string) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({ title, description: description || null, source: source || null, source_id: sourceId || null, status: 'pending', priority: 'medium' })
        .select().single();
      if (error) throw error;
      toast({ title: "Task Added", description: title });
      return data;
    } catch (error) {
      toast({ title: "Error", description: "Failed to add task", variant: "destructive" });
      throw error;
    }
  };
  return { addTask };
};
