import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { reportId, pin } = await req.json();

    const { data: report, error: fetchError } = await supabase
      .from("user_price_reports")
      .select("pin, visit_id, clinic_id")
      .eq("report_id", reportId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (report.pin && report.pin !== pin) {
      return NextResponse.json({ ok: false });
    }

    const targetVisitId = report.visit_id;
    const targetClinicId = report.clinic_id;

    if (targetVisitId) {
      const { error: deleteError } = await supabase
        .from("user_price_reports")
        .delete()
        .eq("visit_id", targetVisitId)
        .eq("clinic_id", targetClinicId);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
    } else {
      const { error: deleteError } = await supabase
        .from("user_price_reports")
        .delete()
        .eq("report_id", reportId);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, visitId: targetVisitId });
  } catch (e) {
    console.error("[API POST /reports/delete]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
