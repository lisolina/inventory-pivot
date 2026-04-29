import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, stream: streamRequested = true } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const clientMessages = Array.isArray(messages) ? messages : [];
    // Anthropic takes `system` as a top-level string, not a message
    const systemMsgs = clientMessages.filter((m: any) => m.role === "system");
    const convoMsgs = clientMessages
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) => ({ role: m.role, content: String(m.content ?? "") }));
    const systemPrompt =
      systemMsgs.map((m: any) => String(m.content ?? "")).join("\n\n") ||
      "You are an expert business operating assistant. Be concise and commercially minded.";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: systemPrompt,
        messages: convoMsgs,
        stream: streamRequested,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add credits to your Anthropic account." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Anthropic error:", response.status, t);
      return new Response(JSON.stringify({ error: `Anthropic error: ${t}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!streamRequested) {
      const json = await response.json();
      // Translate Anthropic non-streaming response -> OpenAI shape
      const text = Array.isArray(json?.content)
        ? json.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("")
        : "";
      const openaiShaped = {
        id: json?.id,
        choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: json?.stop_reason ?? "stop" }],
        usage: json?.usage,
      };
      return new Response(JSON.stringify(openaiShaped), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Translate Anthropic SSE -> OpenAI-shaped SSE so existing client parser works.
    const upstream = response.body!;
    const translated = new ReadableStream({
      async start(controller) {
        const reader = upstream.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = "";
        const sendDelta = (text: string) => {
          const chunk = { choices: [{ index: 0, delta: { content: text } }] };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        };
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let idx: number;
            while ((idx = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, idx);
              buffer = buffer.slice(idx + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (!data) continue;
              try {
                const evt = JSON.parse(data);
                if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
                  sendDelta(evt.delta.text || "");
                } else if (evt.type === "message_stop") {
                  controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                }
              } catch { /* ignore partial */ }
            }
          }
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        } catch (err) {
          console.error("stream translate error:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(translated, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
