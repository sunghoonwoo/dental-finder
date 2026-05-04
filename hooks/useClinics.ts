"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { calcDistance, computeReportSummaries, ReportRecord, ReportSummary } from "@/lib/clinicUtils";

export type Clinic = {
  clinic_id: string;
  name: string;
  address: string;
  city: string;
  district: string;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  distance?: number;
  reportSummary?: ReportSummary;
};

const PAGE_SIZE = 20;

type Params = {
  tab: "nearby" | "region";
  userPos: { lat: number; lng: number } | null;
  city: string;
  district: string;
  search: string;
  page: number;
  priceReportOnly: boolean;
};

export function useClinics({ tab, userPos, city, district, search, page, priceReportOnly }: Params) {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // search가 빈 문자열로 초기화될 때만 clinics를 비움 (검색 후 뒤로가기 방지)
    if (search === "") {
      setClinics([]);
    }
  }, [tab, city, district, search, userPos, priceReportOnly]);

  useEffect(() => {
    if (tab === "nearby" && !userPos) return;
    setLoading(true);

    const NEARBY_KM = priceReportOnly ? 10 : 5;
    const delta = NEARBY_KM / 111;

    const withDistances = (items: Clinic[]): Clinic[] =>
      items
        .map((c) => ({ ...c, distance: c.lat && c.lng && userPos ? calcDistance(userPos.lat, userPos.lng, c.lat, c.lng) : 999 }))
        .filter((c) => (c.distance ?? 999) <= NEARBY_KM)
        .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

    const loadClinics = async () => {
      if (priceReportOnly) {
        const { data: rdata } = await supabase.from("user_price_reports").select("clinic_id, extra_recommended");
        const reports = (rdata ?? []) as ReportRecord[];
        const summaries = computeReportSummaries(reports);
        const clinicIds = [...summaries.keys()];

        if (clinicIds.length === 0) { setClinics([]); setLoading(false); return; }

        let q = supabase
          .from("clinics")
          .select("clinic_id, name, address, city, district, phone, lat, lng")
          .eq("is_active", true)
          .in("clinic_id", clinicIds);

        if (tab === "nearby" && userPos) {
          q = q.gte("lat", userPos.lat - delta).lte("lat", userPos.lat + delta)
               .gte("lng", userPos.lng - delta).lte("lng", userPos.lng + delta);
        } else if (tab === "region") {
          q = q.eq("city", city);
          if (district) q = q.eq("district", district);
        }
        if (search && search.trim()) q = q.ilike("name", `%${search.trim()}%`);

        const { data } = await q;
        let result: Clinic[] = (data ?? []).map((c: any) => ({ ...c, reportSummary: summaries.get(c.clinic_id) }));
        if (tab === "nearby") result = withDistances(result);
        setClinics(result);
        setLoading(false);
        return;
      }

      if (tab === "nearby" && userPos) {
        let query = supabase
          .from("clinics")
          .select("clinic_id, name, address, city, district, phone, lat, lng")
          .eq("is_active", true)
          .gte("lat", userPos.lat - delta).lte("lat", userPos.lat + delta)
          .gte("lng", userPos.lng - delta).lte("lng", userPos.lng + delta);
        if (search && search.trim()) query = query.ilike("name", `%${search.trim()}%`);

        const { data } = await query;
        const sorted = withDistances(data ?? []);
        const clinicIds = sorted.map((c) => c.clinic_id);
        const reports = clinicIds.length > 0
          ? await supabase.from("user_price_reports").select("clinic_id, extra_recommended").in("clinic_id", clinicIds).then(({ data }) => data ?? [])
          : [];
        const summaries = computeReportSummaries(reports as ReportRecord[]);
        setClinics(sorted.map((c) => ({ ...c, reportSummary: summaries.get(c.clinic_id) })));
        setLoading(false);
      } else {
        let query = supabase
          .from("clinics")
          .select("clinic_id, name, address, city, district, phone, lat, lng")
          .eq("is_active", true)
          .eq("city", city)
          .order("name")
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (district) query = query.eq("district", district);
        if (search && search.trim()) query = query.ilike("name", `%${search.trim()}%`);

        const { data } = await query;
        const clinicIds = (data ?? []).map((c) => c.clinic_id);
        const reports = clinicIds.length > 0
          ? await supabase.from("user_price_reports").select("clinic_id, extra_recommended").in("clinic_id", clinicIds).then(({ data }) => data ?? [])
          : [];
        const summaries = computeReportSummaries(reports as ReportRecord[]);
        setClinics((data ?? []).map((c) => ({ ...c, reportSummary: summaries.get(c.clinic_id) })));
        setLoading(false);
      }
    };

    loadClinics();
  }, [tab, userPos, city, district, search, page, priceReportOnly]);

  const pagedClinics = tab === "nearby" && !priceReportOnly
    ? clinics.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : clinics;

  return { clinics, loading, pagedClinics };
}
