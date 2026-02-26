import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const QuickBooksCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const exchange = async () => {
      const code = searchParams.get("code");
      const realmId = searchParams.get("realmId");

      if (!code || !realmId) {
        setStatus("error");
        setErrorMsg("Missing authorization code or realm ID from QuickBooks.");
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setStatus("error");
          setErrorMsg("You must be logged in to connect QuickBooks.");
          return;
        }

        const redirectUri = `${window.location.origin}/quickbooks/callback`;

        const { data, error } = await supabase.functions.invoke("quickbooks-auth", {
          body: { action: "callback", code, realmId, redirectUri },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setStatus("success");
        setTimeout(() => navigate("/?tab=money"), 2000);
      } catch (err: any) {
        console.error("QB callback error:", err);
        setStatus("error");
        setErrorMsg(err.message || "Failed to connect QuickBooks.");
      }
    };

    exchange();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <h2 className="text-xl font-semibold">Connecting QuickBooks...</h2>
              <p className="text-muted-foreground">Exchanging authorization tokens.</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
              <h2 className="text-xl font-semibold">QuickBooks Connected!</h2>
              <p className="text-muted-foreground">Redirecting to Money tab...</p>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 mx-auto text-destructive" />
              <h2 className="text-xl font-semibold">Connection Failed</h2>
              <p className="text-muted-foreground">{errorMsg}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuickBooksCallback;
