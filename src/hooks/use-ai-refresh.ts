import { useEffect } from "react";

/**
 * Subscribe to AI-driven data changes. The AIChatWidget emits this event
 * after a successful tool call so that any tab can refetch its data.
 */
export function useAiRefresh(handler: () => void) {
  useEffect(() => {
    const fn = () => handler();
    window.addEventListener("ai-data-changed", fn);
    return () => window.removeEventListener("ai-data-changed", fn);
  }, [handler]);
}