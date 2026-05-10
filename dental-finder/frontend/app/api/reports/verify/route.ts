import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { reportId, pin } = await req.json();
    console.log("[verify] reportId:", reportId, "pin:", pin, "pinType:", typeof pin, "pinLength:", pin?.length);

    // Try RPC first
    const { data: rpcOk, error: rpcError } = await supabase.rpc("verify_report_pin", {
      p_report_id: reportId,
      p_pin: pin,
    });

    console.log("[verify] RPC result — data:", rpcOk, "error:", rpcError?.message);

    if (rpcError) {
      console.warn("[verify] RPC failed, falling back to direct query. Error:", rpcError.message);
    }

    // Fallback: direct query
    if (rpcError) {
      const { data: row, error: dbError } = await supabase
        .from("user_price_reports")
        .select("pin")
        .eq("report_id", reportId)
        .maybeSingle();

      console.log("[verify] Direct query — row:", JSON.stringify(row), "dbError:", dbError?.message);

      if (dbError) {
        return NextResponse.json({ error: dbError.message }, { status: 500 });
      }

      if (!row) {
        return NextResponse.json({ ok: false });
      }

      const match = row.pin != null && String(row.pin) === String(pin);
      console.log("[verify] Direct comparison — dbPin:", row.pin, "match:", match);
      return NextResponse.json({ ok: match });
    }

    const ok = !!rpcOk;
    console.log("[verify] RPC ok:", ok);
    return NextResponse.json({ ok });
  } catch (e) {
    console.error("[API POST /reports/verify]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
