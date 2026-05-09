import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city");
  if (!city) {
    return NextResponse.json({ error: "city parameter is required" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase.rpc("get_districts", { p_city: city });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json((data ?? []).map((r: { district: string }) => r.district));
  } catch (e) {
    console.error("[API /districts]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
