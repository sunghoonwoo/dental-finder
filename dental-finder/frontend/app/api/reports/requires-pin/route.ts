import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { reportId } = await req.json();
    const { data: requiresPin, error } = await supabase.rpc("report_requires_pin", {
      p_report_id: reportId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ requiresPin: !!requiresPin });
  } catch (e) {
    console.error("[API POST /reports/requires-pin]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
