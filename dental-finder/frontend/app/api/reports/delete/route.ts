import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { reportId, pin } = await req.json();
    const { data: deleted, error } = await supabase.rpc("delete_report_with_pin", {
      p_report_id: reportId,
      p_pin: pin,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let visitId: string | undefined;
    if (deleted) {
      const { data: sibling } = await supabase
        .from("user_price_reports")
        .select("visit_id")
        .eq("report_id", reportId)
        .maybeSingle();
      if (sibling?.visit_id) {
        visitId = sibling.visit_id;
        await supabase.from("user_price_reports").delete().eq("visit_id", visitId);
      }
    }

    return NextResponse.json({ ok: !!deleted, visitId });
  } catch (e) {
    console.error("[API POST /reports/delete]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
