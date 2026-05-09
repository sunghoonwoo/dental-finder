import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { reportId, pin } = await req.json();

    const { data, error } = await supabase.rpc("delete_report_with_pin", {
      p_report_id: reportId,
      p_pin: pin,
    });

    if (error) {
      console.error("[reports/delete] RPC error:", error);
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    const result = Array.isArray(data) ? data[0] : data;
    const ok = result?.ok ?? false;
    const visitId = result?.visit_id ?? null;

    console.log("[reports/delete] result:", { ok, visitId });

    return NextResponse.json({ ok, visitId });
  } catch (e) {
    console.error("[API POST /reports/delete]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
