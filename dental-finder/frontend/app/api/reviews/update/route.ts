import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const serviceClient = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const db = () => serviceClient ?? anonClient;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reportId, pin, treatmentIds, price, visitDate, extraRecommended, extraNote, reviewText, friendlinessScore, nickname } = body;

    if (!reportId) {
      return NextResponse.json({ error: "Missing reportId" }, { status: 400 });
    }
    if (!treatmentIds?.length) {
      return NextResponse.json({ error: "At least one treatment required" }, { status: 400 });
    }

    // Get report data for pin verification
    const { data: report, error: fetchError } = await anonClient
      .from("user_price_reports")
      .select("visit_id, clinic_id, pin")
      .eq("report_id", reportId)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Verify pin
    if (report.pin && String(report.pin) !== String(pin)) {
      return NextResponse.json({ error: "비번이 틀렸습니다" }, { status: 403 });
    }

    const client = db();

    // Get existing visit group
    const { data: visitGroup } = await client
      .from("user_price_reports")
      .select("report_id, treatment_id")
      .eq("visit_id", report.visit_id)
      .eq("clinic_id", report.clinic_id);

    // 1. Update the report being edited
    const { error: updateError } = await client
      .from("user_price_reports")
      .update({
        treatment_id: treatmentIds[0],
        price,
        visit_date: visitDate || null,
        extra_recommended: extraRecommended,
        extra_note: extraNote || null,
        review_text: reviewText || null,
        friendliness_score: friendlinessScore,
        nickname: nickname || null,
      })
      .eq("report_id", reportId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 2. Delete deselected treatments
    const toRemove = visitGroup?.filter(
      (r) => r.report_id !== reportId && !treatmentIds.includes(r.treatment_id)
    ) ?? [];
    if (toRemove.length > 0) {
      await client
        .from("user_price_reports")
        .delete()
        .in("report_id", toRemove.map((r) => r.report_id));
    }

    // 3. Insert new treatments
    const { data: remaining } = await client
      .from("user_price_reports")
      .select("treatment_id")
      .eq("visit_id", report.visit_id)
      .eq("clinic_id", report.clinic_id);

    const remainingTids = remaining?.map((r) => r.treatment_id) ?? [];
    const toAdd = treatmentIds.filter((tid: number) => !remainingTids.includes(tid));
    if (toAdd.length > 0) {
      const newRows = toAdd.map((tid: number) => ({
        clinic_id: report.clinic_id,
        treatment_id: tid,
        visit_id: report.visit_id,
        pin: report.pin,
        price,
        visit_date: visitDate || null,
        extra_recommended: extraRecommended,
        extra_note: extraNote || null,
        review_text: reviewText || null,
        friendliness_score: friendlinessScore,
        nickname: nickname || null,
      }));
      const { error: insertError } = await client
        .from("user_price_reports")
        .insert(newRows);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    console.log("[reviews/update] success — visit_id:", report.visit_id, "treatmentIds:", treatmentIds, "using_service_role:", !!serviceClient);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[API POST /reviews/update]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
