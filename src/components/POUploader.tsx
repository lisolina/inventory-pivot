import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ParsedPO {
  customer?: string;
  poNumber?: string | null;
  poDate?: string | null;
  deliveryDate?: string | null;
  items?: Array<{ product: string; quantity: number; unit: string; originalDescription?: string }>;
  notes?: string;
  error?: string;
  rawResponse?: string;
}

interface UploadedPO {
  fileName: string;
  status: "parsing" | "success" | "error";
  result?: ParsedPO;
  error?: string;
  orderCreated?: boolean;
  fileUrl?: string;
}

interface POUploaderProps {
  onAddTask?: (title: string, description?: string) => void;
  onOrderCreated?: () => void;
}

export function POUploader({ onAddTask, onOrderCreated }: POUploaderProps) {
  const { toast } = useToast();
  const [uploadedPOs, setUploadedPOs] = useState<UploadedPO[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      setUploadedPOs(prev => [...prev, { fileName: file.name, status: "parsing" }]);

      try {
        let body: any = { fileName: file.name, autoCreateOrder: true };
        let fileUrl: string | undefined;

        if (file.type === "application/pdf" || file.type.startsWith("image/")) {
          const base64 = await fileToBase64(file);
          body.fileBase64 = base64;
          body.mimeType = file.type;

          // Upload to storage for viewing
          const filePath = `pos/${Date.now()}-${file.name}`;
          const fileBlob = new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], { type: file.type });
          const { error: uploadErr } = await supabase.storage.from("document-uploads").upload(filePath, fileBlob, { contentType: file.type });
          if (!uploadErr) {
            fileUrl = supabase.storage.from("document-uploads").getPublicUrl(filePath).data.publicUrl;
          }
        } else {
          const content = await readFileContent(file);
          body.fileContent = content.substring(0, 50000);
        }

        const { data, error } = await supabase.functions.invoke('parse-po-document', { body });
        if (error) throw error;

        // Update order with file_url if we have one
        if (fileUrl && data.createdOrder?.id) {
          await supabase.from("orders").update({ file_url: fileUrl } as any).eq("id", data.createdOrder.id);
        }

        setUploadedPOs(prev => prev.map(po => 
          po.fileName === file.name 
            ? { ...po, status: "success", result: data.result, orderCreated: !!data.createdOrder, fileUrl }
            : po
        ));

        if (data.createdOrder) {
          toast({ title: "Order Created", description: `Order from ${data.result?.customer} added automatically` });
          onOrderCreated?.();
        } else {
          toast({ title: "PO Parsed", description: `Analyzed ${file.name}` });
        }
      } catch (error) {
        console.error("Error processing file:", error);
        setUploadedPOs(prev => prev.map(po => 
          po.fileName === file.name 
            ? { ...po, status: "error", error: error instanceof Error ? error.message : "Failed to parse" }
            : po
        ));
        toast({ title: "Error", description: `Failed to parse ${file.name}`, variant: "destructive" });
      }
    }
  }, [toast, onOrderCreated]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" /> PO Upload & Parse
        </CardTitle>
        {uploadedPOs.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setUploadedPOs([])}>Clear</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
        >
          <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">Drag & drop PO files here, or click to browse</p>
          <p className="text-xs text-muted-foreground mb-4">Supports PDF, images, TXT, CSV</p>
          <input type="file" onChange={(e) => e.target.files && handleFiles(e.target.files)} className="hidden" id="po-file-input" multiple accept=".txt,.csv,.pdf,.png,.jpg,.jpeg,.doc,.docx" />
          <Button variant="outline" asChild>
            <label htmlFor="po-file-input" className="cursor-pointer">Select Files</label>
          </Button>
        </div>

        {uploadedPOs.map((po, index) => (
          <div key={index} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">{po.fileName}</span>
                {po.fileUrl && (
                  <a href={po.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              {po.status === "parsing" && <Badge variant="secondary" className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Parsing...</Badge>}
              {po.status === "success" && <Badge variant="default" className="flex items-center gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" /> {po.orderCreated ? "Order Created" : "Parsed"}</Badge>}
              {po.status === "error" && <Badge variant="destructive" className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Error</Badge>}
            </div>

            {po.status === "success" && po.result && !po.result.error && (
              <div className="space-y-3 text-sm">
                {po.result.customer && <div><span className="text-xs text-muted-foreground">Customer:</span><p className="font-medium">{po.result.customer}</p></div>}
                {po.result.poNumber && <div><span className="text-xs text-muted-foreground">PO #:</span><p className="font-medium">{po.result.poNumber}</p></div>}
                {po.result.poDate && <div><span className="text-xs text-muted-foreground">PO Date:</span><p>{po.result.poDate}</p></div>}
                {po.result.deliveryDate && <div><span className="text-xs text-muted-foreground">Delivery Date:</span><p>{po.result.deliveryDate}</p></div>}
                {po.result.items && po.result.items.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground">Items:</span>
                    <ul className="mt-1 space-y-1">
                      {po.result.items.map((item, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-primary" />
                          {item.quantity} {item.unit} — {item.product}
                          {item.originalDescription && item.originalDescription !== item.product && (
                            <span className="text-muted-foreground text-xs">({item.originalDescription})</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {po.result.notes && <div><span className="text-xs text-muted-foreground">Notes:</span><p className="text-muted-foreground">{po.result.notes}</p></div>}
              </div>
            )}
            {po.result?.rawResponse && (
              <div className="mt-2 p-2 bg-muted rounded text-xs"><pre className="whitespace-pre-wrap">{po.result.rawResponse}</pre></div>
            )}
            {po.status === "error" && <p className="text-sm text-destructive">{po.error}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
