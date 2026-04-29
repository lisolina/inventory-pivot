import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const ANTHROPIC_MODEL = "claude-sonnet-4-5";

// ---------- Tool registry ----------
const tools = [
  {
    name: "update_cash_balance",
    description: "Set the current cash on hand. Creates a new dated entry in cash_balance.",
    input_schema: {
      type: "object",
      properties: {
        balance: { type: "number", description: "Current cash on hand in USD" },
        notes: { type: "string" },
        date: { type: "string", description: "ISO date YYYY-MM-DD; defaults to today" },
      },
      required: ["balance"],
    },
  },
  {
    name: "add_expense",
    description: "Record a one-time expense (recurring expenses use add_recurring_expense).",
    input_schema: {
      type: "object",
      properties: {
        amount: { type: "number" },
        description: { type: "string" },
        category: { type: "string", description: "e.g. ingredients, packaging, payroll, software, loan, shipping, other" },
        date: { type: "string", description: "ISO date" },
        status: { type: "string", enum: ["upcoming", "paid"] },
        notes: { type: "string" },
      },
      required: ["amount", "description"],
    },
  },
  {
    name: "add_recurring_expense",
    description: "Add a recurring subscription/expense.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        amount: { type: "number" },
        frequency: { type: "string", enum: ["weekly", "biweekly", "monthly", "quarterly", "yearly", "semi-monthly"] },
        next_due_date: { type: "string" },
        category: { type: "string" },
      },
      required: ["name", "amount"],
    },
  },
  {
    name: "add_cash_flow_entry",
    description: "Add a forecasted or actual cash inflow/outflow on a specific week.",
    input_schema: {
      type: "object",
      properties: {
        week_starting: { type: "string", description: "ISO date of Monday of that week" },
        description: { type: "string" },
        inflow: { type: "number" },
        outflow: { type: "number" },
        category: { type: "string" },
        status: { type: "string", enum: ["forecast", "actual"] },
        notes: { type: "string" },
      },
      required: ["week_starting", "description"],
    },
  },
  {
    name: "create_task",
    description: "Create a manual task in the operational task list.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["title"],
    },
  },
  {
    name: "create_world_task",
    description: "Create a World Building task (Substack, website, merch, artifacts, etc.).",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        category: { type: "string", enum: ["substack", "lovable", "website", "artifacts", "merch", "other"] },
        priority: { type: "string", enum: ["low", "medium", "high"] },
        deadline: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_production_run",
    description: "Update an existing production run by run_id (e.g., 'Run #2'). Pass only fields to change.",
    input_schema: {
      type: "object",
      properties: {
        run_id: { type: "string" },
        stage: { type: "string", enum: ["planning", "ingredients_ordered", "tubes_ordered", "staged", "packed", "shipped", "complete"] },
        actual_units: { type: "number" },
        shipped_date: { type: "string" },
        aes_pack_start: { type: "string" },
        aes_pack_complete: { type: "string" },
        tubes_landed_date: { type: "string" },
        notes: { type: "string" },
      },
      required: ["run_id"],
    },
  },
  {
    name: "add_production_cost",
    description: "Log an expense against a production run (tubes, ingredients, AES, freight).",
    input_schema: {
      type: "object",
      properties: {
        run_id: { type: "string" },
        expense_type: { type: "string", description: "tubes | ingredients | aes_pack | freight | other" },
        vendor: { type: "string" },
        amount: { type: "number" },
        date_due: { type: "string" },
        date_paid: { type: "string" },
        status: { type: "string", enum: ["pending", "paid"] },
        notes: { type: "string" },
      },
      required: ["run_id", "amount"],
    },
  },
  {
    name: "update_inventory_item",
    description: "Adjust units_on_hand or reorder_level for an inventory_items row matched by product_name (case-insensitive).",
    input_schema: {
      type: "object",
      properties: {
        product_name: { type: "string" },
        units_on_hand: { type: "string" },
        reorder_level: { type: "string" },
        cases_on_hand: { type: "string" },
      },
      required: ["product_name"],
    },
  },
  {
    name: "add_order",
    description: "Create a wholesale or DTC order.",
    input_schema: {
      type: "object",
      properties: {
        customer_name: { type: "string" },
        source: { type: "string", description: "faire | distributor | dtc | other" },
        po_number: { type: "string" },
        total_value: { type: "number" },
        order_date: { type: "string" },
        status: { type: "string" },
        notes: { type: "string" },
      },
      required: ["customer_name"],
    },
  },
  {
    name: "update_order_status",
    description: "Update an existing order's status / invoice status / tracking.",
    input_schema: {
      type: "object",
      properties: {
        po_number: { type: "string", description: "Match order by po_number (preferred)" },
        customer_name: { type: "string", description: "Or fall back to customer name" },
        status: { type: "string" },
        invoice_status: { type: "string" },
        invoice_number: { type: "string" },
        tracking_number: { type: "string" },
        carrier: { type: "string" },
        ship_date: { type: "string" },
        payment_date: { type: "string" },
      },
    },
  },
  {
    name: "add_crm_account",
    description: "Add a sales CRM account / lead.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        contact_name: { type: "string" },
        contact_email: { type: "string" },
        status: { type: "string", description: "prospect | contacted | sampled | won | lost | dormant" },
        followup_cadence_days: { type: "number" },
        notes: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "log_crm_activity",
    description: "Log an activity (note, email, call, meeting) against an existing CRM account, matched by name.",
    input_schema: {
      type: "object",
      properties: {
        account_name: { type: "string" },
        type: { type: "string", enum: ["note", "email", "call", "meeting", "sample_sent"] },
        description: { type: "string" },
        date: { type: "string" },
      },
      required: ["account_name", "description"],
    },
  },
  {
    name: "add_launch_milestone",
    description: "Add a Dust Launch milestone (ordering, production, marketing, etc.).",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        category: { type: "string", description: "ordering | production | marketing | shipping | other" },
        deadline: { type: "string" },
        cash_impact: { type: "number" },
        lead_time_days: { type: "number" },
        payment_terms: { type: "string" },
        notes: { type: "string" },
      },
      required: ["title"],
    },
  },
];

