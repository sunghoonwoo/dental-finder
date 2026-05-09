import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clinicId, treatmentIds, price, visitDate, extraRecommended, extraNote, reviewText, friendlinessScore, nickname, pin, consultationType, overtreatmentOtherTeeth, overtreatmentDiscountPressure, consultationTime, tags, receiptImageUrl } = body;

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
      consultation_type: consultationType || null,
      overtreatment_other_teeth: overtreatmentOtherTeeth ?? null,
      overtreatment_discount_pressure: overtreatmentDiscountPressure ?? null,
      consultation_time: consultationTime || null,
      tags: tags || [],
      receipt_image_url: receiptImageUrl || null,
    }));

    const { data, error } = await supabase
      .from("user_price_reports")
      .insert(rows)
      .select("report_id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reportIds: (data ?? []).map((r: { report_id: string }) => r.report_id) });
  } catch (e) {
    console.error("[API POST /reports]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { reportId, treatmentId, price, visitDate, extraRecommended, extraNote, reviewText, friendlinessScore, nickname } = body;

    if (!reportId) {
      return NextResponse.json({ error: "Missing reportId" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_price_reports")
      .update({
        treatment_id: treatmentId,
        price,
        visit_date: visitDate || null,
        extra_recommended: extraRecommended,
        extra_note: extraNote || null,
        review_text: reviewText || null,
        friendliness_score: friendlinessScore,
        nickname: nickname || null,
      })
      .eq("report_id", reportId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[API PUT /reports]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
