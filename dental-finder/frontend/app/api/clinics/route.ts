import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const swLat = sp.get("sw_lat");
  const swLng = sp.get("sw_lng");
  const neLat = sp.get("ne_lat");
  const neLng = sp.get("ne_lng");
  const city = sp.get("city") || "";
  const district = sp.get("district") || "";
  const search = sp.get("search") || "";
  const page = parseInt(sp.get("page") || "0", 10);
  const priceReportOnly = sp.get("priceReportOnly") === "true";
  const hasBounds = !!(swLat && swLng && neLat && neLng);

  try {
    if (priceReportOnly) {
      const { data: rdata, error: rerror } = await supabase
        .from("user_price_reports")
        .select("clinic_id, report_id, visit_id, extra_recommended");

      if (rerror) {
        return NextResponse.json({ error: rerror.message }, { status: 500 });
      }

      const clinicIdsWithReports = [...new Set((rdata ?? []).map((r) => r.clinic_id))];
      if (clinicIdsWithReports.length === 0) {
        return NextResponse.json({ clinics: [] });
      }

      let q = supabase
        .from("clinics")
        .select("clinic_id, name, address, city, district, phone, lat, lng")
        .in("clinic_id", clinicIdsWithReports)
        .eq("is_active", true);

      if (hasBounds) {
        q = q
          .gte("lat", parseFloat(swLat))
          .lte("lat", parseFloat(neLat))
          .gte("lng", parseFloat(swLng))
          .lte("lng", parseFloat(neLng));
      } else if (city) {
        q = q.eq("city", city);
        if (district) q = q.eq("district", district);
      }
      if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);

      const { data, error } = await q;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ clinics: data ?? [] });
    }

    if (hasBounds) {
      let query = supabase
        .from("clinics")
        .select("clinic_id, name, address, city, district, phone, lat, lng")
        .eq("is_active", true)
        .gte("lat", parseFloat(swLat))
        .lte("lat", parseFloat(neLat))
        .gte("lng", parseFloat(swLng))
        .lte("lng", parseFloat(neLng));
      if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);

      const { data, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ clinics: data ?? [] });
    }

    let query = supabase
      .from("clinics")
      .select("clinic_id, name, address, city, district, phone, lat, lng")
      .eq("is_active", true)
      .order("name")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (city) query = query.eq("city", city);
    if (district) query = query.eq("district", district);
    if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ clinics: data ?? [] });
  } catch (e) {
    console.error("[API /clinics]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
