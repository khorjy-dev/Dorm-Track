/**
 * Supabase Edge Function: sends one row from public.mail via Resend.
 *
 * Setup:
 * 1. supabase secrets set --project-ref <ref> RESEND_API_KEY=re_xxx
 * 2. supabase secrets set --project-ref <ref> RESEND_FROM="DormTrack <onboarding@resend.dev>"
 *    (use a domain you verify in Resend for production)
 * 3. Optional: supabase secrets set --project-ref <ref> WEBHOOK_SECRET=long-random-string
 * 4. Deploy: supabase functions deploy send-mail --project-ref <ref>
 * 5. Supabase Dashboard → Database → Webhooks: INSERT on public.mail
 *    URL: https://<ref>.supabase.co/functions/v1/send-mail
 *    HTTP Headers: x-webhook-secret: <same as WEBHOOK_SECRET> (if set)
 *
 * Env SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically on Supabase.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

type MailRecord = {
  id: string;
  to_email: string;
  message: { subject?: string; text?: string };
  metadata?: { incidentId?: string; relation?: string; source?: string } | null;
};

function isMailRecord(p: unknown): p is MailRecord {
  return (
    typeof p === "object" &&
    p !== null &&
    "id" in p &&
    "to_email" in p &&
    typeof (p as MailRecord).to_email === "string"
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyWebhook(req: Request): Promise<Response | null> {
  const secret = Deno.env.get("WEBHOOK_SECRET");
  if (!secret) return null;
  const got = req.headers.get("x-webhook-secret") ?? "";
  if (got !== secret) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  const unauthorized = await verifyWebhook(req);
  if (unauthorized) return unauthorized;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "missing Supabase env" }, 500);
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM") ?? "DormTrack <onboarding@resend.dev>";
  if (!resendKey) {
    return jsonResponse({ error: "RESEND_API_KEY not configured" }, 500);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "invalid json" }, 400);
  }

  const body = payload as {
    record?: MailRecord | MailRecord[];
    payload?: { record?: MailRecord };
  };
  const record = body.record ?? body.payload?.record ?? (isMailRecord(payload) ? payload : undefined);

  const records: MailRecord[] = Array.isArray(record) ? record : record ? [record] : [];
  if (records.length === 0) {
    return jsonResponse({ error: "no record" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const row of records) {
    if (!row?.id || !row?.to_email) {
      results.push({ id: String(row?.id ?? ""), ok: false, error: "missing id or to_email" });
      continue;
    }

    const { data: existing } = await supabase.from("mail").select("sent_at").eq("id", row.id).maybeSingle();
    if (existing?.sent_at) {
      results.push({ id: row.id, ok: true });
      continue;
    }

    const subject = row.message?.subject ?? "DormTrack notification";
    const text = row.message?.text ?? "";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [row.to_email],
        subject,
        text,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      await supabase
        .from("mail")
        .update({ send_error: errText.slice(0, 2000) })
        .eq("id", row.id);

      const incidentId = row.metadata?.incidentId;
      if (incidentId) {
        await supabase
          .from("incidents")
          .update({ email_status: "queue_failed", email_error: `Resend: ${errText.slice(0, 500)}` })
          .eq("id", incidentId);
      }

      results.push({ id: row.id, ok: false, error: errText });
      continue;
    }

    await supabase.from("mail").update({ sent_at: new Date().toISOString(), send_error: null }).eq("id", row.id);

    const incidentId = row.metadata?.incidentId;
    if (incidentId) {
      const { data: statsRows } = await supabase.rpc("mail_send_stats_for_incident", {
        incident_id: incidentId,
      });
      const stats = Array.isArray(statsRows) ? statsRows[0] : statsRows;
      const total = Number((stats as { total_count?: number })?.total_count ?? 0);
      const sent = Number((stats as { sent_count?: number })?.sent_count ?? 0);
      if (total > 0 && sent === total) {
        await supabase
          .from("incidents")
          .update({ email_status: "sent", email_error: "" })
          .eq("id", incidentId);
      }
    }

    results.push({ id: row.id, ok: true });
  }

  return jsonResponse({ ok: true, results });
});
