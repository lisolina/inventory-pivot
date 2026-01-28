import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ParsedPO {
  customer?: string;
  poNumber?: string | null;
  items?: Array<{ product: string; quantity: number; unit: string }>;
  actions?: string[];
  notes?: string;
  error?: string;
  suggestion?: string;
  rawResponse?: string;
}

interface UploadedPO {
  fileName: string;
  status: "parsing" | "success" | "error";
  result?: ParsedPO;
  error?: string;
}

interface POUploaderProps {
  onAddTask?: (title: string, description?: string) => void;
}

export function POUploader({ onAddTask }: POUploaderProps) {
  const { toast } = useToast();
  const [uploadedPOs, setUploadedPOs] = useState<UploadedPO[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const readFileContent = async (file: File): Promise<string> => {
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
      // Add file to list with parsing status
      setUploadedPOs(prev => [...prev, { 
        fileName: file.name, 
        status: "parsing" 
      }]);

      try {
        // Read file content
        let fileContent: string;
        
        if (file.type === "application/pdf") {
          // For PDFs, we'll send a message that PDF parsing needs special handling
          fileContent = `[PDF Document: ${file.name}] - Please note this is a PDF file. Extract any visible text or describe the document structure.`;
        } else {
          fileContent = await readFileContent(file);
        }

        // Call the edge function to parse with AI
        const { data, error } = await supabase.functions.invoke('parse-po-document', {
          body: { 
            fileName: file.name,
            fileContent: fileContent.substring(0, 50000) // Limit content size
          }
        });

        if (error) throw error;

        setUploadedPOs(prev => prev.map(po => 
          po.fileName === file.name 
            ? { ...po, status: "success", result: data.result }
            : po
        ));

        toast({
          title: "PO Parsed",
          description: `Successfully analyzed ${file.name}`,
        });

      } catch (error) {
        console.error("Error processing file:", error);
        setUploadedPOs(prev => prev.map(po => 
          po.fileName === file.name 
            ? { ...po, status: "error", error: error instanceof Error ? error.message : "Failed to parse" }
            : po
        ));

        toast({
          title: "Error",
          description: `Failed to parse ${file.name}`,
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const handleAddToTasks = (action: string, customer?: string) => {
    if (onAddTask) {
      onAddTask(action, customer ? `From PO for ${customer}` : undefined);
      toast({
        title: "Task Added",
        description: action,
      });
    }
  };

  const clearResults = () => {
    setUploadedPOs([]);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          PO Upload & Parse
        </CardTitle>
        {uploadedPOs.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearResults}>
            Clear
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging 
              ? "border-primary bg-primary/5" 
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
        >
          <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">
            Drag & drop PO files here, or click to browse
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Supports TXT, CSV, and text-based documents
          </p>
          <input
            type="file"
            onChange={handleFileInput}
            className="hidden"
            id="po-file-input"
            multiple
            accept=".txt,.csv,.pdf,.doc,.docx"
          />
          <Button variant="outline" asChild>
            <label htmlFor="po-file-input" className="cursor-pointer">
              Select Files
            </label>
          </Button>
        </div>

        {/* Results */}
        {uploadedPOs.length > 0 && (
          <div className="space-y-4">
            {uploadedPOs.map((po, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{po.fileName}</span>
                  </div>
                  {po.status === "parsing" && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Parsing...
                    </Badge>
                  )}
                  {po.status === "success" && (
                    <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                      <CheckCircle2 className="h-3 w-3" />
                      Parsed
                    </Badge>
                  )}
                  {po.status === "error" && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Error
                    </Badge>
                  )}
                </div>

                {po.status === "success" && po.result && (
                  <div className="space-y-3">
                    {po.result.error ? (
                      <p className="text-sm text-muted-foreground">{po.result.error}</p>
                    ) : (
                      <>
                        {po.result.customer && (
                          <div>
                            <span className="text-xs text-muted-foreground">Customer:</span>
                            <p className="font-medium">{po.result.customer}</p>
                          </div>
                        )}
                        
                        {po.result.poNumber && (
                          <div>
                            <span className="text-xs text-muted-foreground">PO #:</span>
                            <p className="font-medium">{po.result.poNumber}</p>
                          </div>
                        )}

                        {po.result.items && po.result.items.length > 0 && (
                          <div>
                            <span className="text-xs text-muted-foreground">Items:</span>
                            <ul className="text-sm mt-1 space-y-1">
                              {po.result.items.map((item, i) => (
                                <li key={i} className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-primary" />
                                  {item.quantity} {item.unit} - {item.product}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {po.result.actions && po.result.actions.length > 0 && (
                          <div>
                            <span className="text-xs text-muted-foreground">Suggested Actions:</span>
                            <div className="mt-2 space-y-2">
                              {po.result.actions.map((action, i) => (
                                <div key={i} className="flex items-center justify-between bg-muted/50 rounded p-2">
                                  <span className="text-sm">{action}</span>
                                  {onAddTask && (
                                    <Button 
                                      size="sm" 
                                      variant="ghost"
                                      onClick={() => handleAddToTasks(action, po.result?.customer)}
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {po.result.notes && (
                          <div>
                            <span className="text-xs text-muted-foreground">Notes:</span>
                            <p className="text-sm text-muted-foreground">{po.result.notes}</p>
                          </div>
                        )}
                      </>
                    )}

                    {po.result.rawResponse && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs">
                        <pre className="whitespace-pre-wrap">{po.result.rawResponse}</pre>
                      </div>
                    )}
                  </div>
                )}

                {po.status === "error" && (
                  <p className="text-sm text-destructive">{po.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
