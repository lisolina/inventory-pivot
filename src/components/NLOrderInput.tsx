import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface NLOrderInputProps {
  onOrderCreated: () => void;
}

export const NLOrderInput = ({ onOrderCreated }: NLOrderInputProps) => {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-email-order", {
        body: { text: input, autoCreate: true },
      });
      if (error) throw error;
      if (data?.order) {
        toast({ title: "Order Created", description: `${data.order.customer_name} — added to open orders` });
        setInput("");
        onOrderCreated();
      } else {
        toast({ title: "Couldn't parse", description: "Try being more specific (customer, product, quantity)", variant: "destructive" });
      }
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
            placeholder='e.g. "Jason at Almond wants a case of radiatori for ASAP"'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleSubmit()}
            className="flex-1"
          />
          <Button onClick={handleSubmit} disabled={loading || !input.trim()} size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Type a natural language order and hit enter — AI will parse customer, product & quantity</p>
      </CardContent>
    </Card>
  );
};
