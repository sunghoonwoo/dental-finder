import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { reportId } = await req.json();
    console.log("[requires-pin] reportId:", reportId);

    const { data: requiresPin, error } = await supabase.rpc("report_requires_pin", {
      p_report_id: reportId,
    });

    if (error) {
      console.error("[requires-pin] RPC error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    console.log("[requires-pin] result:", requiresPin);
    return NextResponse.json({ requiresPin: !!requiresPin });
  } catch (e) {
    console.error("[API POST /reports/requires-pin]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
