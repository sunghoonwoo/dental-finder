import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clinicId, treatmentIds, price, visitDate, extraRecommended, extraNote, reviewText, friendlinessScore, nickname, pin } = body;

    if (!clinicId || !treatmentIds?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const visitId = crypto.randomUUID();
    const rows = treatmentIds.map((tid: number) => ({
      clinic_id: clinicId,
      treatment_id: tid,
      visit_id: visitId,
      pin,
      price,
      visit_date: visitDate || null,
      extra_recommended: extraRecommended,
      extra_note: extraNote || null,
      review_text: reviewText || null,
      friendliness_score: friendlinessScore,
      nickname: nickname || null,
    }));

    const { data, error } = await supabase
      .from("user_price_reports")
      .insert(rows)
      .select("report_id");

    if (error) {
      console.error("[POST] Insert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      console.error("[POST] RLS BLOCKED insert — no rows returned. visitId:", visitId);
      return NextResponse.json({
        error: "DB 저장이 차단되었습니다. Supabase RLS 정책을 확인해주세요.",
        hint: "Run 20260510000002_fix_rls_policies.sql in Supabase SQL Editor"
      }, { status: 500 });
    }

    console.log("[POST] Created:", data.length, "reports");
    return NextResponse.json({ reportIds: data.map((r: { report_id: string }) => r.report_id) });
  } catch (e) {
    console.error("[API POST /reports]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { reportId, treatmentIds, price, visitDate, extraRecommended, extraNote, reviewText, friendlinessScore, nickname } = body;

    if (!reportId) {
      return NextResponse.json({ error: "Missing reportId" }, { status: 400 });
    }

    if (!treatmentIds?.length) {
      return NextResponse.json({ error: "At least one treatment required" }, { status: 400 });
    }

    // Try SECURITY DEFINER RPC first (bypasses RLS)
    const { data: rpcData, error: rpcError } = await supabase.rpc("update_report_with_pin", {
      p_report_id: reportId,
      p_treatment_ids: treatmentIds,
      p_price: price,
      p_visit_date: visitDate || null,
      p_extra_recommended: extraRecommended,
      p_extra_note: extraNote || null,
      p_review_text: reviewText || null,
      p_friendliness_score: friendlinessScore,
      p_nickname: nickname || null,
    });

    if (!rpcError && rpcData?.[0]?.success) {
      console.log("[PUT] RPC success — visit_id:", rpcData[0].visit_id, "treatmentIds:", treatmentIds);
      return NextResponse.json({ success: true });
    }

    if (rpcError) {
      console.warn("[PUT] RPC failed, falling back to direct writes. Error:", rpcError.message);
    } else {
      console.warn("[PUT] RPC returned ok=false, falling back to direct writes");
    }

    // Fallback: direct write operations with verification

    // Fetch visit_id, clinic_id, and pin for this report
    const { data: report, error: fetchError } = await supabase
      .from("user_price_reports")
      .select("visit_id, clinic_id, pin, treatment_id")
      .eq("report_id", reportId)
      .single();

    if (fetchError || !report) {
      console.error("[PUT] Report not found:", reportId, fetchError?.message);
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Get all rows in the same visit group
    const { data: visitGroup } = await supabase
      .from("user_price_reports")
      .select("report_id, treatment_id")
      .eq("visit_id", report.visit_id)
      .eq("clinic_id", report.clinic_id);

    console.log("[PUT] visitGroup:", JSON.stringify(visitGroup), "selected treatmentIds:", treatmentIds);

    // 1. Update the report being edited
    const { error: updateError } = await supabase
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
      console.error("[PUT] Update error:", updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Verify the update actually took effect (RLS may silently swallow it)
    const { data: verifyUpdated } = await supabase
      .from("user_price_reports")
      .select("treatment_id, price, review_text")
      .eq("report_id", reportId)
      .maybeSingle();

    if (!verifyUpdated) {
      console.error("[PUT] RLS BLOCKED update — row not found after update. reportId:", reportId);
      return NextResponse.json({
        error: "DB 업데이트가 차단되었습니다. Supabase Dashboard에서 RLS 정책을 확인해주세요.",
        hint: "Run 20260510000002_fix_rls_policies.sql in Supabase SQL Editor"
      }, { status: 500 });
    }

    if (verifyUpdated.treatment_id !== treatmentIds[0]) {
      console.error("[PUT] RLS BLOCKED update — treatment_id unchanged. expected:", treatmentIds[0], "actual:", verifyUpdated.treatment_id);
      return NextResponse.json({
        error: "DB 업데이트가 차단되었습니다. Supabase RLS 정책이 필요합니다.",
        hint: "Run 20260510000002_fix_rls_policies.sql in Supabase SQL Editor"
      }, { status: 500 });
    }

    console.log("[PUT] Update verified — treatment_id:", verifyUpdated.treatment_id);

    // 2. Delete deselected treatments
    const toRemove = visitGroup?.filter(
      (r) => r.report_id !== reportId && !treatmentIds.includes(r.treatment_id)
    ) ?? [];
    if (toRemove.length > 0) {
      const removeIds = toRemove.map((r) => r.report_id);
      const { error: deleteError, data: deleteData } = await supabase
        .from("user_price_reports")
        .delete()
        .in("report_id", removeIds)
        .select("report_id");

      if (deleteError) {
        console.error("[PUT] Delete error:", deleteError.message);
      } else {
        console.log("[PUT] Deleted:", deleteData?.length ?? 0, "rows (expected:", toRemove.length, ")");
      }
    }

    // 3. Re-fetch remaining rows and insert missing treatments
    const { data: remaining } = await supabase
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
      const { error: insertError, data: insertData } = await supabase
        .from("user_price_reports")
        .insert(newRows)
        .select("report_id");

      if (insertError) {
        console.error("[PUT] Insert error:", insertError.message);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      console.log("[PUT] Inserted:", insertData?.length ?? 0, "rows");
    }

    console.log("[PUT] success — visit_id:", report.visit_id, "treatmentIds:", treatmentIds);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[API PUT /reports]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
