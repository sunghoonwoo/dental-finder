import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("[reports/delete] SUPABASE_SERVICE_ROLE_KEY not set — falling back to anon key. DELETE may fail if no RLS policy exists.");
}

export async function POST(req: NextRequest) {
  try {
    const { reportId, pin } = await req.json();
    console.log("[reports/delete] reportId:", reportId, "pin:", pin);

    const { data: report, error: fetchError } = await supabaseAdmin
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

    console.log("[reports/delete] fetched report:", JSON.stringify(report));

    if (report.pin && report.pin !== pin) {
      return NextResponse.json({ ok: false });
    }

    const targetVisitId = report.visit_id;
    const targetClinicId = report.clinic_id;

    console.log("[reports/delete] targetVisitId:", targetVisitId, "targetClinicId:", targetClinicId);

    if (targetVisitId) {
      const { data: deleteData, error: deleteError } = await supabaseAdmin
        .from("user_price_reports")
        .delete()
        .eq("visit_id", targetVisitId)
        .eq("clinic_id", targetClinicId);

      if (deleteError) {
        console.error("[reports/delete] delete error:", deleteError);
        return NextResponse.json({ error: deleteError.message, details: deleteError }, { status: 500 });
      }

      console.log("[reports/delete] deleted rows:", deleteData);
    } else {
      const { data: deleteData, error: deleteError } = await supabaseAdmin
        .from("user_price_reports")
        .delete()
        .eq("report_id", reportId);

      if (deleteError) {
        console.error("[reports/delete] delete error:", deleteError);
        return NextResponse.json({ error: deleteError.message, details: deleteError }, { status: 500 });
      }

      console.log("[reports/delete] deleted rows:", deleteData);
    }

    return NextResponse.json({ ok: true, visitId: targetVisitId });
  } catch (e) {
    console.error("[API POST /reports/delete]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