// ---------- Tool handlers ----------
async function executeTool(name: string, input: any): Promise<{ ok: boolean; result?: any; error?: string }> {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  try {
    switch (name) {
      case "update_cash_balance": {
        const date = input.date || new Date().toISOString().slice(0, 10);
        const { data, error } = await sb
          .from("cash_balance")
          .insert({ balance: input.balance, notes: input.notes ?? null, date })
          .select()
          .single();
        if (error) throw error;
        return { ok: true, result: data };
      }
      case "add_expense": {
        const { data, error } = await sb
          .from("expenses")
          .insert({
            amount: input.amount,
            description: input.description,
            category: input.category ?? "other",
            date: input.date ? new Date(input.date).toISOString() : new Date().toISOString(),
            status: input.status ?? "upcoming",
            notes: input.notes ?? null,
            type: "one-time",
          })
          .select()
          .single();
        if (error) throw error;
        return { ok: true, result: data };
      }
      case "add_recurring_expense": {
        const { data, error } = await sb
          .from("recurring_expenses")
          .insert({
            name: input.name,
            amount: input.amount,
            frequency: input.frequency ?? "monthly",
            next_due_date: input.next_due_date ? new Date(input.next_due_date).toISOString() : null,
            category: input.category ?? "subscription",
          })
          .select()
          .single();
        if (error) throw error;
        return { ok: true, result: data };
      }
      case "add_cash_flow_entry": {
        const { data, error } = await sb
          .from("cash_flows")
          .insert({
            week_starting: input.week_starting,
            description: input.description,
            inflow: input.inflow ?? 0,
            outflow: input.outflow ?? 0,
            category: input.category ?? null,
            status: input.status ?? "forecast",
            notes: input.notes ?? null,
          })
          .select()
          .single();
        if (error) throw error;
        return { ok: true, result: data };
      }
      case "create_task": {
        const { data, error } = await sb
          .from("tasks")
          .insert({
            title: input.title,
            description: input.description ?? null,
            priority: input.priority ?? "medium",
            source: "ai_chat",
          })
          .select()
          .single();
        if (error) throw error;
        return { ok: true, result: data };
      }
      case "create_world_task": {
        const { data, error } = await sb
          .from("world_tasks")
          .insert({
            title: input.title,
            description: input.description ?? null,
            category: input.category ?? "other",
            priority: input.priority ?? "medium",
            deadline: input.deadline ? new Date(input.deadline).toISOString() : null,
          })
          .select()
          .single();
        if (error) throw error;
        return { ok: true, result: data };
      }
      case "update_production_run": {
        const { run_id, ...rest } = input;
        const patch: Record<string, any> = {};
        for (const [k, v] of Object.entries(rest)) {
          if (v == null) continue;
          if (["shipped_date", "aes_pack_start", "aes_pack_complete", "tubes_landed_date", "tubes_ordered_date", "ingredients_staged_date"].includes(k)) {
            patch[k] = new Date(v as string).toISOString();
          } else {
            patch[k] = v;
          }
        }
        const { data, error } = await sb.from("production_runs").update(patch).eq("run_id", run_id).select();
        if (error) throw error;
        if (!data?.length) return { ok: false, error: `No production_run with run_id=${run_id}` };
        return { ok: true, result: data };
      }
      case "add_production_cost": {
        const { data, error } = await sb
          .from("production_run_costs")
          .insert({
            run_id: input.run_id,
            expense_type: input.expense_type ?? null,
            vendor: input.vendor ?? null,
            amount: input.amount,
            date_due: input.date_due ? new Date(input.date_due).toISOString() : null,
            date_paid: input.date_paid ? new Date(input.date_paid).toISOString() : null,
            status: input.status ?? "pending",
            notes: input.notes ?? null,
            date_incurred: new Date().toISOString(),
          })
          .select()
          .single();
        if (error) throw error;
        return { ok: true, result: data };
      }
      case "update_inventory_item": {
        const { product_name, ...rest } = input;
        const { data: matches, error: e1 } = await sb
          .from("inventory_items")
          .select("id, product_name")
          .ilike("product_name", `%${product_name}%`)
          .limit(2);
        if (e1) throw e1;
        if (!matches?.length) return { ok: false, error: `No inventory item matching '${product_name}'` };
        if (matches.length > 1) return { ok: false, error: `Ambiguous: ${matches.map(m => m.product_name).join(", ")}` };
        const { data, error } = await sb.from("inventory_items").update({ ...rest, last_synced: new Date().toISOString() }).eq("id", matches[0].id).select().single();
        if (error) throw error;
        return { ok: true, result: data };
      }
      case "add_order": {
        const { data, error } = await sb
          .from("orders")
          .insert({
            customer_name: input.customer_name,
            source: input.source ?? "distributor",
            po_number: input.po_number ?? null,
            total_value: input.total_value ?? null,
            order_date: input.order_date ? new Date(input.order_date).toISOString() : new Date().toISOString(),
            status: input.status ?? "new",
            notes: input.notes ?? null,
          })
          .select()
          .single();
        if (error) throw error;
        return { ok: true, result: data };
      }
      case "update_order_status": {
        let q = sb.from("orders").select("id").limit(2);
        if (input.po_number) q = q.eq("po_number", input.po_number);
        else if (input.customer_name) q = q.ilike("customer_name", `%${input.customer_name}%`);
        else return { ok: false, error: "Provide po_number or customer_name" };
        const { data: matches, error: e1 } = await q;
        if (e1) throw e1;
        if (!matches?.length) return { ok: false, error: "No matching order" };
        if (matches.length > 1) return { ok: false, error: "Ambiguous match — be more specific" };
        const patch: Record<string, any> = {};
        for (const k of ["status", "invoice_status", "invoice_number", "tracking_number", "carrier"]) {
          if (input[k] != null) patch[k] = input[k];
        }
        for (const k of ["ship_date", "payment_date"]) {
          if (input[k]) patch[k] = new Date(input[k]).toISOString();
        }
        const { data, error } = await sb.from("orders").update(patch).eq("id", matches[0].id).select().single();
        if (error) throw error;
        return { ok: true, result: data };
      }
      case "add_crm_account": {
        const { data, error } = await sb
          .from("crm_accounts")
          .insert({
            name: input.name,
            contact_name: input.contact_name ?? null,
            contact_email: input.contact_email ?? null,
            status: input.status ?? "prospect",
            followup_cadence_days: input.followup_cadence_days ?? 10,
            notes: input.notes ?? null,
          })
          .select()
          .single();
        if (error) throw error;
        return { ok: true, result: data };
      }
      case "log_crm_activity": {
        const { data: acct, error: e1 } = await sb.from("crm_accounts").select("id").ilike("name", `%${input.account_name}%`).limit(2);
        if (e1) throw e1;
        if (!acct?.length) return { ok: false, error: `No CRM account matching '${input.account_name}'` };
        if (acct.length > 1) return { ok: false, error: "Ambiguous CRM account" };
        const { data, error } = await sb
          .from("crm_activities")
          .insert({
            account_id: acct[0].id,
            type: input.type ?? "note",
            description: input.description,
            date: input.date ? new Date(input.date).toISOString() : new Date().toISOString(),
          })
          .select()
          .single();
        if (error) throw error;
        await sb.from("crm_accounts").update({ last_contact_date: new Date().toISOString() }).eq("id", acct[0].id);
        return { ok: true, result: data };
      }
      case "add_launch_milestone": {
        const { data, error } = await sb
          .from("launch_milestones")
          .insert({
            title: input.title,
            category: input.category ?? "ordering",
            deadline: input.deadline ? new Date(input.deadline).toISOString() : null,
            cash_impact: input.cash_impact ?? 0,
            lead_time_days: input.lead_time_days ?? 0,
            payment_terms: input.payment_terms ?? null,
            notes: input.notes ?? null,
          })
          .select()
          .single();
        if (error) throw error;
        return { ok: true, result: data };
      }
      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}

// ---------- Anthropic loop with tool use ----------
async function callAnthropic(systemPrompt: string, conversation: any[]) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: conversation,
      tools,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Anthropic ${resp.status}: ${t}`);
  }
  return await resp.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { messages } = await req.json();
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const clientMessages = Array.isArray(messages) ? messages : [];
    const systemMsgs = clientMessages.filter((m: any) => m.role === "system");
    const systemPrompt =
      systemMsgs.map((m: any) => String(m.content ?? "")).join("\n\n") +
      "\n\nYou have tools to write to the database. Use them when the user asks you to record, update, log, add, create, or change anything. For destructive or large changes, confirm first. After a successful tool call, briefly tell the user what changed.";

    // Build Anthropic conversation (only user/assistant)
    const conversation: any[] = clientMessages
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) => ({ role: m.role, content: String(m.content ?? "") }));

    const toolEvents: { name: string; input: any; ok: boolean; error?: string }[] = [];
    let finalText = "";

    // Up to 5 tool-use rounds
    for (let i = 0; i < 5; i++) {
      const resp = await callAnthropic(systemPrompt, conversation);
      const blocks = resp.content || [];
      const textBlocks = blocks.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
      const toolUses = blocks.filter((b: any) => b.type === "tool_use");

      if (!toolUses.length) {
        finalText = textBlocks;
        break;
      }

      // Push assistant turn (text + tool_use blocks) into conversation
      conversation.push({ role: "assistant", content: blocks });

      // Execute all tool_use blocks and reply with tool_result blocks
      const toolResults = [];
      for (const tu of toolUses) {
        const exec = await executeTool(tu.name, tu.input ?? {});
        toolEvents.push({ name: tu.name, input: tu.input, ok: exec.ok, error: exec.error });
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: exec.ok ? JSON.stringify(exec.result).slice(0, 4000) : `ERROR: ${exec.error}`,
          is_error: !exec.ok,
        });
      }
      conversation.push({ role: "user", content: toolResults });

      finalText = textBlocks; // in case loop ends
    }

    // Stream the final text out as OpenAI-shaped SSE so the client parser is unchanged.
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Tool events first as a special event the client can intercept
        if (toolEvents.length) {
          for (const ev of toolEvents) {
            const payload = { tool_event: ev };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          }
        }
        // Text in chunks
        const text = finalText || "Done.";
        const chunkSize = 80;
        for (let i = 0; i < text.length; i += chunkSize) {
          const slice = text.slice(i, i + chunkSize);
          const chunk = { choices: [{ index: 0, delta: { content: slice } }] };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      },
    });
    return new Response(stream, {
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
