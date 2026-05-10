import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { reportId } = await req.json();
    console.log("[requires-pin] reportId:", reportId);

    const { data: rpcResult, error: rpcError } = await supabase.rpc("report_requires_pin", {
      p_report_id: reportId,
    });

    console.log("[requires-pin] RPC result:", rpcResult, "error:", rpcError?.message);

    if (rpcError) {
      console.warn("[requires-pin] RPC failed, falling back to direct query:", rpcError.message);
    }

    if (rpcError) {
      const { data: row, error: dbError } = await supabase
        .from("user_price_reports")
        .select("pin")
        .eq("report_id", reportId)
        .maybeSingle();

      console.log("[requires-pin] Direct query — row:", JSON.stringify(row), "dbError:", dbError?.message);

      if (dbError) {
        return NextResponse.json({ error: dbError.message }, { status: 500 });
      }

      const requires = row?.pin != null && row.pin !== "";
      return NextResponse.json({ requiresPin: requires });
    }

    return NextResponse.json({ requiresPin: !!rpcResult });
  } catch (e) {
    console.error("[API POST /reports/requires-pin]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
