import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { reportId } = await req.json();
    const { data, error } = await supabase
      .from("user_price_reports")
      .select("pin")
      .eq("report_id", reportId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ requiresPin: !!(data?.pin) });
  } catch (e) {
    console.error("[API POST /reports/requires-pin]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
