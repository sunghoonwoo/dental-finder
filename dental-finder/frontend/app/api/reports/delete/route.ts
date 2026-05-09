import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { reportId, pin } = await req.json();
    console.log("[delete] reportId:", reportId, "pin:", pin);

    const { data, error } = await supabase.rpc("delete_report_with_pin", {
      p_report_id: reportId,
      p_pin: pin,
    });

    if (error) {
      console.error("[delete] RPC error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("[delete] RPC result:", JSON.stringify(data));

    const ok = data?.[0]?.ok ?? false;
    const visitId: string | undefined = data?.[0]?.visit_id ?? undefined;

    if (!ok) {
      console.warn("[delete] RPC returned ok=false — wrong pin or not found");
      return NextResponse.json({ ok: false, visitId: undefined }, { status: 400 });
    }

    return NextResponse.json({ ok: true, visitId });
  } catch (e) {
    console.error("[API POST /reports/delete]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
