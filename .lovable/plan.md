## Plan: Use Claude as the AI Chat Widget backend

### What changes

Swap the Lovable AI Gateway call inside `supabase/functions/chat/index.ts` for an Anthropic Claude API call. The frontend (`AIChatWidget.tsx`) stays the same — it keeps streaming SSE and keeps building the live business context — because we'll have the edge function emit OpenAI-shaped SSE chunks (`choices[0].delta.content`) that the existing parser already understands. No client changes needed.

### Steps

1. **Add `ANTHROPIC_API_KEY` secret**
   - Prompt you to paste your Anthropic API key (get it from https://console.anthropic.com/settings/keys).
   - Stored as a Lovable Cloud secret, used only server-side in the edge function.

2. **Rewrite `supabase/functions/chat/index.ts`**
   - Read `ANTHROPIC_API_KEY` instead of `LOVABLE_API_KEY`.
   - Split incoming `messages`: pull out the `system` message (Anthropic takes `system` as a top-level string, not a message), pass the rest as `messages`.
   - Call `https://api.anthropic.com/v1/messages` with `stream: true`, model `claude-sonnet-4-5` (latest Sonnet), `max_tokens: 4096`.
   - Translate Anthropic's SSE events (`content_block_delta` with `text_delta`) into OpenAI-shaped SSE chunks: `data: {"choices":[{"delta":{"content":"..."}}]}\n\n`, ending with `data: [DONE]\n\n`.
   - Keep the existing 429 / 402 / generic error handling and CORS headers.
   - Keep the non-streaming branch (`stream: false`) for `WorldBuildingTab` and `NLExpenseInput` — return an OpenAI-shaped JSON `{ choices: [{ message: { content } }] }` so those callers keep working unchanged.

3. **No frontend changes**
   - `AIChatWidget.tsx`, `WorldBuildingTab.tsx`, `NLExpenseInput.tsx` all keep working because the edge function's response shape stays the same.
   - The hardcoded business-context system prompt is still built client-side and sent as the `system` message — the edge function just hands it to Claude correctly.

### Model choice

Default to `claude-sonnet-4-5` (best balance of reasoning + speed for this kind of business-context analysis). If you'd rather use Opus 4 for max reasoning, or Haiku for cheapest/fastest, say the word and I'll swap the model string.

### Notes

- `parse-email-order` and `parse-po-document` edge functions are separate and will keep using whatever they use today — only the `chat` function switches to Claude.
- Anthropic billing is on your Anthropic account (separate from Lovable AI credits).