import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CSVUploaderProps {
  onUploadComplete: () => void;
}

export const CSVUploader = ({ onUploadComplete }: CSVUploaderProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<{ count: number } | null>(null);

  const parseCSV = (text: string) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const header = lines[0].toLowerCase();
    // Chase format: Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
    const isChase = header.includes("posting date") || header.includes("details");

    // Parse header to find column indices
    const headerCols = lines[0].split(",").map(c => c.replace(/^"|"$/g, "").trim().toLowerCase());
    const balanceIdx = headerCols.findIndex(h => h === "balance" || h.includes("balance"));

    const entries: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      // Handle CSV with quoted fields containing commas
      const cols: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const char of lines[i]) {
        if (char === '"') { inQuotes = !inQuotes; continue; }
        if (char === ',' && !inQuotes) { cols.push(current.trim()); current = ""; continue; }
        current += char;
      }
      cols.push(current.trim());

      if (cols.length < 3) continue;

      let date: string, description: string, amount: number, balance: number | null = null;

      if (isChase) {
        // Chase: Details, Posting Date, Description, Amount, Type, Balance
        date = cols[1];
        description = cols[2];
        amount = parseFloat(cols[3]);
        // Get balance from the Balance column
        if (balanceIdx >= 0 && cols[balanceIdx]) {
          const bal = parseFloat(cols[balanceIdx].replace(/[^0-9.-]/g, ""));
          if (!isNaN(bal)) balance = bal;
        } else if (cols[5]) {
          const bal = parseFloat(cols[5].replace(/[^0-9.-]/g, ""));
          if (!isNaN(bal)) balance = bal;
        }
      } else {
        // Generic: Date, Description, Amount, Balance
        date = cols[0];
        description = cols[1];
        amount = parseFloat(cols[2]);
        if (cols[3]) {
          const bal = parseFloat(cols[3].replace(/[^0-9.-]/g, ""));
          if (!isNaN(bal)) balance = bal;
        }
      }

      if (isNaN(amount)) continue;

      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) continue;

      entries.push({
        date: parsedDate.toISOString(),
        type: amount >= 0 ? "in" : "out",
        amount: Math.abs(amount),
        description,
        balance_after: balance,
      });
    }
    return entries;
  };

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setResult(null);
    try {
      const text = await file.text();
      const entries = parseCSV(text);
      if (entries.length === 0) {
        toast({ title: "No entries found", description: "Check CSV format", variant: "destructive" });
        return;
      }

      const batchSize = 100;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const { error } = await supabase.from("cash_entries").insert(batch);
        if (error) throw error;
      }

      setResult({ count: entries.length });
      toast({ title: "CSV Imported", description: `${entries.length} transactions imported` });
      onUploadComplete();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) handleFile(file);
  }, [handleFile]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" /> Import Bank Statement
        </CardTitle>
      </CardHeader>
      <CardContent>
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
          ) : result ? (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <p className="text-sm font-medium">{result.count} transactions imported</p>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">Drop a bank statement CSV here</p>
              <p className="text-xs text-muted-foreground mb-3">Supports Chase CSV format</p>
              <input type="file" accept=".csv" className="hidden" id="csv-upload" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <Button variant="outline" size="sm" asChild>
                <label htmlFor="csv-upload" className="cursor-pointer">Select CSV</label>
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
