import { useEffect } from "react";
import AIChatWidget from "@/components/AIChatWidget";

export default function ChatPage() {
  useEffect(() => {
    document.title = "AI Inventory Chat | Assistant";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-6">
        <h1 className="text-2xl font-bold mb-4">AI Assistant</h1>
        <p className="text-muted-foreground mb-6">Pop-out window for chatting with your inventory assistant.</p>
        <div className="max-w-2xl">
          <AIChatWidget />
        </div>
      </div>
    </div>
  );
}
