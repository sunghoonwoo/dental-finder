"use client";

import { useEffect, useState } from "react";
import { api, Clinic } from "@/lib/api-client";
import { calcDistance, computeReportSummaries, ReportRecord, ReportSummary } from "@/lib/clinicUtils";

const PAGE_SIZE = 20;

type Params = {
  tab: "nearby" | "region";
  userPos: { lat: number; lng: number } | null;
  city: string;
  district: string;
  search: string;
  page: number;
  priceReportOnly: boolean;
  bounds?: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } } | null;
};

export function useClinics({ tab, userPos, city, district, search, page, priceReportOnly, bounds }: Params) {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setClinics([]);
  }, [tab, city, district, userPos, priceReportOnly]);

  useEffect(() => {
    if (tab === "nearby" && !bounds) return;
    setLoading(true);

    const loadClinics = async () => {
      try {
        if (priceReportOnly) {
          const sw = bounds ? { sw_lat: String(bounds.sw.lat), sw_lng: String(bounds.sw.lng), ne_lat: String(bounds.ne.lat), ne_lng: String(bounds.ne.lng) } : {};
          const { clinics: data } = await api.fetchClinics({
            ...sw,
            priceReportOnly: "true",
            city: bounds ? "" : city,
            district: bounds ? "" : district,
            search,
          });

          const clinicIds = data.map((c) => c.clinic_id);
          const summaries = new Map<string, ReportSummary>();
          if (clinicIds.length > 0) {
            const { reports } = await api.fetchReportSummaries(clinicIds);
            const merged = computeReportSummaries(reports as ReportRecord[]);
            merged.forEach((v, k) => summaries.set(k, v));
          }

          setClinics(data.map((c) => ({ ...c, reportSummary: summaries.get(c.clinic_id) })));
          setLoading(false);
          return;
        }

        if (tab === "nearby" && bounds) {
          const { clinics: data } = await api.fetchClinics({
            sw_lat: String(bounds.sw.lat),
            sw_lng: String(bounds.sw.lng),
            ne_lat: String(bounds.ne.lat),
            ne_lng: String(bounds.ne.lng),
            search,
          });

          const sorted = data
            .map((c) => ({
              ...c,
              distance: c.lat && c.lng && userPos ? calcDistance(userPos.lat, userPos.lng, c.lat, c.lng) : 999,
            }))
            .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

          const clinicIds = sorted.map((c) => c.clinic_id);
          let summaries = new Map<string, ReportSummary>();
          if (clinicIds.length > 0) {
            const { reports } = await api.fetchReportSummaries(clinicIds);
            summaries = computeReportSummaries(reports as ReportRecord[]);
          }
          setClinics(sorted.map((c) => ({ ...c, reportSummary: summaries.get(c.clinic_id) })));
          setLoading(false);
        } else {
          const { clinics: data } = await api.fetchClinics({
            city,
            district,
            search,
            page: String(page),
          });

          const clinicIds = data.map((c) => c.clinic_id);
          let summaries = new Map<string, ReportSummary>();
          if (clinicIds.length > 0) {
            const { reports } = await api.fetchReportSummaries(clinicIds);
            summaries = computeReportSummaries(reports as ReportRecord[]);
          }
          setClinics(data.map((c) => ({ ...c, reportSummary: summaries.get(c.clinic_id) })));
          setLoading(false);
        }
      } catch (e) {
        console.error("[useClinics] Error:", e);
        setLoading(false);
      }
    };

    loadClinics();
  }, [tab, userPos, city, district, search, page, priceReportOnly, bounds]);

  const pagedClinics = tab === "nearby" && !priceReportOnly
    ? clinics.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : clinics;

  return { clinics, loading, pagedClinics };
}
