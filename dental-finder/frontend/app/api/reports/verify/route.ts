import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { reportId, pin } = await req.json();
    const { data: ok, error } = await supabase.rpc("verify_report_pin", {
      p_report_id: reportId,
      p_pin: pin,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: !!ok });
  } catch (e) {
    console.error("[API POST /reports/verify]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
