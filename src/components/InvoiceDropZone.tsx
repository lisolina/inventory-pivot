import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface InvoiceDropZoneProps {
  onInvoiceCreated: () => void;
}

export const InvoiceDropZone = ({ onInvoiceCreated }: InvoiceDropZoneProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [parsed, setParsed] = useState<any>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setParsed(null);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("parse-po-document", {
        body: {
          fileName: file.name,
          fileBase64: base64,
          mimeType: file.type,
          autoCreateOrder: false,
        },
      });
      if (error) throw error;

      const r = data.result;
      if (r?.customer && r?.items?.length > 0) {
        const totalAmount = r.items.reduce((sum: number, i: any) => sum + (i.quantity * (i.unitPrice || 0)), 0);
        const dueDate = r.deliveryDate || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

        const { error: invErr } = await supabase.from("invoices").insert({
          customer: r.customer,
          amount: totalAmount || parseFloat(r.totalAmount) || 0,
          due_date: dueDate,
          invoice_number: r.poNumber || r.invoiceNumber || null,
        });
        if (invErr) throw invErr;

        setParsed(r);
        toast({ title: "Invoice Created", description: `${r.customer} — $${totalAmount || r.totalAmount || 0}` });
        onInvoiceCreated();
      } else {
        toast({ title: "Could not parse invoice", description: "Try adding it manually", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, onInvoiceCreated]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
      }`}
    >
      {loading ? (
        <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
      ) : parsed ? (
        <div className="flex flex-col items-center gap-2">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
          <p className="text-sm font-medium">Invoice from {parsed.customer} added</p>
          <Button variant="ghost" size="sm" onClick={() => setParsed(null)}>Add Another</Button>
        </div>
      ) : (
        <>
          <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-1">Drop an invoice PDF/image here</p>
          <p className="text-xs text-muted-foreground mb-3">AI will extract vendor, amount & due date</p>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" id="invoice-drop" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <Button variant="outline" size="sm" asChild>
            <label htmlFor="invoice-drop" className="cursor-pointer">Select File</label>
          </Button>
        </>
      )}
    </div>
  );
};
