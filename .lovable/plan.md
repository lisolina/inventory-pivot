

## Plan: Fix World Building Task Parsing

### Root Cause

`supabase.functions.invoke("chat", ...)` doesn't reliably expose the SSE stream as a `ReadableStream`. The `res.data instanceof ReadableStream` check fails, so `fullText` stays empty, and parsing fails every time.

### Fix

**1. Edge function (`supabase/functions/chat/index.ts`)**: Accept an optional `stream` boolean in the request body (default `true`). When `stream: false`, return a plain JSON response instead of SSE.

**2. World Building tab (`WorldBuildingTab.tsx`)**: Call with `stream: false` so `supabase.functions.invoke` returns parsed JSON directly. Extract the content from `res.data.choices[0].message.content` — no SSE parsing needed.

### Changes

**`supabase/functions/chat/index.ts`**:
- Destructure `stream` from request body (default `true`)
- Pass `stream` value to the AI gateway
- If `!stream`, read the gateway response as JSON and return it as JSON (not SSE)

**`src/components/tabs/WorldBuildingTab.tsx`**:
- In `handleNlSubmit`, add `stream: false` to the request body
- Replace the SSE reader logic with direct JSON access: `const fullText = res.data?.choices?.[0]?.message?.content || ""`
- Keep the existing fence-stripping and array extraction logic

