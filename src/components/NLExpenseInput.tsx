import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface NLExpenseInputProps {
  onExpenseCreated: () => void;
}

export const NLExpenseInput = ({ onExpenseCreated }: NLExpenseInputProps) => {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          message: `Parse this expense description and return ONLY a JSON object with these fields: description (string), amount (number), date (YYYY-MM-DD string), category (one of: cogs, packaging, shipping, marketing, warehouse, subscription, insurance, other). Here is the text: "${input}"`,
        },
      });
      if (error) throw error;

      const content = data?.reply || data?.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) throw new Error("Could not parse expense");

      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      if (!parsed.amount || !parsed.description) throw new Error("Missing amount or description");

      const { error: insertErr } = await supabase.from("expenses").insert({
        description: parsed.description,
        amount: parsed.amount,
        category: parsed.category || "other",
        date: parsed.date || new Date().toISOString(),
        type: "one-time",
        status: "upcoming",
        notes: `Added via NL: "${input}"`,
      });
      if (insertErr) throw insertErr;

      toast({ title: "Expense Added", description: `$${parsed.amount} — ${parsed.description}` });
      setInput("");
      onExpenseCreated();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardContent className="pt-4 pb-4">
        <div className="flex gap-2">
          <Input
            placeholder='e.g. "We have a $2,000 payment for tubes packaging to Jemstone on March 15"'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleSubmit()}
            className="flex-1"
          />
          <Button onClick={handleSubmit} disabled={loading || !input.trim()} size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Type an upcoming expense in plain language — AI will parse amount, date & category
        </p>
      </CardContent>
    </Card>
  );
};
