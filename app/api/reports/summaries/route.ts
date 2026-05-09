import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get("ids");
  if (!idsParam) {
    return NextResponse.json({ reports: [] });
  }

  const clinicIds = idsParam.split(",").filter(Boolean);
  if (clinicIds.length === 0) {
    return NextResponse.json({ reports: [] });
  }

  try {
    const { data, error } = await supabase
      .from("user_price_reports")
      .select("clinic_id, report_id, visit_id, extra_recommended")
      .in("clinic_id", clinicIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ reports: data ?? [] });
  } catch (e) {
    console.error("[API /reports/summaries]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
